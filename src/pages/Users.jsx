import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Pencil, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { fullNameOf } from '../lib/profile.js'
import {
  adminErrorMessage,
  fetchAllOrganizations,
  fetchRoles,
  fetchUsers,
  roleNeedsOrg,
  saveUser,
} from '../lib/schoolAdmin.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import base from '../components/ProposalForm.module.css'
import list from './Members.module.css'
import styles from './Admin.module.css'

/* ============================================================
   USERS — School Administrator lang

   Lahat ng nasa student_records (ang listahan ng pwedeng
   mag-login), pati ang hindi pa nakaka-login.
     + Add user → bagong record; makakapag-login na siya
     Edit       → pangalan, student ID, kurso, role, org, status

   Kapag naka-login na ang tao, sabay na binabago ang profile
   niya — magbabago agad ang role at sidebar niya. Kapag
   nag-login na siya dati pero na-Access Denied, gagawan na siya
   ng account pagka-save.

   Database: sa_list_users(), sa_save_user() —
   SCHOOL_ADMIN_SUPERADMIN.sql
   ============================================================ */

const NO_ORG = '__none__'
const PAGE_SIZE = 100

const STATUS_ALL = ''
const STATUS_ACTIVE = 'active'
const STATUS_INACTIVE = 'inactive'
const STATUS_NO_LOGIN = 'nologin'

function Users() {
  const { profile, refreshProfile } = useAuth()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [orgs, setOrgs] = useState([])
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

  const load = useCallback(async () => {
    try {
      const [u, r, o] = await Promise.all([fetchUsers(), fetchRoles(), fetchAllOrganizations()])
      setUsers(u)
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

  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles])
  const orgName = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (orgFilter === NO_ORG && u.organization_id) return false
      if (orgFilter && orgFilter !== NO_ORG && u.organization_id !== orgFilter) return false
      if (roleFilter && String(u.role_id) !== roleFilter) return false
      if (statusFilter === STATUS_ACTIVE && !u.is_active) return false
      if (statusFilter === STATUS_INACTIVE && u.is_active) return false
      if (statusFilter === STATUS_NO_LOGIN && u.has_account) return false
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

  const visible = filtered.slice(0, shown)

  return (
    <div className={list.page}>
      <PageHeader
        title="Users"
        subtitle="Everyone who can log in: add people, change their role or organization, or deactivate them."
        action={
          <ActionButton
            onClick={() => {
              setNotice('')
              setEditing('new')
            }}
          >
            + Add user
          </ActionButton>
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
                placeholder="Search by name, email, student ID or program…"
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
                <option value={STATUS_ACTIVE}>Active</option>
                <option value={STATUS_INACTIVE}>Inactive</option>
                <option value={STATUS_NO_LOGIN}>Not logged in yet</option>
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
                <table className={list.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Student ID</th>
                      <th>Program · Year</th>
                      <th>Organization</th>
                      <th>
                        <span className={list.srOnly}>Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => (
                      <tr key={u.record_id} className={u.is_active ? '' : list.inactive}>
                        <td className={list.nameCell}>
                          <div className={list.personText}>
                            <span className={list.name}>{fullNameOf(u)}</span>
                            <span className={list.email}>{u.email}</span>
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
                          <div className={styles.badges}>
                            {!u.is_active && (
                              <span className={`${styles.badge} ${styles.badgeOff}`}>Inactive</span>
                            )}
                            {u.is_active && !u.has_account && (
                              <span className={`${styles.badge} ${styles.badgeWait}`}>No login yet</span>
                            )}
                            {u.profile_id && u.profile_id === profile?.id && (
                              <span className={`${styles.badge} ${styles.badgeSpecial}`}>You</span>
                            )}
                          </div>
                        </td>
                        <td className={list.detail} data-label="Student ID">
                          {u.student_id || '—'}
                        </td>
                        <td className={`${list.detail} ${styles.wrapCell}`} data-label="Program · Year">
                          {[u.program, u.year_level].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className={`${list.detail} ${list.orgCell}`} data-label="Organization">
                          {u.organization_id ? (orgName.get(u.organization_id) ?? '—') : '—'}
                        </td>
                        <td className={list.actionCell}>
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
                        </td>
                      </tr>
                    ))}
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

      {editing && (
        <UserDialog
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.profile_id === profile?.id}
          roles={roles}
          orgs={orgs}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
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
                {roles.map((r) => (
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
              They will be an Officer with no position. To give a position, use “Set position” in
              Members.
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
