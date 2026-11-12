import { useEffect, useRef, useState } from 'react'
import { Check, ClipboardList, ImagePlus, Megaphone, Power, Trash2, Users } from 'lucide-react'
import { adminErrorMessage } from '../lib/schoolAdmin.js'
import { ACCEPTED_TYPES, ImageError } from '../lib/image.js'
import { orgErrorMessage, removeOrgLogo, uploadOrgLogo } from '../lib/organization.js'
import OfficerPositions from './OfficerPositions.jsx'
import styles from '../pages/OrgEditDialog.module.css'

/* ============================================================
   EDIT ORGANIZATION — dialog ng "Edit" sa Organizations page
   (School Administrator)

   Inilipat mula sa pages/Organizations.jsx (dating
   OrganizationDialog at LogoField). Pareho ang laman at logic:
     Kaliwa  — logo (agad nase-save), pangalan, status, at ang
               dalawang tab: Details · Officer positions
     Kanan   — Details: Name, Department, Program, Description,
               Active, Can post to all organizations → Save
               Officer positions: components/OfficerPositions.jsx
               (embedded; bawat palit ay agad nase-save)

   Itsura: pages/OrgEditDialog.module.css (kasama ang itsura ng
   Officer positions DITO — .positions). Hindi nito binabago ang
   Org Profile ng Adviser.
   ============================================================ */
const TAB_DETAILS = 'details'
const TAB_POSITIONS = 'positions'

