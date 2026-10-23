import { useEffect, useRef, useState } from 'react'
import {
  ANNOUNCEMENT_TYPES,
  AUDIENCES,
  MESSAGE_MAX,
  TITLE_MAX,
  audienceOf,
  fetchTargetOrganizations,
  selectedOrgsLabel,
} from '../lib/announcements.js'
import styles from './AnnouncementForm.module.css'

/* ============================================================
   ANNOUNCEMENT FORM — modal para sa GUMAWA at MAG-EDIT

   Iisang form para sa dalawa:
     initial = null      → bagong announcement
     initial = { ... }   → ine-edit ang dati

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values) — ang page ang tatawag sa database.
   Kapag nag-throw ang onSubmit, dito lalabas ang error.

   audience — para kanino ang BAGONG post:
     'own'    → sariling org lang (walang pagpipilian)
     'choose' → may pagpipilian: sariling org, lahat ng org, o
                mga piniling org (Officer/Adviser ng org na may
                can_announce_all). Kailangan ang ownOrgId para
                hindi isama ang sariling org sa listahan.
   Kapag nag-e-edit, hindi na mababago kung para kanino.
   ============================================================ */
function AnnouncementForm({ initial, audience = 'own', ownOrgId, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState(initial?.type ?? 'meeting')
  const [message, setMessage] = useState(initial?.message ?? '')
  const [postTo, setPostTo] = useState('own')
  const [orgIds, setOrgIds] = useState([])
  const [orgOptions, setOrgOptions] = useState(null) // null = kinukuha pa
  const [orgLoadError, setOrgLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  /* Listahan ng org para sa "Selected organizations" */
  const canChoose = !isEdit && audience === 'choose'
  useEffect(() => {
    if (!canChoose) return undefined
    let active = true
    fetchTargetOrganizations(ownOrgId)
      .then((list) => active && setOrgOptions(list))
      .catch((err) => {
        console.error('Hindi makuha ang mga org:', err)
        if (active) setOrgLoadError(true)
      })
    return () => {
      active = false
    }
  }, [canChoose, ownOrgId])

  function toggleOrg(id) {
    setOrgIds((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    )
  }

  /* Esc para isara — pero hindi habang nagse-save */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cleanTitle = title.trim()
    const cleanMessage = message.trim()

    if (!cleanTitle || !cleanMessage) {
      setError('Title and message are required.')
      return
    }

    if (canChoose && postTo === 'selected' && orgIds.length === 0) {
      setError('Choose at least one organization.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        title: cleanTitle,
        message: cleanMessage,
        type,
        audience: canChoose ? postTo : 'own',
        orgIds: canChoose && postTo === 'selected' ? orgIds : [],
      })
    } catch (err) {
      console.error('Hindi na-save ang announcement:', err)
      setError(
        err?.message === 'not-allowed'
          ? "You don't have permission to change this announcement."
          : 'Could not save. Please try again.',
      )
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={styles.modal}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-form-title"
      >
        <h2 id="announcement-form-title" className={styles.heading}>
          {isEdit ? 'Edit announcement' : 'New announcement'}
        </h2>

        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input
            ref={titleRef}
            className={styles.input}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        {canChoose && (
          <label className={styles.field}>
            <span className={styles.label}>Post to</span>
            <select
              className={styles.input}
              value={postTo}
              onChange={(e) => setPostTo(e.target.value)}
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {canChoose && postTo === 'selected' && (
          <fieldset className={styles.field}>
            <legend className={styles.labelRow}>
              <span className={styles.label}>Organizations</span>
              <span className={styles.counter}>{orgIds.length} selected</span>
            </legend>
            {orgLoadError && (
              <p className={styles.error}>Could not load organizations.</p>
            )}
            {!orgLoadError && orgOptions === null && (
              <p className={styles.counter}>Loading organizations…</p>
            )}
            {orgOptions && (
              <div className={styles.orgList}>
                {orgOptions.map((o) => (
                  <label key={o.id} className={styles.orgOption}>
                    <input
                      type="checkbox"
                      checked={orgIds.includes(o.id)}
                      onChange={() => toggleOrg(o.id)}
                    />
                    <span>{o.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className={styles.counter}>
              Your organization will also see this.
            </p>
          </fieldset>
        )}

        {isEdit && audienceOf(initial) === 'all' && (
          <p className={styles.hint}>
            This announcement is visible to all organizations.
          </p>
        )}

        {isEdit && audienceOf(initial) === 'selected' && (
          <p className={styles.hint}>
            Visible to: {selectedOrgsLabel(initial)}
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Type</span>
          <select
            className={styles.input}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ANNOUNCEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>Message</span>
            <span className={styles.counter}>
              {message.length} / {MESSAGE_MAX}
            </span>
          </span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            required
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AnnouncementForm
