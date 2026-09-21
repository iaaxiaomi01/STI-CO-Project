import { useEffect, useRef, useState } from 'react'
import {
  ANNOUNCEMENT_TYPES,
  MESSAGE_MAX,
  TITLE_MAX,
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
   ============================================================ */
function AnnouncementForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState(initial?.type ?? 'general')
  const [message, setMessage] = useState(initial?.message ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

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
      setError('Kailangan ang title at message.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({ title: cleanTitle, message: cleanMessage, type })
    } catch (err) {
      console.error('Hindi na-save ang announcement:', err)
      setError(
        err?.message === 'not-allowed'
          ? 'Wala kang pahintulot na baguhin ang announcement na ito.'
          : 'Hindi na-save. Subukan ulit.',
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
          {isEdit ? 'I-edit ang announcement' : 'Bagong announcement'}
        </h2>

        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input
            ref={titleRef}
            className={styles.input}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="hal. General Assembly sa Biyernes"
            required
          />
        </label>

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
            Kanselahin
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? 'Sine-save…' : isEdit ? 'I-save ang pagbabago' : 'I-post'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AnnouncementForm
