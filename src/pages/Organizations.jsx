import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, Pencil, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import {
  adminErrorMessage,
  fetchAllOrganizations,
  saveOrganization,
  setActingOrg,
} from '../lib/schoolAdmin.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import base from '../components/ProposalForm.module.css'
import list from './Members.module.css'
import styles from './Admin.module.css'

/* ============================================================
   ORGANIZATIONS — School Administrator lang

   Lahat ng org (pati inactive):
     + New organization → gumawa
     Edit               → pangalan, department, description,
                          active, at "Post to all organizations"
     Manage             → gawing acting org at buksan ang Org
                          Profile (logo, officer positions)

   Walang delete: i-deactivate lang, para hindi mawala ang
   events, proposals at OG history ng org.

   Database: sa_list_organizations(), sa_save_organization(),
   sa_set_acting_org() — SCHOOL_ADMIN_SUPERADMIN.sql
   ============================================================ */

const STATUS_ALL = ''
const STATUS_ACTIVE = 'active'
const STATUS_INACTIVE = 'inactive'

function Organizations() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(STATUS_ALL)

  /* null = sarado, 'new' = bago, { ...org } = ine-edit */
  const [editing, setEditing] = useState(null)
  const [switchingId, setSwitchingId] = useState(null)

  const load = useCallback(async () => {
    try {
      setOrgs(await fetchAllOrganizations())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang mga org:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter((o) => {
      if (status === STATUS_ACTIVE && !o.is_active) return false
      if (status === STATUS_INACTIVE && o.is_active) return false
      if (!q) return true
      return [o.name, o.department, o.description]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q))
    })
  }, [orgs, search, status])

  const specialOrg = orgs.find((o) => o.can_announce_all) ?? null

  async function handleSave(values) {
    const isNew = editing === 'new'
    await saveOrganization(isNew ? null : editing.id, values)
    setEditing(null)
    setNotice(isNew ? `${values.name.trim()} was created.` : `${values.name.trim()} was saved.`)
    await load()
    /* Baka ang acting org ang binago (pangalan sa sidebar) */
    if (!isNew && editing.id === profile?.organization_id) await refreshProfile()
  }

  async function handleManage(org) {
    setNotice('')
    if (org.id === profile?.organization_id) {
      navigate('/org-profile')
      return
    }
    setSwitchingId(org.id)
    try {
      await setActingOrg(org.id)
      /* Lumipat muna ng page, tapos kunin ulit ang profile —
         bubuuin ulit ng MemberLayout ang Org Profile para sa
         bagong org */
      navigate('/org-profile')
      await refreshProfile()
    } catch (err) {
      console.error('Hindi napalitan ang acting org:', err)
      setNotice(adminErrorMessage(err))
      setSwitchingId(null)
    }
  }

  return (
    <div className={list.page}>
      <PageHeader
        title="Organizations"
        subtitle="Create, edit and deactivate organizations and clubs."
        action={
          <ActionButton
            onClick={() => {
              setNotice('')
              setEditing('new')
            }}
          >
            + New organization
          </ActionButton>
        }
      />

      {notice && (
        <p className={list.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={list.status}>Loading organizations…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load the list"
          message={adminErrorMessage(error)}
        />
      )}

      {!loading && !error && (
        <>
          <div className={list.toolbar}>
            <label className={list.searchField}>
              <Search className={list.searchIcon} size={20} strokeWidth={2.2} aria-hidden="true" />
              <input
                type="search"
                className={list.search}
                placeholder="Search by name, department or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <div className={list.controls}>
              <span className={list.selectField}>
                <select
                  className={list.orgSelect}
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value={STATUS_ALL}>All statuses</option>
                  <option value={STATUS_ACTIVE}>Active</option>
                  <option value={STATUS_INACTIVE}>Inactive</option>
                </select>
                <ChevronDown className={list.selectIcon} size={18} strokeWidth={2.4} aria-hidden="true" />
              </span>

              <span className={list.count}>
                <b>{filtered.length}</b> of {orgs.length}
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="◈"
              title={orgs.length === 0 ? 'No organizations yet' : 'No match'}
              message={
                orgs.length === 0
                  ? 'Create the first organization with “+ New organization”.'
                  : 'Try a different search or status.'
              }
            />
          ) : (
            <div className={list.tableWrap}>
              <table className={list.table}>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Members</th>
                    <th>Officers</th>
                    <th>Advisers</th>
                    <th>
                      <span className={list.srOnly}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const isCurrent = o.id === profile?.organization_id
                    return (
                      <tr key={o.id} className={o.is_active ? '' : list.inactive}>
                        <td className={list.nameCell}>
                          <div className={list.person}>
                            <span className={styles.logo} aria-hidden="true">
                              {o.logo_url ? <img src={o.logo_url} alt="" /> : o.name.charAt(0)}
                            </span>
                            <div className={list.personText}>
                              <span className={list.name}>{o.name}</span>
                              <span className={list.email}>{o.department || 'No department'}</span>
                            </div>
                          </div>
                        </td>
                        <td className={list.roleCell}>
                          <div className={styles.badges}>
                            <span className={`${styles.badge} ${o.is_active ? '' : styles.badgeOff}`}>
                              {o.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {o.can_announce_all && (
                              <span className={`${styles.badge} ${styles.badgeSpecial}`}>
                                Posts to all
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={list.detail} data-label="Members">
                          {o.member_count}
                        </td>
                        <td className={list.detail} data-label="Officers">
                          {o.officer_count}
                        </td>
                        <td className={list.detail} data-label="Advisers">
                          {o.adviser_count}
                        </td>
                        <td className={list.actionCell}>
                          <span className={styles.rowActions}>
                            <button
                              type="button"
                              className={list.rowButton}
                              onClick={() => {
                                setNotice('')
                                setEditing(o)
                              }}
                            >
                              Edit
                              <Pencil size={14} strokeWidth={2.4} aria-hidden="true" />
                            </button>
                            {o.is_active &&
                              (isCurrent ? (
                                <button
                                  type="button"
                                  className={list.rowButton}
                                  onClick={() => handleManage(o)}
                                  title="You are managing this organization"
                                >
                                  <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                                  Managing
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={list.rowButton}
                                  onClick={() => handleManage(o)}
                                  disabled={Boolean(switchingId)}
                                >
                                  {switchingId === o.id ? 'Switching…' : 'Manage'}
                                  <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                              ))}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <OrganizationDialog
          org={editing === 'new' ? null : editing}
          specialOrg={specialOrg}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   Form ng org (bago o ine-edit)
   ------------------------------------------------------------ */
function OrganizationDialog({ org, specialOrg, onSave, onCancel }) {
  const [name, setName] = useState(org?.name ?? '')
  const [department, setDepartment] = useState(org?.department ?? '')
  const [description, setDescription] = useState(org?.description ?? '')
  const [isActive, setIsActive] = useState(org?.is_active ?? true)
  const [canAnnounceAll, setCanAnnounceAll] = useState(org?.can_announce_all ?? false)
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

  const otherSpecial = specialOrg && specialOrg.id !== org?.id ? specialOrg : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) {
      setError('The name must be at least 2 characters.')
      return
    }
    if (org?.is_active && !isActive) {
      const ok = window.confirm(
        `Deactivate ${org.name}? It will be hidden from the landing page and the organization lists. ` +
          'Its members keep their accounts. You can activate it again later.',
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      await onSave({ name, department, description, isActive, canAnnounceAll })
    } catch (err) {
      console.error('Hindi na-save ang org:', err)
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
        aria-labelledby="org-dialog-title"
        onSubmit={handleSubmit}
      >
        <h2 id="org-dialog-title" className={base.heading}>
          {org ? `Edit ${org.name}` : 'New organization'}
        </h2>

        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className={styles.grid2}>
            <label className={base.field}>
              <span className={base.label}>Name</span>
              <input
                ref={firstRef}
                className={base.input}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className={base.field}>
              <span className={base.label}>
                Department <span className={base.optional}>(optional)</span>
              </span>
              <input
                className={base.input}
                value={department}
                maxLength={100}
                placeholder="e.g. CCS, SHS, Tertiary"
                onChange={(e) => setDepartment(e.target.value)}
              />
            </label>
          </div>

          <label className={base.field}>
            <span className={base.labelRow}>
              <span className={base.label}>
                Description <span className={base.optional}>(optional)</span>
              </span>
              <span className={base.counter}>{description.length}/2000</span>
            </span>
            <textarea
              className={`${base.input} ${base.textarea}`}
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked)
                /* Hindi pwedeng special ang inactive */
                if (!e.target.checked) setCanAnnounceAll(false)
              }}
            />
            <span>
              <span className={styles.checkTitle}>Active</span>
              <span className={styles.checkText}>
                Inactive organizations are hidden from the landing page and cannot be chosen for new
                members.
              </span>
            </span>
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={canAnnounceAll}
              disabled={!isActive}
              onChange={(e) => setCanAnnounceAll(e.target.checked)}
            />
            <span>
              <span className={styles.checkTitle}>Can post to all organizations</span>
              <span className={styles.checkText}>
                Its officers and adviser can post announcements for every organization. Only one
                organization can have this
                {otherSpecial ? ` — turning it on removes it from ${otherSpecial.name}.` : '.'}
              </span>
            </span>
          </label>

          {!org && (
            <p className={styles.fieldHint}>
              Add the logo and officer positions in Org Profile after creating it (use “Manage”).
            </p>
          )}
        </fieldset>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={base.primary} disabled={saving}>
            {saving ? 'Saving…' : org ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Organizations
