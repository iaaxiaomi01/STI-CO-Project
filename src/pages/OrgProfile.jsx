import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Camera, GraduationCap, ImagePlus, Lock, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { ACCEPTED_TYPES, ImageError } from '../lib/image.js'
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  NAME_MIN,
  fetchOrganization,
  orgErrorMessage,
  removeOrgLogo,
  updateOrganizationDetails,
  uploadOrgLogo,
} from '../lib/organization.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import OfficerPositions from '../components/OfficerPositions.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import styles from './OrgProfile.module.css'

/* ============================================================
   ORG PROFILE — para sa Adviser

   Ang organisasyong hawak ng Adviser (profiles.organization_id).
   Nababago: Name, Description, Logo
   Hindi nababago: Department at Program — ang School
   Administrator ang nagpapalit sa Organizations page
   (ADD_ORG_PROGRAM.sql)

   Sa ilalim nito ang OFFICER POSITIONS — ang listahan ng
   position ng org (President, VP, atbp.). Tingnan ang
   components/OfficerPositions.jsx.

   Pagkatapos palitan ang pangalan, tinatawag ang
   refreshProfile() para magbago rin ito sa Sidebar at
   Dashboard (galing doon ang profile.organizations.name).

   ITSURA ("Banner" — UI lang, walang binago sa data):
     Makulay na banner (navy → royal blue, may abstract na hugis):
     logo sa loob ng puting frame (may camera button sa sulok,
     parang profile pic — doon pinapalitan o inaalis ang logo),
     pangalan, at Department/Program bilang may-kulay na chip.
     Sa ilalim: ang Description (o ang Edit form kapag nag-e-edit).
     Sariling Edit button ng page na ito (hindi ActionButton).
   ============================================================ */
