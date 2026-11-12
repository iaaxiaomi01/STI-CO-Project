import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, Pencil, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { isSchoolAdmin } from '../config/roles.js'
import { fullNameOf } from '../lib/profile.js'
import { fetchPositions, setOfficerPosition } from '../lib/officerPositions.js'
import {
  adminErrorMessage,
  assignableRoles,
  fetchAllOrganizations,
  fetchProfileExtras,
  fetchRoles,
  fetchUsers,
  removeUser,
  roleNeedsOrg,
  saveUser,
} from '../lib/schoolAdmin.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Avatar from '../components/Avatar.jsx'
import PositionDialog from '../components/PositionDialog.jsx'
import base from '../components/ProposalForm.module.css'
import list from './Members.module.css'
import styles from './Admin.module.css'
import remove from './RemoveUserDialog.module.css'

/* ============================================================
   USERS — School Administrator at SAO

   SAO (SAO_USERS_READ.sql) → PAREHONG listahan, search, filter at
   status, pero BASA LANG: walang "+ Add user", Edit, Remove at
   "Set position" (walang Actions column). Ang database rin ang
   humaharang: sa_save_user(), sa_remove_user() at
   set_officer_position() ay School Administrator pa rin lang.
   Pinalitan nito ang Members page ng SAO.

   Lahat ng nasa student_records (ang listahan ng pwedeng
   mag-login), pati ang hindi pa nakaka-login.
     + Add user   → bagong record; makakapag-login na siya
     Edit         → pangalan, student ID, kurso, role, org, status
     Remove       → PERMANENTENG pagbura (SA_REMOVE_USER.sql).
                    May confirm dialog na kailangang i-type ang email.
                    Hindi lumalabas sa sarili mong row.
     Set position → officer position (President, VP, atbp.) sa
                    kahit anong org — DATING NASA MEMBERS PAGE.
                    Para lang sa aktibong Member/Officer na may org
                    at naka-login na (may profile).

   WALA NANG MEMBERS PAGE ANG SCHOOL ADMINISTRATOR. Dito na
   inilipat ang lahat ng ginagawa niya roon:
     - profile picture (avatar) sa tabi ng pangalan
     - dilaw na singsing ng avatar ng officer
     - position bilang "Role" (hal. "President")
     - "Set position" (PositionDialog)
   Ang organization filter ay nandito na dati pa.

   STATUS (bagong column):
     Logged in         → naka-login na kahit isang beses (may
                         profile). Kasama ang petsa ng huling login
                         kapag napatakbo na ang SA_USERS_LOGIN_STATUS.sql
     Not logged in yet → nasa listahan pero hindi pa nakakapag-login
     Inactive          → hindi makakapasok sa app
   May filter din ayon dito, kasama ang bilang ng bawat isa.

   Kapag naka-login na ang tao, sabay na binabago ang profile
   niya — magbabago agad ang role at sidebar niya. Kapag
   nag-login na siya dati pero na-Access Denied, gagawan na siya
   ng account pagka-save.

   Hindi na mapipili ang IT Administrator sa Add user / Edit
   (assignableRoles() sa lib/schoolAdmin.js).

   Database: sa_list_users(), sa_save_user() —
   SCHOOL_ADMIN_SUPERADMIN.sql; sa_remove_user() — SA_REMOVE_USER.sql;
   last_sign_in_at — SA_USERS_LOGIN_STATUS.sql;
   set_officer_position() — SCHOOL_ADMIN_SUPERADMIN.sql (SA 7)
   ============================================================ */

const NO_ORG = '__none__'
const PAGE_SIZE = 100

const STATUS_ALL = ''
const STATUS_LOGGED_IN = 'loggedin'
const STATUS_NO_LOGIN = 'nologin'
const STATUS_ACTIVE = 'active'
const STATUS_INACTIVE = 'inactive'

/* Member at Officer lang ang pwedeng bigyan ng position — at
   kailangang naka-login na siya (sa profile nakatala ang position) */
function canSetPosition(u) {
  return Boolean(
    u.has_account &&
      u.profile_id &&
      u.is_active &&
      (u.role_id === 1 || u.role_id === 2) &&
      u.organization_id,
  )
}

/* Hugis na hinihingi ng PositionDialog (galing sa dating Members page):
   id = profile id, officer_positions = { name } */
function toMember(u) {
  return {
    ...u,
    id: u.profile_id,
    officer_positions: u.position_name ? { name: u.position_name } : null,
  }
}

/* ---------- Petsa ng login ---------- */
const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const TIME_FORMAT = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' })

/* "today, 3:15 PM" · "yesterday, 9:02 AM" · "Nov 3, 2026" */
function formatWhen(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)

  if (date >= startToday) return `today, ${TIME_FORMAT.format(date)}`
  if (date >= startYesterday) return `yesterday, ${TIME_FORMAT.format(date)}`
  return DATE_FORMAT.format(date)
}

function Users() {
  const { profile, refreshProfile } = useAuth()

  /* School Administrator → buong pamamahala.
     SAO → basa lang (walang Add, Edit, Remove, Set position). */
  const canManage = isSchoolAdmin(profile)

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [orgs, setOrgs] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL)
  const [shown, setShown] = useState(PAGE_SIZE)

  /* Bumalik sa unang 100 kapag nagbago ang search o filter */
  function withReset(setter) {
    return (value) => {
      setter(value)
      setShown(PAGE_SIZE)
    }
  }

  /* null = sarado, 'new' = bago, { ...user } = ine-edit */
  const [editing, setEditing] = useState(null)

  /* Ang user na buburahin (null = sarado) */
  const [removing, setRemoving] = useState(null)

  /* Ang user na binibigyan ng position (null = sarado) */
  const [positionFor, setPositionFor] = useState(null)

  const load = useCallback(async () => {
    try {
      const [u, r, o, extras] = await Promise.all([
        fetchUsers(),
        fetchRoles(),
        fetchAllOrganizations(),
        /* Avatar at position_id — kapag pumalya, gagana pa rin ang
           listahan (walang larawan at walang "Set position" lang) */
        fetchProfileExtras().catch((err) => {
          console.error('Hindi makuha ang profile pictures at positions:', err)
          return null
        }),
      ])

      const extrasById = new Map((extras ?? []).map((p) => [p.id, p]))
      setUsers(
        u.map((row) => {
          const extra = row.profile_id ? extrasById.get(row.profile_id) : null
          return {
            ...row,
            avatar_url: extra?.avatar_url ?? null,
            position_id: extra?.position_id ?? null,
            /* false = hindi nakuha ang position_id, kaya itago ang
               "Set position" para hindi magkamali ang dialog */
            extras_loaded: extras !== null,
          }
        }),
      )
      setRoles(r)
      setOrgs(o)
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang users:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* Lahat ng officer position ng lahat ng org (RLS: nakikita ng SA
     ang lahat). Kailangan lang para sa "Set position" — kaya hindi
     na kinukuha para sa SAO (basa lang). */
  useEffect(() => {
    if (!canManage) return
    fetchPositions()
      .then(setPositions)
      .catch((err) => console.error('Hindi makuha ang officer positions:', err))
  }, [canManage])

  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles])
  const orgName = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs])

  /* position id → [mga may hawak] (para sa PositionDialog) */
  const holdersByPosition = useMemo(() => {
    const map = new Map()
    users.forEach((u) => {
      if (u.position_id && u.profile_id) {
        map.set(u.position_id, [...(map.get(u.position_id) ?? []), toMember(u)])
      }
    })
    return map
  }, [users])

  /* Bilang para sa Status filter */
  const statusCounts = useMemo(() => {
    const counts = { loggedIn: 0, noLogin: 0, active: 0, inactive: 0 }
    users.forEach((u) => {
      if (u.has_account) counts.loggedIn += 1
      else counts.noLogin += 1
      if (u.is_active) counts.active += 1
      else counts.inactive += 1
    })
    return counts
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (orgFilter === NO_ORG && u.organization_id) return false
      if (orgFilter && orgFilter !== NO_ORG && u.organization_id !== orgFilter) return false
      if (roleFilter && String(u.role_id) !== roleFilter) return false
      if (statusFilter === STATUS_LOGGED_IN && !u.has_account) return false
      if (statusFilter === STATUS_NO_LOGIN && u.has_account) return false
      if (statusFilter === STATUS_ACTIVE && !u.is_active) return false
      if (statusFilter === STATUS_INACTIVE && u.is_active) return false
      if (!q) return true
      return [u.first_name, u.last_name, u.middle_name, u.email, u.student_id, u.program, u.position_name]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q))
    })
  }, [users, search, orgFilter, roleFilter, statusFilter])

  async function handleSave(values) {
    const isNew = editing === 'new'
    await saveUser(isNew ? null : editing.record_id, values)
    const name = `${values.firstName.trim()} ${values.lastName.trim()}`.toUpperCase()
    setNotice(
      isNew
        ? `${name} was added. They can now log in with ${values.email.trim().toLowerCase()}.`
        : `${name} was saved.`,
    )
    const self = !isNew && editing.profile_id === profile?.id
    setEditing(null)
    await load()
    if (self) await refreshProfile()
  }

  async function handleRemove(user) {
    await removeUser(user.record_id)
    setRemoving(null)
    /* Alisin agad sa listahan, tapos kunin ulit para tama ang bilang */
    setUsers((all) => all.filter((u) => u.record_id !== user.record_id))
    setNotice(`${fullNameOf(user)} was removed.`)
    await load()
  }

  /* Galing sa dating Members page */
  async function handleSavePosition(positionId) {
    const member = positionFor
    await setOfficerPosition(member.id, positionId)

    const name = fullNameOf(member)
    const position = positions.find((p) => p.id === positionId)
    setNotice(position ? `${name} is now ${position.name}.` : `${name} is now a Member.`)
    setPositionFor(null)
    await load()
  }

  /* Hindi mabubura ang sarili */
  function isSelf(u) {
    return Boolean(u.profile_id && u.profile_id === profile?.id) ||
      (u.email ?? '').toLowerCase() === (profile?.email ?? '').toLowerCase()
  }

  const visible = filtered.slice(0, shown)

  return (
    <div className={list.page}>
      <PageHeader
        title="Users"
        subtitle={
          canManage
            ? 'Everyone who can log in: add people, see who has logged in, set officer positions, change roles or organizations, deactivate or remove them.'
            : 'Everyone who can log in: see their role, organization, program and whether they have logged in. View only.'
        }
        action={
          canManage && (
            <ActionButton
              onClick={() => {
                setNotice('')
                setEditing('new')
              }}
            >
              + Add user
            </ActionButton>
          )
        }
      />

      {notice && (
        <p className={list.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={list.status}>Loading users…</p>}

      {!loading && error && (
        <EmptyState icon="!" title="Could not load the list" message={adminErrorMessage(error)} />
      )}

      {!loading && !error && (
        <>
          <div className={list.toolbar}>
            <label className={list.searchField}>
              <Search className={list.searchIcon} size={20} strokeWidth={2.2} aria-hidden="true" />
              <input
                type="search"
                className={list.search}
                placeholder="Search by name, email, student ID, program or position…"
                value={search}
                onChange={(e) => withReset(setSearch)(e.target.value)}
              />
            </label>

            <div className={list.controls}>
              <FilterSelect label="Filter by organization" value={orgFilter} onChange={withReset(setOrgFilter)}>
                <option value="">All organizations</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
                <option value={NO_ORG}>No organization</option>
              </FilterSelect>

              <FilterSelect label="Filter by role" value={roleFilter} onChange={withReset(setRoleFilter)}>
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect label="Filter by status" value={statusFilter} onChange={withReset(setStatusFilter)}>
                <option value={STATUS_ALL}>All statuses</option>
                <option value={STATUS_LOGGED_IN}>Logged in ({statusCounts.loggedIn})</option>
                <option value={STATUS_NO_LOGIN}>Not logged in yet ({statusCounts.noLogin})</option>
                <option value={STATUS_ACTIVE}>Active ({statusCounts.active})</option>
                <option value={STATUS_INACTIVE}>Inactive ({statusCounts.inactive})</option>
              </FilterSelect>

              <span className={list.count}>
                <b>{filtered.length}</b> of {users.length}
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="▲" title="No match" message="Try a different search or filter." />
          ) : (
            <>
              <div className={list.tableWrap}>
                <table className={`${list.table} ${styles.usersTable}`}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Student ID</th>
                      <th>Program</th>
                      <th>Year</th>
                      <th>Organization</th>
                      {/* SAO: walang Actions column (basa lang) */}
                      {canManage && (
                        <th>
                          <span className={list.srOnly}>Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => {
                      const isOfficer = Boolean(u.position_name) || u.role_id === 2
                      return (
                        <tr
                          key={u.record_id}
                          className={[
                            u.is_active ? '' : list.inactive,
                            isOfficer ? list.officerRow : '',
                          ].join(' ')}
                        >
                          <td className={list.nameCell}>
                            {/* Profile picture + pangalan. Kapag walang larawan
                                (o hindi pa naka-login), unang letra ang lalabas. */}
                            <div className={list.person}>
                              <span className={list.avatarRing}>
                                <Avatar src={u.avatar_url} name={fullNameOf(u)} size="sm" />
                              </span>
                              <div className={list.personText}>
                                <span className={list.name}>{fullNameOf(u)}</span>
                                <span className={list.email}>{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className={list.roleCell}>
                            {u.position_name ? (
                              <span className={list.position} title="Officer">
                                {u.position_name}
                              </span>
                            ) : (
                              <span className={list.roleText}>{roleName.get(u.role_id) ?? '—'}</span>
                            )}
                            {u.profile_id && u.profile_id === profile?.id && (
                              <div className={styles.badges}>
                                <span className={`${styles.badge} ${styles.badgeSpecial}`}>You</span>
                              </div>
                            )}
                          </td>
                          <td className={list.detail} data-label="Status">
                            <LoginStatus user={u} />
                          </td>
                          <td className={list.detail} data-label="Student ID">
                            {u.student_id || '—'}
                          </td>
                          <td className={`${list.detail} ${styles.wrapCell}`} data-label="Program">
                            {u.program || '—'}
                          </td>
                          <td className={list.detail} data-label="Year">
                            {u.year_level || '—'}
                          </td>
                          <td className={`${list.detail} ${list.orgCell}`} data-label="Organization">
                            {u.organization_id ? (orgName.get(u.organization_id) ?? '—') : '—'}
                          </td>
                          {canManage && (
                            <td className={list.actionCell}>
                              <span className={styles.rowActions}>
                                {u.extras_loaded && canSetPosition(u) && (
                                  <button
                                    type="button"
                                    className={list.rowButton}
                                    onClick={() => {
                                      setNotice('')
                                      setPositionFor(toMember(u))
                                    }}
                                  >
                                    Set position
                                    <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden="true" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={list.rowButton}
                                  onClick={() => {
                                    setNotice('')
                                    setEditing(u)
                                  }}
                                >
                                  Edit
                                  <Pencil size={14} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                                {!isSelf(u) && (
                                  <button
                                    type="button"
                                    className={`${list.rowButton} ${remove.rowButton}`}
                                    onClick={() => {
                                      setNotice('')
                                      setRemoving(u)
                                    }}
                                  >
                                    Remove
                                    <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                                  </button>
                                )}
                              </span>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filtered.length > shown && (
                <div className={styles.more}>
                  <button
                    type="button"
                    className={list.rowButton}
                    onClick={() => setShown((n) => n + PAGE_SIZE)}
                  >
                    Show {Math.min(PAGE_SIZE, filtered.length - shown)} more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Mga dialog — School Administrator lang (hindi mabubuksan ng SAO) */}
      {canManage && editing && (
        <UserDialog
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.profile_id === profile?.id}
          roles={roles}
          orgs={orgs}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {canManage && removing && (
        <RemoveUserDialog
          user={removing}
          roleLabel={removing.position_name ?? roleName.get(removing.role_id) ?? 'User'}
          orgLabel={removing.organization_id ? orgName.get(removing.organization_id) : null}
          onConfirm={() => handleRemove(removing)}
          onDeactivateInstead={() => {
            setRemoving(null)
            setEditing(removing)
          }}
          onCancel={() => setRemoving(null)}
        />
      )}

      {canManage && positionFor && (
        <PositionDialog
          member={positionFor}
          positions={positions.filter((p) => p.organization_id === positionFor.organization_id)}
          holdersByPosition={holdersByPosition}
          canManagePositions
          onSave={handleSavePosition}
          onCancel={() => setPositionFor(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   Status ng login
     Logged in         (berde)  + "Last login …" kapag may petsa
     Not logged in yet (dilaw)  + "Added …"
     Inactive          (abo)    + huling login o "Never logged in"
   ------------------------------------------------------------ */
function LoginStatus({ user }) {
  const lastLogin = formatWhen(user.last_sign_in_at)

  let badge
  let meta = null

  if (!user.is_active) {
    badge = <span className={`${styles.badge} ${styles.badgeOff}`}>Inactive</span>
    if (lastLogin) meta = `Last login ${lastLogin}`
    else if (!user.has_account) meta = 'Never logged in'
  } else if (user.has_account) {
    badge = <span className={styles.badge}>Logged in</span>
    if (lastLogin) meta = `Last login ${lastLogin}`
  } else {
    badge = <span className={`${styles.badge} ${styles.badgeWait}`}>Not logged in yet</span>
    const added = formatWhen(user.created_at)
    if (added) meta = `Added ${added}`
  }

  return (
    <>
      <div className={styles.badges}>{badge}</div>
      {meta && <span className={styles.statusMeta}>{meta}</span>}
    </>
  )
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <span className={list.selectField}>
      <select
        className={list.orgSelect}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown className={list.selectIcon} size={18} strokeWidth={2.4} aria-hidden="true" />
    </span>
  )
}

/* ------------------------------------------------------------
   Pagbura ng user — permanent, kaya kailangang i-type ang email
   ------------------------------------------------------------ */
function RemoveUserDialog({ user, roleLabel, orgLabel, onConfirm, onDeactivateInstead, onCancel }) {
  const [typed, setTyped] = useState('')
  const [removingNow, setRemovingNow] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const email = (user.email ?? '').trim().toLowerCase()
  const matches = typed.trim().toLowerCase() === email

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !removingNow) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removingNow, onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!matches) return
    setError('')
    setRemovingNow(true)
    try {
      await onConfirm()
    } catch (err) {
      console.error('Hindi nabura ang user:', err)
      setError(adminErrorMessage(err))
      setRemovingNow(false)
    }
  }

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !removingNow) onCancel()
      }}
    >
      <form
        className={`${base.modal} ${remove.modal}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-user-title"
        aria-describedby="remove-user-warning"
        onSubmit={handleSubmit}
      >
        <h2 id="remove-user-title" className={base.heading}>
          Remove {fullNameOf(user)}?
        </h2>

        <div className={remove.person}>
          <span className={remove.personName}>{fullNameOf(user)}</span>
          <span className={remove.personMeta}>
            {[roleLabel, orgLabel, user.email].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div id="remove-user-warning" className={remove.warning}>
          <p className={remove.warningTitle}>This cannot be undone.</p>
          <ul className={remove.warningList}>
            <li>They can no longer log in.</li>
            {user.has_account ? (
              <li>
                Their account is deleted, with their event attendance, certificates, Organization
                Gems, redemptions and notifications.
              </li>
            ) : (
              <li>They have not logged in yet, so only their record is deleted.</li>
            )}
            {user.has_account && (
              <li>
                Proposals, announcements and events they made are kept, but are no longer linked
                to an account.
              </li>
            )}
          </ul>
        </div>

        {user.has_account && (
          <p className={remove.alternative}>
            Only want to stop them from logging in and keep their history?{' '}
            <button
              type="button"
              className={remove.linkButton}
              onClick={onDeactivateInstead}
              disabled={removingNow}
            >
              Deactivate instead
            </button>
          </p>
        )}

        <label className={base.field}>
          <span className={base.label}>
            Type <strong className={remove.email}>{email}</strong> to confirm
          </span>
          <input
            ref={inputRef}
            className={base.input}
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
            disabled={removingNow}
          />
        </label>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onCancel} disabled={removingNow}>
            Cancel
          </button>
          <button type="submit" className={base.danger} disabled={!matches || removingNow}>
            {removingNow ? 'Removing…' : 'Remove permanently'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------
   Form ng user (bago o ine-edit)
   ------------------------------------------------------------ */
function UserDialog({ user, isSelf, roles, orgs, onSave, onCancel }) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [middleName, setMiddleName] = useState(user?.middle_name ?? '')
  const [studentId, setStudentId] = useState(user?.student_id ?? '')
  const [program, setProgram] = useState(user?.program ?? '')
  const [yearLevel, setYearLevel] = useState(user?.year_level ?? '')
  const [roleId, setRoleId] = useState(String(user?.role_id ?? 1))
  const [organizationId, setOrganizationId] = useState(user?.organization_id ?? '')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  const needsOrg = roleNeedsOrg(roleId)
  const lockedEmail = Boolean(user?.has_account)

  /* Walang IT Administrator sa pagpipilian — maliban kung IT Admin
     na ang ine-edit, para hindi mabago ang role niya pagka-Save */
  const roleChoices = assignableRoles(roles, user?.role_id ?? null)

  /* Aktibong org lang ang pagpipilian — pero ipakita pa rin ang
     kasalukuyan kahit na-deactivate na ito */
  const orgChoices = orgs.filter((o) => o.is_active || o.id === user?.organization_id)

  const roleChanged = user && Number(roleId) !== user.role_id
  const wasOfficerWithPosition = user?.position_name && roleChanged

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (needsOrg && !organizationId) {
      setError('Choose an organization for this role.')
      return
    }
    if (user?.is_active && !isActive && user.has_account) {
      const ok = window.confirm(
        `Deactivate ${fullNameOf(user)}? They will no longer be able to open the app until you activate them again.`,
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      await onSave({
        email,
        lastName,
        firstName,
        middleName,
        studentId,
        program,
        yearLevel,
        roleId,
        organizationId: needsOrg ? organizationId : null,
        isActive,
      })
    } catch (err) {
      console.error('Hindi na-save ang user:', err)
      setError(adminErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={`${base.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
        onSubmit={handleSubmit}
      >
        <h2 id="user-dialog-title" className={base.heading}>
          {user ? `Edit ${fullNameOf(user)}` : 'Add user'}
        </h2>

        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <label className={base.field}>
            <span className={base.label}>Microsoft email</span>
            <input
              ref={firstRef}
              type="email"
              className={`${base.input} ${lockedEmail ? styles.readonly : ''}`}
              value={email}
              readOnly={lockedEmail}
              placeholder="lastname.123456@sanpablo.sti.edu.ph"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className={styles.fieldHint}>
              {lockedEmail
                ? 'This person has already logged in, so the email can no longer be changed.'
                : 'They log in with this Microsoft account.'}
            </p>
          </label>

          <div className={styles.grid3}>
            <label className={base.field}>
              <span className={base.label}>Last name</span>
              <input
                className={base.input}
                value={lastName}
                maxLength={100}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
            <label className={base.field}>
              <span className={base.label}>First name</span>
              <input
                className={base.input}
                value={firstName}
                maxLength={100}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label className={base.field}>
              <span className={base.label}>
                Middle name <span className={base.optional}>(optional)</span>
              </span>
              <input
                className={base.input}
                value={middleName}
                maxLength={100}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.grid3}>
            <label className={base.field}>
              <span className={base.label}>
                Student ID <span className={base.optional}>(optional)</span>
              </span>
              <input
                className={base.input}
                value={studentId}
                maxLength={50}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </label>
            <label className={base.field}>
              <span className={base.label}>
                Program <span className={base.optional}>(optional)</span>
              </span>
              <input
                className={base.input}
                value={program}
                maxLength={100}
                placeholder="BS in Information Technology"
                onChange={(e) => setProgram(e.target.value)}
              />
            </label>
            <label className={base.field}>
              <span className={base.label}>
                Year level <span className={base.optional}>(optional)</span>
              </span>
              <input
                className={base.input}
                value={yearLevel}
                maxLength={30}
                placeholder="1Y1"
                onChange={(e) => setYearLevel(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.grid2}>
            <label className={base.field}>
              <span className={base.label}>Role</span>
              <select
                className={`${base.input} ${styles.select} ${isSelf ? styles.readonly : ''}`}
                value={roleId}
                disabled={isSelf}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roleChoices.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={base.field}>
              <span className={base.label}>Organization</span>
              <select
                className={`${base.input} ${styles.select} ${needsOrg ? '' : styles.readonly}`}
                value={needsOrg ? organizationId : ''}
                disabled={!needsOrg}
                onChange={(e) => setOrganizationId(e.target.value)}
                required={needsOrg}
              >
                <option value="">{needsOrg ? 'Choose an organization' : 'None (staff role)'}</option>
                {orgChoices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isSelf && (
            <p className={styles.fieldHint}>You cannot change your own role or deactivate your own account.</p>
          )}
          {wasOfficerWithPosition && (
            <p className={styles.fieldHint}>
              Changing the role removes their officer position ({user.position_name}).
            </p>
          )}
          {Number(roleId) === 2 && (!user || user.role_id !== 2) && (
            <p className={styles.fieldHint}>
              They will be an Officer with no position. To give a position, use “Set position” on
              their row in this list
              {user?.has_account ? '.' : ' — it appears once they have logged in.'}
            </p>
          )}

          <label className={styles.check} style={{ marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              checked={isActive}
              disabled={isSelf}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>
              <span className={styles.checkTitle}>Active</span>
              <span className={styles.checkText}>
                Inactive people cannot open the app. Their records and history are kept.
              </span>
            </span>
          </label>
        </fieldset>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={base.primary} disabled={saving}>
            {saving ? 'Saving…' : user ? 'Save' : 'Add user'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Users