function EditOrganizationDialog({ org, specialOrg, onSave, onLogoChanged, onCancel }) {
  const [tab, setTab] = useState(TAB_DETAILS)
  const [name, setName] = useState(org.name ?? '')
  const [department, setDepartment] = useState(org.department ?? '')
  const [program, setProgram] = useState(org.program ?? '')
  const [description, setDescription] = useState(org.description ?? '')
  const [isActive, setIsActive] = useState(org.is_active ?? true)
  const [canAnnounceAll, setCanAnnounceAll] = useState(org.can_announce_all ?? false)
  const [saving, setSaving] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)
  const errorRef = useRef(null)

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

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [error])

  const otherSpecial = specialOrg && specialOrg.id !== org.id ? specialOrg : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) {
      setError('The name must be at least 2 characters.')
      return
    }
    if (org.is_active && !isActive) {
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

  const tabs = [
    { key: TAB_DETAILS, label: 'Details', icon: ClipboardList },
    { key: TAB_POSITIONS, label: 'Officer positions', icon: Users },
  ]

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-org-title"
      >
        {/* ---------------- KALIWA: pagkakakilanlan ---------------- */}
        <aside className={styles.side}>
          <LogoField
            org={org}
            disabled={saving}
            onBusyChange={setLogoBusy}
            onChanged={onLogoChanged}
          />

          <h2 id="edit-org-title" className={styles.title}>
            <span className={styles.titleVerb}>Edit</span>
            <span className={styles.titleName}>{org.name}</span>
          </h2>

          <div className={styles.badges}>
            <span className={`${styles.badge} ${org.is_active ? styles.badgeOn : styles.badgeOff}`}>
              {org.is_active ? 'Active' : 'Inactive'}
            </span>
            {org.can_announce_all && (
              <span className={`${styles.badge} ${styles.badgeSpecial}`}>Posts to all</span>
            )}
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Organization settings" aria-orientation="vertical">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`edit-org-tab-${key}`}
                aria-selected={tab === key}
                aria-controls="edit-org-panel"
                className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
                onClick={() => setTab(key)}
                disabled={busy}
              >
                <Icon size={17} strokeWidth={2.3} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </aside>

        {/* ---------------- KANAN: laman ng tab ---------------- */}
        <div
          id="edit-org-panel"
          role="tabpanel"
          aria-labelledby={`edit-org-tab-${tab}`}
          className={styles.main}
        >
          {tab === TAB_POSITIONS ? (
            <>
              <div className={styles.scroll}>
                <OfficerPositions orgId={org.id} embedded className={styles.positions} />
              </div>
              <footer className={styles.foot}>
                <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
                  Close
                </button>
              </footer>
            </>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.scroll}>
                <fieldset className={styles.fields} disabled={busy}>
                  <label className={styles.box}>
                    <span className={styles.boxLabel}>Name</span>
                    <input
                      ref={firstRef}
                      className={`${styles.boxInput} ${styles.nameInput}`}
                      value={name}
                      maxLength={100}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </label>

                  <div className={styles.pair}>
                    <label className={styles.box}>
                      <span className={styles.boxLabel}>
                        Department <span className={styles.optional}>(optional)</span>
                      </span>
                      <input
                        className={styles.boxInput}
                        value={department}
                        maxLength={100}
                        placeholder="e.g. CCS, SHS, Tertiary"
                        onChange={(e) => setDepartment(e.target.value)}
                      />
                    </label>

                    <label className={styles.box}>
                      <span className={styles.boxLabel}>
                        Program <span className={styles.optional}>(optional)</span>
                      </span>
                      <input
                        className={styles.boxInput}
                        value={program}
                        maxLength={100}
                        placeholder="e.g. BSIT, BSHM, BSTM"
                        onChange={(e) => setProgram(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className={styles.box}>
                    <span className={`${styles.boxLabel} ${styles.boxLabelRow}`}>
                      <span>
                        Description <span className={styles.optional}>(optional)</span>
                      </span>
                      <span className={styles.counter}>{description.length}/2000</span>
                    </span>
                    <textarea
                      className={`${styles.boxInput} ${styles.textarea}`}
                      value={description}
                      maxLength={2000}
                      placeholder="What the organization is, its purpose, and who it is for."
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>

                  <div className={styles.options}>
                    <label className={`${styles.option} ${styles.optionActive}`}>
                      <input
                        type="checkbox"
                        className={styles.optionInput}
                        checked={isActive}
                        onChange={(e) => {
                          setIsActive(e.target.checked)
                          /* Hindi pwedeng special ang inactive */
                          if (!e.target.checked) setCanAnnounceAll(false)
                        }}
                      />
                      <span className={styles.optionHead}>
                        <span className={styles.optionIcon} aria-hidden="true">
                          <Power size={16} strokeWidth={2.4} />
                        </span>
                        <span className={styles.optionTitle}>Active</span>
                        <span className={styles.optionMark} aria-hidden="true">
                          <Check size={13} strokeWidth={3.4} />
                        </span>
                      </span>
                      <span className={styles.optionText}>
                        Inactive organizations are hidden from the landing page and cannot be
                        chosen for new members.
                      </span>
                    </label>

                    <label className={`${styles.option} ${styles.optionSpecial}`}>
                      <input
                        type="checkbox"
                        className={styles.optionInput}
                        checked={canAnnounceAll}
                        disabled={!isActive}
                        onChange={(e) => setCanAnnounceAll(e.target.checked)}
                      />
                      <span className={styles.optionHead}>
                        <span className={styles.optionIcon} aria-hidden="true">
                          <Megaphone size={16} strokeWidth={2.4} />
                        </span>
                        <span className={styles.optionTitle}>Can post to all organizations</span>
                        <span className={styles.optionMark} aria-hidden="true">
                          <Check size={13} strokeWidth={3.4} />
                        </span>
                      </span>
                      <span className={styles.optionText}>
                        Its officers and adviser can post announcements for every organization.
                        Only one organization can have this
                        {otherSpecial ? ` — turning it on removes it from ${otherSpecial.name}.` : '.'}
                      </span>
                    </label>
                  </div>
                </fieldset>

                {error && (
                  <p ref={errorRef} className={styles.error} role="alert">
                    {error}
                  </p>
                )}
              </div>

              <footer className={styles.foot}>
                <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className={styles.save} disabled={busy}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Logo ng org — agad nase-save sa pagpili ng file (hindi na
   hinihintay ang Save). Inilipat mula sa pages/Organizations.jsx.
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
    <div className={styles.logoField}>
      <span className={`${styles.logo} ${busy ? styles.logoBusy : ''}`}>
        {showImage ? (
          <img src={org.logo_url} alt={`${org.name} logo`} onError={() => setFailedUrl(org.logo_url)} />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </span>

      <div className={styles.logoBody}>
        <span className={styles.logoLabel}>Logo</span>
        <div className={styles.logoActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFile}
            hidden
          />
          <button
            type="button"
            className={styles.logoButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || Boolean(busy)}
          >
            <ImagePlus size={15} strokeWidth={2.3} aria-hidden="true" />
            {busy === 'upload' ? 'Uploading…' : org.logo_url ? 'Change logo' : 'Upload logo'}
          </button>
          {org.logo_url && (
            <button
              type="button"
              className={styles.logoRemove}
              onClick={handleRemove}
              disabled={disabled || Boolean(busy)}
            >
              <Trash2 size={14} strokeWidth={2.3} aria-hidden="true" />
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
        {error ? (
          <p className={styles.logoError} role="alert">
            {error}
          </p>
        ) : message ? (
          <p className={styles.logoMessage} role="status">
            {message}
          </p>
        ) : (
          <p className={styles.logoHint}>JPG or PNG · up to 10 MB </p>
        )}
      </div>
    </div>
  )
}

export default EditOrganizationDialog
