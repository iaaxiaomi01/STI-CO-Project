import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  LOCATION_MAX,
  TITLE_MAX,
  computeStatus,
  eventErrorMessage,
  eventStatusLabel,
  toTimeInput,
} from '../lib/events.js'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
import base from './ProposalForm.module.css'
import styles from './EventForm.module.css'

/* ============================================================
   EVENT FORM — modal para sa GUMAWA at MAG-EDIT ng event

   Gumawa  → may `proposal`: BLANGKO ang Title at Description —
             ang Officer ang magsusulat. Ang pamagat ng proposal
             ay ipinapakita lang sa itaas bilang sanggunian.
             Ang Date, oras at Location ay KINUKUHA sa proposal
             (venue, event_date, start_time, end_time), pero
             pwede pang baguhin.
   Edit    → may `initial`: ang kasalukuyang event

   Laman: Title, Description, Date, Start Time, End Time,
          Location, Picture (optional)

   Walang Status — kusa itong kinukuwenta mula sa Date at oras
   (tingnan ang computeStatus() sa lib/events.js).

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { imageFile, removeImage }).
   ============================================================ */
function EventForm({ initial = null, proposal = null, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  /* Edit → galing sa event. Gumawa → galing sa proposal. */
  const source = initial ?? proposal
  const [eventDate, setEventDate] = useState(source?.event_date ?? '')
  const [startTime, setStartTime] = useState(toTimeInput(source?.start_time))
  const [endTime, setEndTime] = useState(toTimeInput(source?.end_time))
  const [location, setLocation] = useState(initial?.location ?? proposal?.venue ?? '')

  /* Picture: ang bagong pinili (file + preview), o ang dati */
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(initial?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)

  /* Silip lang kung ano ang magiging status */
  const previewStatus =
    eventDate && startTime && endTime
      ? computeStatus({ event_date: eventDate, start_time: startTime, end_time: endTime })
      : null
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
      setError(err instanceof ImageError ? err.message : 'Could not read the image.')
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
      setError('All fields except Picture are required.')
      return
    }

    if (clean.endTime <= clean.startTime) {
      setError('End Time must be later than Start Time.')
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
          {isEdit ? 'Edit event' : 'Create event'}
        </h2>

        {proposal && (
          <p className={base.note}>
            From approved proposal: <strong>{proposal.title}</strong>
          </p>
        )}

        {/* ---------- TITLE ---------- */}
        <label className={base.field}>
          <span className={base.label}>Title</span>
          <input
            ref={titleRef}
            className={base.input}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tech Summit 2026"
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
            placeholder="What will happen at the event and who can join."
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

        {eventDate && startTime && endTime && endTime > startTime && (
          <p className={styles.autoStatus}>
            Status: <strong>{eventStatusLabel(previewStatus)}</strong>
            <span> · updates automatically based on date and time</span>
          </p>
        )}

        {/* ---------- LOCATION ---------- */}
        <label className={base.field}>
          <span className={base.label}>Location</span>
          <input
            className={base.input}
            value={location}
            maxLength={LOCATION_MAX}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. STI Gymnasium, 3rd Floor"
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
              <img src={preview} alt="Event picture preview" />
              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={base.secondary}
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                >
                  Change
                </button>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={handleRemoveImage}
                  disabled={saving}
                >
                  Remove
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
              <span>Choose a picture</span>
              <span className={base.hint}>JPG, PNG or WEBP · up to 10 MB</span>
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
            Cancel
          </button>
          <button type="submit" className={base.primary} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EventForm