import { useCallback, useEffect, useRef, useState } from 'react'
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
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import OfficerPositions from '../components/OfficerPositions.jsx'
import styles from './OrgProfile.module.css'

/* ============================================================
   ORG PROFILE — para sa Adviser

   Ang organisasyong hawak ng Adviser (profiles.organization_id).
   Nababago: Name, Description, Logo
   Hindi nababago: Department (IT Administrator ang may hawak)

   Sa ilalim nito ang OFFICER POSITIONS — ang listahan ng
   position ng org (President, VP, atbp.). Tingnan ang
   components/OfficerPositions.jsx.

   Pagkatapos palitan ang pangalan, tinatawag ang
   refreshProfile() para magbago rin ito sa Sidebar at
   Dashboard (galing doon ang profile.organizations.name).
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
  const [logoFailed, setLogoFailed] = useState(null)

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

  async function handleLogoRemove() {
    if (!window.confirm("Remove the organization's logo?")) return

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
      subtitle="Information about the organization you manage."
      action={org && !editing && <ActionButton onClick={startEdit}>Edit</ActionButton>}
    />
  )

  if (!orgId) {
    return (
      <>
        {header}
        <EmptyState
          icon="◈"
          title="You have no organization"
          message="You are not assigned to an organization yet. Please contact the SAO or IT Administrator."
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
    <>
      {header}

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <div className={styles.card}>
        {/* ---------- LOGO ---------- */}
        <div className={styles.logoSection}>
          <div className={styles.logoWrap}>
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
          </div>

          <div className={styles.logoActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleLogoChange}
              hidden
            />
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(logoBusy)}
            >
              {logoBusy === 'upload'
                ? 'Uploading…'
                : org.logo_url
                  ? 'Change logo'
                  : 'Upload logo'}
            </button>
            {org.logo_url && (
              <button
                type="button"
                className={`${styles.smallButton} ${styles.danger}`}
                onClick={handleLogoRemove}
                disabled={Boolean(logoBusy)}
              >
                {logoBusy === 'remove' ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>

          {logoError ? (
            <p className={styles.error} role="alert">
              {logoError}
            </p>
          ) : (
            <p className={styles.hint}>JPG, PNG or WEBP · up to 10 MB</p>
          )}
        </div>

        {/* ---------- DETALYE ---------- */}
        {editing ? (
          <form className={styles.details} onSubmit={handleSave}>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                className={styles.input}
                value={name}
                maxLength={NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Department</span>
              <input
                className={styles.input}
                value={org.department ?? '—'}
                disabled
                readOnly
              />
              <span className={styles.hint}>
                This can't be changed here. Please contact the IT Administrator.
              </span>
            </label>

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
          <dl className={styles.details}>
            <div className={styles.row}>
              <dt className={styles.label}>Name</dt>
              <dd className={styles.nameValue}>{org.name}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>Department</dt>
              <dd className={styles.value}>{org.department || '—'}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>Description</dt>
              <dd className={org.description ? styles.description : styles.empty}>
                {org.description || 'No description yet.'}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <OfficerPositions orgId={org.id} />
    </>
  )
}

export default OrgProfile
