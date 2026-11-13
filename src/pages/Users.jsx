import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Award,
  Building2,
  Check,
  ChevronDown,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { isSchoolAdmin } from '../config/roles.js'
import { fullNameOf } from '../lib/profile.js'
import { fetchPositions, setOfficerPosition } from '../lib/officerPositions.js'
import {
  adminErrorMessage,
  fetchAllOrganizations,
  fetchProfileExtras,
  fetchRoles,
  fetchUsers,
  removeUser,
  saveUser,
} from '../lib/schoolAdmin.js'
import AddUserDialog, { AddUserButton } from '../components/AddUser.jsx'
import EditUserDialog, { EditUserButton } from '../components/EditUser.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Avatar from '../components/Avatar.jsx'
import PositionDialog from '../components/PositionDialog.jsx'
import ui from './Users.module.css'
import rowBtn from './UserRowButtons.module.css'
import remove from './RemoveUserDialog.module.css'

/* ============================================================
   USERS — School Administrator, SAO at School Head

   SAO at School Head (SAO_USERS_READ.sql,
   SCHOOL_HEAD_USERS_READ.sql) → PAREHONG listahan, search, filter
   at status, pero BASA LANG: walang "+ Add user", Edit, Remove at
   "Set position" (walang Actions column). Ang database rin ang
   humaharang: sa_save_user(), sa_remove_user() at
   set_officer_position() ay School Administrator pa rin lang.
   Pinalitan nito ang Members page ng SAO at School Head.

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
     SAO at School Head → basa lang (walang Add, Edit, Remove,
     Set position). */
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
     na kinukuha para sa SAO at School Head (basa lang). */
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
    <div className={ui.page}>
      {/* ---------- ULO (navy na banner) ---------- */}
      <header className={ui.hero}>
        <span className={ui.heroPattern} aria-hidden="true" />
        <div className={ui.heroText}>
          <h1 className={ui.title}>Users</h1>
        </div>

        {canManage && (
          <div className={ui.heroAction}>
            <AddUserButton
              onClick={() => {
                setNotice('')
                setEditing('new')
              }}
            />
          </div>
        )}
      </header>

      {notice && (
        <p className={ui.notice} role="status">
          <span className={ui.noticeIcon} aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
          {notice}
        </p>
      )}

      {loading && (
        <p className={ui.loading}>
          <span className={ui.spinner} aria-hidden="true" />
          Loading users…
        </p>
      )}

      {!loading && error && (
        <EmptyState icon="!" title="Could not load the list" message={adminErrorMessage(error)} />
      )}

      {!loading && !error && (
        <>
          {/* ---------- SEARCH at FILTER ---------- */}
          <div className={ui.toolbar}>
            <label className={ui.search}>
              <span className={ui.searchIcon} aria-hidden="true">
                <Search size={18} strokeWidth={2.4} />
              </span>
              <input
                type="search"
                className={ui.searchInput}
                placeholder="Search by name, email, student ID, program or position…"
                value={search}
                onChange={(e) => withReset(setSearch)(e.target.value)}
              />
            </label>

            <div className={ui.controls}>
              <FilterDropdown
                icon={Building2}
                label="Filter by organization"
                value={orgFilter}
                onChange={withReset(setOrgFilter)}
                options={[
                  { value: '', label: 'All organizations' },
                  ...orgs.map((o) => ({
                    value: o.id,
                    label: `${o.name}${o.is_active ? '' : ' (inactive)'}`,
                  })),
                  { value: NO_ORG, label: 'No organization' },
                ]}
              />

              <FilterDropdown
                icon={ShieldCheck}
                label="Filter by role"
                value={roleFilter}
                onChange={withReset(setRoleFilter)}
                options={[
                  { value: '', label: 'All roles' },
                  ...roles.map((r) => ({ value: String(r.id), label: r.name })),
                ]}
              />

              <FilterDropdown
                icon={Activity}
                label="Filter by status"
                value={statusFilter}
                onChange={withReset(setStatusFilter)}
                options={[
                  { value: STATUS_ALL, label: 'All statuses' },
                  { value: STATUS_LOGGED_IN, label: `Logged in (${statusCounts.loggedIn})` },
                  { value: STATUS_NO_LOGIN, label: `Not logged in yet (${statusCounts.noLogin})` },
                  { value: STATUS_ACTIVE, label: `Active (${statusCounts.active})` },
                  { value: STATUS_INACTIVE, label: `Inactive (${statusCounts.inactive})` },
                ]}
              />

              <span className={ui.count}>
                <b>{filtered.length}</b> of {users.length}
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="▲" title="No match" message="Try a different search or filter." />
          ) : (
            <>
              {/* Bawat tao ay isang hilera na may dalawang palapag:
                    itaas  — pangalan · role · status · mga button
                    ibaba  — Student ID · Program · Year · Organization */}
              <div className={ui.listCard}>
                <table className={`${ui.table} ${canManage ? ui.manage : ''}`}>
                  <thead className={ui.srOnly}>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Student ID</th>
                      <th>Program</th>
                      <th>Year</th>
                      <th>Organization</th>
                      {/* SAO at School Head: walang Actions column (basa lang) */}
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => {
                      const isOfficer = Boolean(u.position_name) || u.role_id === 2
                      return (
                        <tr
                          key={u.record_id}
                          className={[
                            ui.row,
                            u.is_active ? '' : ui.inactive,
                            isOfficer ? ui.officerRow : '',
                          ].join(' ')}
                        >
                          <td className={ui.nameCell}>
                            {/* Profile picture + pangalan. Kapag walang larawan
                                (o hindi pa naka-login), unang letra ang lalabas. */}
                            <div className={ui.person}>
                              <span className={ui.avatarRing}>
                                <Avatar src={u.avatar_url} name={fullNameOf(u)} size="sm" />
                              </span>
                              <div className={ui.personText}>
                                <span className={ui.name}>{fullNameOf(u)}</span>
                                <span className={ui.email}>{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className={ui.roleCell}>
                            {u.position_name ? (
                              <span className={ui.position} title="Officer">
                                {u.position_name}
                              </span>
                            ) : (
                              <span className={ui.role} data-role={u.role_id}>
                                {roleName.get(u.role_id) ?? '—'}
                              </span>
                            )}
                            {u.profile_id && u.profile_id === profile?.id && (
                              <span className={ui.you}>You</span>
                            )}
                          </td>
                          <td className={ui.statusCell}>
                            <LoginStatus user={u} />
                          </td>
                          <td className={`${ui.detail} ${ui.idCell}`} data-label="Student ID">
                            {u.student_id || '—'}
                          </td>
                          <td className={`${ui.detail} ${ui.programCell}`} data-label="Program">
                            {u.program || '—'}
                          </td>
                          <td className={`${ui.detail} ${ui.yearCell}`} data-label="Year">
                            {u.year_level || '—'}
                          </td>
                          <td className={`${ui.detail} ${ui.orgCell}`} data-label="Organization">
                            {u.organization_id ? (orgName.get(u.organization_id) ?? '—') : '—'}
                          </td>
                          {canManage && (
                            <td className={ui.actionCell}>
                              <span className={ui.rowActions}>
                                {u.extras_loaded && canSetPosition(u) && (
                                  <button
                                    type="button"
                                    className={rowBtn.position}
                                    onClick={() => {
                                      setNotice('')
                                      setPositionFor(toMember(u))
                                    }}
                                  >
                                    <Award className={rowBtn.positionIcon} size={15} strokeWidth={2.4} aria-hidden="true" />
                                    Set position
                                    <ArrowUpRight className={rowBtn.positionArrow} size={15} strokeWidth={2.6} aria-hidden="true" />
                                  </button>
                                )}
                                <EditUserButton
                                  onClick={() => {
                                    setNotice('')
                                    setEditing(u)
                                  }}
                                />
                                {!isSelf(u) && (
                                  <button
                                    type="button"
                                    className={rowBtn.remove}
                                    onClick={() => {
                                      setNotice('')
                                      setRemoving(u)
                                    }}
                                  >
                                    <Trash2 className={rowBtn.removeIcon} size={15} strokeWidth={2.4} aria-hidden="true" />
                                    Remove
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
                <div className={ui.more}>
                  <button
                    type="button"
                    className={ui.moreButton}
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

      {/* Mga dialog — School Administrator lang (hindi mabubuksan ng
          SAO at School Head) */}
      {canManage && editing === 'new' && (
        <AddUserDialog
          roles={roles}
          orgs={orgs}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {canManage && editing && editing !== 'new' && (
        <EditUserDialog
          user={editing}
          isSelf={editing.profile_id === profile?.id}
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
          look="admin"
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
    badge = <span className={`${ui.status} ${ui.statusOff}`}>Inactive</span>
    if (lastLogin) meta = `Last login ${lastLogin}`
    else if (!user.has_account) meta = 'Never logged in'
  } else if (user.has_account) {
    badge = <span className={`${ui.status} ${ui.statusOn}`}>Logged in</span>
    if (lastLogin) meta = `Last login ${lastLogin}`
  } else {
    badge = <span className={`${ui.status} ${ui.statusWait}`}>Not logged in yet</span>
    const added = formatWhen(user.created_at)
    if (added) meta = `Added ${added}`
  }

  return (
    <>
      {badge}
      {meta && <span className={ui.statusMeta}>{meta}</span>}
    </>
  )
}

/* ------------------------------------------------------------
   Dropdown ng filter (Organization, Role, Status)

   Dati ay <select> ng browser: hindi bumubukas kapag sa icon o
   chevron pinindot, at hindi madisenyuhan ang listahan. Ngayon ay
   sariling listahan na — pareho ang pagpipilian at ang onChange.
     Pindot / Enter / Space / ↓ ↑  → bukas
     ↓ ↑ Home End                  → lipat
     Enter / Space                 → pili
     Esc / pindot sa labas / Tab   → sara
   ------------------------------------------------------------ */
function FilterDropdown({ icon: Icon, label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const uid = useId()
  const listId = `${uid}-list`

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const selected = options[selectedIndex]

  function openList() {
    setActive(selectedIndex)
    setOpen(true)
  }

  function close(focusButton = true) {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  function choose(i) {
    const o = options[i]
    if (!o) return
    if (o.value !== value) onChange(o.value)
    close()
  }

  /* Sa listahan ang focus pagbukas, para gumana ang arrow keys */
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  /* Laging kita ang naka-highlight kapag mahaba ang listahan */
  useEffect(() => {
    if (open) document.getElementById(`${uid}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, uid])

  /* Isara kapag pumindot sa labas */
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function onButtonKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    }
  }

  function onListKey(e) {
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => Math.min(last, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        close(false)
        break
      default:
    }
  }

  return (
    <div ref={rootRef} className={`${ui.dropdown} ${open ? ui.dropdownOpen : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className={ui.dropButton}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
      >
        <span className={ui.dropIcon} aria-hidden="true">
          <Icon size={16} strokeWidth={2.4} />
        </span>
        <span className={ui.dropValue}>{selected?.label}</span>
        <ChevronDown className={ui.dropChevron} size={16} strokeWidth={2.6} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          className={ui.dropList}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${uid}-${active}`}
          tabIndex={-1}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value
            return (
              <li
                key={o.value || '__all__'}
                id={`${uid}-${i}`}
                role="option"
                aria-selected={isSelected}
                className={[
                  ui.dropOption,
                  isSelected ? ui.dropSelected : '',
                  i === active ? ui.dropActive : '',
                ].join(' ')}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className={ui.dropText}>{o.label}</span>
                <span className={ui.dropCheck} aria-hidden="true">
                  <Check size={12} strokeWidth={3.4} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
      className={remove.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !removingNow) onCancel()
      }}
    >
      <form
        className={remove.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-user-title"
        aria-describedby="remove-user-warning"
        onSubmit={handleSubmit}
      >
        {/* Dilaw at navy na "caution tape" sa itaas */}
        <span className={remove.tape} aria-hidden="true" />

        <div className={remove.top}>
          <span className={remove.bigIcon} aria-hidden="true">
            <Trash2 size={26} strokeWidth={2.2} />
          </span>
          <h2 id="remove-user-title" className={remove.heading}>
            Remove {fullNameOf(user)}?
          </h2>
        </div>

        <div className={remove.body}>
          <div className={remove.person}>
            <Avatar src={user.avatar_url} name={fullNameOf(user)} size="md" />
            <div className={remove.personText}>
              <span className={remove.personName}>{fullNameOf(user)}</span>
              <span className={remove.personMeta}>
                {[roleLabel, orgLabel, user.email].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>

          <div id="remove-user-warning" className={remove.warning}>
            <p className={remove.warningTitle}>This cannot be undone.</p>
            <ul className={remove.warningList}>
              <li>
                <X className={remove.warningIcon} size={12} strokeWidth={3.2} aria-hidden="true" />
                <span>They can no longer log in.</span>
              </li>
              {user.has_account ? (
                <li>
                  <X className={remove.warningIcon} size={12} strokeWidth={3.2} aria-hidden="true" />
                  <span>
                    Their account is deleted, with their event attendance, certificates,
                    Organization Gems, redemptions and notifications.
                  </span>
                </li>
              ) : (
                <li>
                  <X className={remove.warningIcon} size={12} strokeWidth={3.2} aria-hidden="true" />
                  <span>They have not logged in yet, so only their record is deleted.</span>
                </li>
              )}
              {user.has_account && (
                <li>
                  <X className={remove.warningIcon} size={12} strokeWidth={3.2} aria-hidden="true" />
                  <span>
                    Proposals, announcements and events they made are kept, but are no longer
                    linked to an account.
                  </span>
                </li>
              )}
            </ul>
          </div>

          {user.has_account && (
            <p className={remove.alternative}>
              <span>Only want to stop them from logging in and keep their history?</span>
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

          <label className={remove.field}>
            <span className={remove.label}>
              Type <strong className={remove.email}>{email}</strong> to confirm
            </span>
            <span className={`${remove.control} ${matches ? remove.controlOk : ''}`}>
              <span className={remove.controlIcon} aria-hidden="true">
                {matches ? (
                  <Check key="ok" size={15} strokeWidth={3} />
                ) : (
                  <Lock key="lock" size={15} strokeWidth={2.4} />
                )}
              </span>
              <input
                ref={inputRef}
                className={remove.input}
                value={typed}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setTyped(e.target.value)}
                disabled={removingNow}
              />
            </span>
          </label>

          {error && <p className={remove.error}>{error}</p>}
        </div>

        <div className={remove.actions}>
          <button type="button" className={remove.cancel} onClick={onCancel} disabled={removingNow}>
            Cancel
          </button>
          <button
            type="submit"
            className={`${remove.confirm} ${matches ? remove.armed : ''}`}
            disabled={!matches || removingNow}
          >
            <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
            {removingNow ? 'Removing…' : 'Remove permanently'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Users