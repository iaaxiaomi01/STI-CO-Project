import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  EVENT_STATUSES,
  LOCATION_MAX,
  TITLE_MAX,
  eventErrorMessage,
  toTimeInput,
} from '../lib/events.js'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
import base from './ProposalForm.module.css'
import styles from './EventForm.module.css'

/* ============================================================
   EVENT FORM — modal para sa GUMAWA at MAG-EDIT ng event

   Gumawa  → may `proposal`: kinukuha sa proposal ang panimulang
             Title at Description (pwede pang baguhin)
   Edit    → may `initial`: ang kasalukuyang event

   Laman: Status, Title, Description, Date, Start Time,
          End Time, Location, Picture (optional)

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { imageFile, removeImage }).
   ============================================================ */
function EventForm({ initial = null, proposal = null, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [status, setStatus] = useState(initial?.status ?? 'upcoming')
  const [title, setTitle] = useState(initial?.title ?? proposal?.title ?? '')
  const [description, setDescription] = useState(
    initial?.description ?? proposal?.description ?? '',
  )
  const [eventDate, setEventDate] = useState(initial?.event_date ?? '')
  const [startTime, setStartTime] = useState(toTimeInput(initial?.start_time))
  const [endTime, setEndTime] = useState(toTimeInput(initial?.end_time))
  const [location, setLocation] = useState(initial?.location ?? '')

  /* Picture: ang bagong pinili (file + preview), o ang dati */
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(initial?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  /* Linisin ang object URL ng preview kapag napalitan o nagsara */
  useEffect(() => {
    if (!imageFile) return undefined
    const url = URL.createObjectURL(imageFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function handlePickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      checkImageFile(file)
      setError('')
      setImageFile(file)
      setRemoveImage(false)
    } catch (err) {
      setError(err instanceof ImageError ? err.message : 'Hindi mabasa ang larawan.')
    }
  }

  function handleRemoveImage() {
    setImageFile(null)
    setPreview(null)
    setRemoveImage(Boolean(initial?.image_url))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const clean = {
      status,
      title: title.trim(),
      description: description.trim(),
      eventDate,
      startTime,
      endTime,
      location: location.trim(),
    }

    if (
      !clean.title ||
      !clean.description ||
      !clean.eventDate ||
      !clean.startTime ||
      !clean.endTime ||
      !clean.location
    ) {
      setError('Kailangan ang lahat ng field maliban sa Picture.')
      return
    }

    if (clean.endTime <= clean.startTime) {
      setError('Dapat mas huli ang End Time kaysa sa Start Time.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean, { imageFile, removeImage })
    } catch (err) {
      console.error('Hindi na-save ang event:', err)
      setError(eventErrorMessage(err))
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
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
      >
        <h2 id="event-form-title" className={base.heading}>
          {isEdit ? 'I-edit ang event' : 'Gumawa ng event'}
        </h2>

        {proposal && (
          <p className={base.note}>
            Mula sa approved na proposal: <strong>{proposal.title}</strong>
          </p>
        )}

        {/* ---------- STATUS ---------- */}
        <fieldset className={styles.fieldset}>
          <legend className={base.label}>Status</legend>
          <div className={styles.statusGroup}>
            {EVENT_STATUSES.map((s) => (
              <label
                key={s.value}
                className={`${styles.statusOption} ${
                  status === s.value ? styles[`active_${s.value}`] : ''
                }`}
              >
                <input
                  type="radio"
                  name="event-status"
                  value={s.value}
                  checked={status === s.value}
                  onChange={() => setStatus(s.value)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* ---------- TITLE ---------- */}
        <label className={base.field}>
          <span className={base.label}>Title</span>
          <input
            ref={titleRef}
            className={base.input}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="hal. Tech Summit 2026"
            required
          />
        </label>

        {/* ---------- DESCRIPTION ---------- */}
        <label className={base.field}>
          <span className={base.labelRow}>
            <span className={base.label}>Description</span>
            <span className={base.counter}>
              {description.length} / {DESCRIPTION_MAX}
            </span>
          </span>
          <textarea
            className={`${base.input} ${base.textarea}`}
            value={description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Ano ang mangyayari sa event at sino ang pwedeng sumali."
            required
          />
        </label>

        {/* ---------- DATE AT ORAS ---------- */}
        <div className={styles.grid3}>
          <label className={base.field}>
            <span className={base.label}>Date</span>
            <input
              type="date"
              className={base.input}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>

          <label className={base.field}>
            <span className={base.label}>Start Time</span>
            <input
              type="time"
              className={base.input}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </label>

          <label className={base.field}>
            <span className={base.label}>End Time</span>
            <input
              type="time"
              className={base.input}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </label>
        </div>

        {/* ---------- LOCATION ---------- */}
        <label className={base.field}>
          <span className={base.label}>Location</span>
          <input
            className={base.input}
            value={location}
            maxLength={LOCATION_MAX}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="hal. STI Gymnasium, 3rd Floor"
            required
          />
        </label>

        {/* ---------- PICTURE (optional) ---------- */}
        <div className={base.field}>
          <span className={base.label}>
            Picture <span className={styles.optional}>(optional)</span>
          </span>

          {preview ? (
            <div className={styles.preview}>
              <img src={preview} alt="Preview ng picture ng event" />
              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={base.secondary}
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                >
                  Palitan
                </button>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={handleRemoveImage}
                  disabled={saving}
                >
                  Alisin
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.dropzone}
              onClick={() => fileRef.current?.click()}
              disabled={saving}
            >
              <span className={styles.dropIcon} aria-hidden="true">＋</span>
              <span>Pumili ng larawan</span>
              <span className={base.hint}>JPG, PNG o WEBP · hanggang 10 MB</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handlePickImage}
            hidden
          />
        </div>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button
            type="button"
            className={base.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Kanselahin
          </button>
          <button type="submit" className={base.primary} disabled={saving}>
            {saving ? 'Sine-save…' : isEdit ? 'I-save ang pagbabago' : 'Gumawa ng Event'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EventForm
