import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ImagePlus, Pencil, Search, Trash2 } from 'lucide-react'
import { adminErrorMessage, fetchAllOrganizations, saveOrganization } from '../lib/schoolAdmin.js'
import { ACCEPTED_TYPES, ImageError } from '../lib/image.js'
import { orgErrorMessage, removeOrgLogo, uploadOrgLogo } from '../lib/organization.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import OfficerPositions from '../components/OfficerPositions.jsx'
import base from '../components/ProposalForm.module.css'
import list from './Members.module.css'
import styles from './Admin.module.css'
import edit from './OrgEditDialog.module.css'

/* ============================================================
   ORGANIZATIONS — School Administrator lang

   Lahat ng org (pati inactive):
     + New organization → gumawa
     Edit               → LAHAT ng tungkol sa org, sa iisang dialog:
                            Details tab   — logo, pangalan, department,
                                            program, description, active,
                                            at "Post to all organizations"
                            Officer positions tab — ang dating nasa
                                            Org Profile

   Wala nang "Manage" / acting org: hindi na humahawak ang SA ng
   Events, Attendance at Rewards ng kahit anong org
   (SA_REMOVE_ACTING_ORG.sql). Wala na rin ang Org Profile at
   "Managing organization" sa sidebar ng SA — dito na lahat ng
   tungkol sa org. Ang Adviser ay may Org Profile pa rin.

   Walang delete: i-deactivate lang, para hindi mawala ang
   events, proposals at OG history ng org.

   Database: sa_list_organizations(), sa_save_organization()
   — SCHOOL_ADMIN_SUPERADMIN.sql
   Program: ADD_ORG_PROGRAM.sql
   Logo ng kahit anong org: SA_ORG_LOGO_ANY_ORG.sql
   Officer positions ng kahit anong org: SCHOOL_ADMIN_SUPERADMIN.sql (SA 7)
   ============================================================ */

const STATUS_ALL = ''
const STATUS_ACTIVE = 'active'
const STATUS_INACTIVE = 'inactive'