function OrgProfile() {
  const { profile, refreshProfile } = useAuth()
  const orgId = profile?.organization_id ?? null

  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState('')

  /* Edit ng Name at Description */
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  /* Logo */
  const fileInputRef = useRef(null)
  const [logoBusy, setLogoBusy] = useState(null) // null | 'upload' | 'remove'
  const [logoError, setLogoError] = useState('')
  /* true habang bukas ang "Remove the organization's logo?" na dialog */
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [logoFailed, setLogoFailed] = useState(null)

  /* Menu ng camera button sa logo (parang profile pic sa FB) */
  const [logoMenuOpen, setLogoMenuOpen] = useState(false)
  const logoAreaRef = useRef(null)
  const cameraRef = useRef(null)
  const logoMenuRef = useRef(null)

  function closeLogoMenu(focusCamera = true) {
    setLogoMenuOpen(false)
    if (focusCamera) cameraRef.current?.focus()
  }

  useEffect(() => {
    if (!logoMenuOpen) return
    /* Unang pagpipilian ang naka-focus pagbukas */
    logoMenuRef.current?.querySelector('[role="menuitem"]')?.focus()

    function onDown(e) {
      if (!logoAreaRef.current?.contains(e.target)) setLogoMenuOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setLogoMenuOpen(false)
        cameraRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [logoMenuOpen])

  /* ↑ ↓ sa loob ng menu */
  function onLogoMenuKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...logoMenuRef.current.querySelectorAll('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }
    try {
      setOrg(await fetchOrganization(orgId))
      setLoadError(null)
    } catch (err) {
      console.error('Hindi makuha ang organisasyon:', err)
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    setName(org.name ?? '')
    setDescription(org.description ?? '')
    setFormError('')
    setNotice('')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setFormError('')

    const cleanName = name.trim()
    if (cleanName.length < NAME_MIN) {
      setFormError(`The name must be ${NAME_MIN} to ${NAME_MAX} characters.`)
      return
    }

    setSaving(true)
    try {
      const updated = await updateOrganizationDetails(org.id, { name: cleanName, description })
      setOrg(updated)
      setEditing(false)
      setNotice('Org Profile saved.')
      await refreshProfile()
    } catch (err) {
      console.error('Hindi na-save ang Org Profile:', err)
      setFormError(orgErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setLogoError('')
    setNotice('')
    setLogoBusy('upload')
    try {
      setOrg(await uploadOrgLogo(org.id, file))
      setNotice('Logo updated.')
    } catch (err) {
      console.error('Hindi na-upload ang logo:', err)
      setLogoError(err instanceof ImageError ? err.message : orgErrorMessage(err))
    } finally {
      setLogoBusy(null)
    }
  }

  /* Tinatawag ng ConfirmDialog pagkapindot ng "Remove"
     (kapalit ng window.confirm() ng browser). Sarado ang dialog
     pagkatapos; kapag pumalya, sa ilalim ng logo ang error. */
  async function handleLogoRemove() {

    setLogoError('')
    setNotice('')
    setLogoBusy('remove')
    try {
      setOrg(await removeOrgLogo(org.id))
      setNotice('Logo removed.')
    } catch (err) {
      console.error('Hindi naalis ang logo:', err)
      setLogoError(orgErrorMessage(err))
    } finally {
      setLogoBusy(null)
    }
  }

  /* ---------- mga estado bago ang laman ---------- */

  const header = (
    <PageHeader
      title="Org Profile"
      action={
        org &&
        !editing && (
          <button type="button" className={styles.editButton} onClick={startEdit}>
            <span className={styles.editIcon} aria-hidden="true">
              <Pencil size={15} strokeWidth={2.6} />
            </span>
            Edit
          </button>
        )
      }
    />
  )

  if (!orgId) {
    return (
      <>
        {header}
        <EmptyState
          icon="◈"
          title="You have no organization"
          message="You are not assigned to an organization yet. Please contact the School Administrator."
        />
      </>
    )
  }

  if (loading) {
    return (
      <>
        {header}
        <p className={styles.status}>Loading Org Profile…</p>
      </>
    )
  }

  if (loadError || !org) {
    return (
      <>
        {header}
        <EmptyState
          icon="!"
          title="Could not load Org Profile"
          message="There was a problem connecting to the database. Please try again later."
        />
      </>
    )
  }

  /* ---------- laman ---------- */

  const showLogo = Boolean(org.logo_url) && logoFailed !== org.logo_url
  const initials = org.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className={styles.page}>
      {header}

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <section className={styles.profile}>
        {/* ---------- BANNER ---------- */}
        <div className={styles.banner}>
          <span className={styles.shapes} aria-hidden="true" />

          <div className={styles.logoWrap} ref={logoAreaRef}>
            <div className={styles.logo}>
              {showLogo ? (
                <img
                  src={org.logo_url}
                  alt={`${org.name} logo`}
                  className={styles.logoImage}
                  onError={() => setLogoFailed(org.logo_url)}
                />
              ) : (
                <span className={styles.logoInitials} aria-hidden="true">
                  {initials}
                </span>
              )}
            </div>
            {logoBusy && <span className={styles.logoBusy} aria-hidden="true" />}

            {/* Camera button — dito pinapalitan o inaalis ang logo */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleLogoChange}
              hidden
            />
            <button
              ref={cameraRef}
              type="button"
              className={styles.camera}
              aria-label={org.logo_url ? 'Change logo' : 'Upload logo'}
              aria-haspopup="menu"
              aria-expanded={logoMenuOpen}
              aria-controls={logoMenuOpen ? 'org-logo-menu' : undefined}
              onClick={() => (logoMenuOpen ? closeLogoMenu() : setLogoMenuOpen(true))}
              disabled={Boolean(logoBusy)}
            >
              <Camera size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>

            {logoMenuOpen && (
              <div
                ref={logoMenuRef}
                id="org-logo-menu"
                role="menu"
                aria-label="Logo"
                className={styles.logoMenu}
                onKeyDown={onLogoMenuKey}
              >
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    closeLogoMenu(false)
                    fileInputRef.current?.click()
                  }}
                >
                  <ImagePlus size={16} strokeWidth={2.3} aria-hidden="true" />
                  {org.logo_url ? 'Change logo' : 'Upload logo'}
                </button>
                {org.logo_url && (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    onClick={() => {
                      closeLogoMenu(false)
                      setConfirmingRemove(true)
                    }}
                  >
                    <Trash2 size={15} strokeWidth={2.3} aria-hidden="true" />
                    Remove
                  </button>
                )}
                <p className={styles.menuHint}>JPG, PNG or WEBP · up to 10 MB</p>
              </div>
            )}
          </div>

          <div className={styles.identity}>
            <span className={styles.eyebrow}>Name</span>
            <h2 className={styles.name}>{org.name}</h2>
            <div className={styles.chips}>
              <span className={`${styles.chip} ${styles.chipDept}`}>
                <Building2 size={15} strokeWidth={2.4} aria-hidden="true" />
                <span className={styles.chipLabel}>Department</span>
                {org.department || '—'}
              </span>
              <span className={`${styles.chip} ${styles.chipProgram}`}>
                <GraduationCap size={15} strokeWidth={2.4} aria-hidden="true" />
                <span className={styles.chipLabel}>Program</span>
                {org.program || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ---------- KALAGAYAN NG LOGO (nag-a-upload / error) ---------- */}
        {logoError ? (
          <p className={`${styles.logoStatus} ${styles.logoStatusError}`} role="alert">
            {logoError}
          </p>
        ) : (
          logoBusy && (
            <p className={styles.logoStatus} role="status">
              {logoBusy === 'upload' ? 'Uploading…' : 'Removing…'}
            </p>
          )
        )}

        {/* ---------- DESCRIPTION o EDIT FORM ---------- */}
        {editing ? (
          <form className={styles.form} onSubmit={handleSave}>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                className={`${styles.input} ${styles.nameInput}`}
                value={name}
                maxLength={NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </label>

            {/* Department at Program — hindi nababago dito */}
            <div className={styles.lockedRow}>
              <label className={styles.field}>
                <span className={styles.label}>Department</span>
                <span className={styles.locked}>
                  <Lock size={14} strokeWidth={2.4} aria-hidden="true" />
                  <input
                    className={styles.lockedInput}
                    value={org.department ?? '—'}
                    disabled
                    readOnly
                  />
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Program</span>
                <span className={styles.locked}>
                  <Lock size={14} strokeWidth={2.4} aria-hidden="true" />
                  <input
                    className={styles.lockedInput}
                    value={org.program ?? '—'}
                    disabled
                    readOnly
                  />
                </span>
              </label>
            </div>
            <span className={styles.lockedHint}>
              The Department and Program can't be changed here. The School Administrator can
              change them in Organizations.
            </span>

            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span className={styles.label}>Description</span>
                <span className={styles.counter}>
                  {description.length} / {DESCRIPTION_MAX}
                </span>
              </span>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="What the organization is, its purpose, and who it is for."
              />
            </label>

            {formError && (
              <p className={styles.formError} role="alert">
                {formError}
              </p>
            )}

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.about}>
            <span className={styles.label}>Description</span>
            <p className={org.description ? styles.description : styles.empty}>
              {org.description || 'No description yet.'}
            </p>
          </div>
        )}
      </section>

      <OfficerPositions orgId={org.id} />

      {confirmingRemove && (
        <ConfirmDialog
          tone="danger"
          title="Remove the organization's logo?"
          confirmLabel="Remove"
          busyLabel="Removing…"
          onConfirm={async () => {
            await handleLogoRemove()
            setConfirmingRemove(false)
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  )
}

export default OrgProfile