function Organizations() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(STATUS_ALL)

  /* null = sarado, 'new' = bago, { ...org } = ine-edit */
  const [editing, setEditing] = useState(null)

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
      return [o.name, o.department, o.program, o.description]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q))
    })
  }, [orgs, search, status])

  const specialOrg = orgs.find((o) => o.can_announce_all) ?? null

  async function handleSave(values) {
    const isNew = editing === 'new'
    await saveOrganization(isNew ? null : editing.id, values)
    setEditing(null)
    setNotice(
      isNew
        ? `${values.name.trim()} was created. Open “Edit” to add its logo and officer positions.`
        : `${values.name.trim()} was saved.`,
    )
    await load()
  }

  /* Agad nase-save ang logo (hindi hinihintay ang Save), kaya
     ina-update na rin ang table sa likod ng dialog */
  function handleLogoChanged(updated) {
    setOrgs((all) => all.map((o) => (o.id === updated.id ? { ...o, logo_url: updated.logo_url } : o)))
    setEditing((cur) =>
      cur && cur !== 'new' && cur.id === updated.id ? { ...cur, logo_url: updated.logo_url } : cur,
    )
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
                placeholder="Search by name, department, program or description…"
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
                    /* "Information Technology · BSIT" */
                    const subline =
                      [o.department, o.program].filter(Boolean).join(' · ') || 'No department'
                    return (
                      <tr key={o.id} className={o.is_active ? '' : list.inactive}>
                        <td className={list.nameCell}>
                          <div className={list.person}>
                            <span className={styles.logo} aria-hidden="true">
                              {o.logo_url ? <img src={o.logo_url} alt="" /> : o.name.charAt(0)}
                            </span>
                            <div className={list.personText}>
                              <span className={list.name}>{o.name}</span>
                              <span className={list.email}>{subline}</span>
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
          onLogoChanged={handleLogoChanged}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   Dialog ng org (bago o ine-edit)

   Bago   → Details lang (wala pang id, kaya wala pang logo at
            officer positions)
   Edit   → dalawang tab:
              Details           — logo (agad nase-save) + form (Save)
              Officer positions — components/OfficerPositions.jsx;
                                  bawat palit ay agad nase-save
   ------------------------------------------------------------ */
const TAB_DETAILS = 'details'
const TAB_POSITIONS = 'positions'

function OrganizationDialog({ org, specialOrg, onSave, onLogoChanged, onCancel }) {
  const [tab, setTab] = useState(TAB_DETAILS)
  const [name, setName] = useState(org?.name ?? '')
  const [department, setDepartment] = useState(org?.department ?? '')
  const [program, setProgram] = useState(org?.program ?? '')
  const [description, setDescription] = useState(org?.description ?? '')
  const [isActive, setIsActive] = useState(org?.is_active ?? true)
  const [canAnnounceAll, setCanAnnounceAll] = useState(org?.can_announce_all ?? false)
  const [saving, setSaving] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)

  const busy = saving || logoBusy

  useEffect(() => {
    if (tab === TAB_DETAILS) firstRef.current?.focus()
  }, [tab])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

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
      await onSave({ name, department, program, description, isActive, canAnnounceAll })
    } catch (err) {
      console.error('Hindi na-save ang org:', err)
      setError(adminErrorMessage(err))
      setSaving(false)
    }
  }

  const cancelButton = (
    <button type="button" className={base.secondary} onClick={onCancel} disabled={busy}>
      {tab === TAB_POSITIONS ? 'Close' : 'Cancel'}
    </button>
  )

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal} ${org ? edit.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-dialog-title"
      >
        <h2 id="org-dialog-title" className={base.heading}>
          {org ? `Edit ${org.name}` : 'New organization'}
        </h2>

        {org && (
          <div className={edit.tabs} role="tablist" aria-label="Organization settings">
            <button
              type="button"
              role="tab"
              id="org-tab-details"
              aria-selected={tab === TAB_DETAILS}
              aria-controls="org-panel"
              className={`${edit.tab} ${tab === TAB_DETAILS ? edit.tabActive : ''}`}
              onClick={() => setTab(TAB_DETAILS)}
              disabled={busy}
            >
              Details
            </button>
            <button
              type="button"
              role="tab"
              id="org-tab-positions"
              aria-selected={tab === TAB_POSITIONS}
              aria-controls="org-panel"
              className={`${edit.tab} ${tab === TAB_POSITIONS ? edit.tabActive : ''}`}
              onClick={() => setTab(TAB_POSITIONS)}
              disabled={busy}
            >
              Officer positions
            </button>
          </div>
        )}

        <div
          id="org-panel"
          role={org ? 'tabpanel' : undefined}
          aria-labelledby={org ? (tab === TAB_DETAILS ? 'org-tab-details' : 'org-tab-positions') : undefined}
        >
          {tab === TAB_POSITIONS && org ? (
            <>
              <OfficerPositions orgId={org.id} embedded className={edit.positions} />
              <div className={`${base.actions} ${edit.footer}`}>{cancelButton}</div>
            </>
          ) : (
            <>
              {org && (
                <LogoField
                  org={org}
                  disabled={saving}
                  onBusyChange={setLogoBusy}
                  onChanged={onLogoChanged}
                />
              )}

              <form onSubmit={handleSubmit}>
                <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
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

                  <div className={styles.grid2}>
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

                    <label className={base.field}>
                      <span className={base.label}>
                        Program <span className={base.optional}>(optional)</span>
                      </span>
                      <input
                        className={base.input}
                        value={program}
                        maxLength={100}
                        placeholder="e.g. BSIT, BSHM, BSTM"
                        onChange={(e) => setProgram(e.target.value)}
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
                      placeholder="What the organization is, its purpose, and who it is for."
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
                        Inactive organizations are hidden from the landing page and cannot be chosen
                        for new members.
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
                        Its officers and adviser can post announcements for every organization. Only
                        one organization can have this
                        {otherSpecial ? ` — turning it on removes it from ${otherSpecial.name}.` : '.'}
                      </span>
                    </span>
                  </label>

                  {!org && (
                    <p className={styles.fieldHint}>
                      After creating it, open “Edit” to add the logo and officer positions.
                    </p>
                  )}
                </fieldset>

                {error && <p className={base.error}>{error}</p>}

                <div className={base.actions}>
                  {cancelButton}
                  <button type="submit" className={base.primary} disabled={busy}>
                    {saving ? 'Saving…' : org ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Logo ng org — galing sa dating Org Profile.
   Agad nase-save sa pagpili ng file (hindi na hinihintay ang Save).
   ------------------------------------------------------------ */
function LogoField({ org, disabled, onBusyChange, onChanged }) {
  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(null) // null | 'upload' | 'remove'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [failedUrl, setFailedUrl] = useState(null)

  function start(kind) {
    setError('')
    setMessage('')
    setBusy(kind)
    onBusyChange(true)
  }

  function finish() {
    setBusy(null)
    onBusyChange(false)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    start('upload')
    try {
      onChanged(await uploadOrgLogo(org.id, file))
      setMessage('Logo updated.')
    } catch (err) {
      console.error('Hindi na-upload ang logo:', err)
      setError(err instanceof ImageError ? err.message : orgErrorMessage(err))
    } finally {
      finish()
    }
  }

  async function handleRemove() {
    if (!window.confirm(`Remove the logo of ${org.name}?`)) return

    start('remove')
    try {
      onChanged(await removeOrgLogo(org.id))
      setMessage('Logo removed.')
    } catch (err) {
      console.error('Hindi naalis ang logo:', err)
      setError(orgErrorMessage(err))
    } finally {
      finish()
    }
  }

  const showImage = Boolean(org.logo_url) && failedUrl !== org.logo_url
  const initials = org.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className={edit.logoField}>
      <span className={edit.logoPreview}>
        {showImage ? (
          <img src={org.logo_url} alt={`${org.name} logo`} onError={() => setFailedUrl(org.logo_url)} />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
        {busy && <span className={edit.spinner} aria-hidden="true" />}
      </span>

      <div className={edit.logoBody}>
        <span className={base.label}>Logo</span>
        <div className={edit.logoActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFile}
            hidden
          />
          <button
            type="button"
            className={edit.logoButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || Boolean(busy)}
          >
            <ImagePlus size={15} strokeWidth={2.3} aria-hidden="true" />
            {busy === 'upload' ? 'Uploading…' : org.logo_url ? 'Change logo' : 'Upload logo'}
          </button>
          {org.logo_url && (
            <button
              type="button"
              className={`${edit.logoButton} ${edit.logoRemove}`}
              onClick={handleRemove}
              disabled={disabled || Boolean(busy)}
            >
              <Trash2 size={14} strokeWidth={2.3} aria-hidden="true" />
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
        {error ? (
          <p className={edit.error} role="alert">
            {error}
          </p>
        ) : message ? (
          <p className={edit.message} role="status">
            {message}
          </p>
        ) : (
          <p className={edit.hint}>JPG, PNG or WEBP · up to 10 MB · saved right away</p>
        )}
      </div>
    </div>
  )
}

export default Organizations
