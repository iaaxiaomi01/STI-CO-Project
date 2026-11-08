import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  LOCATION_MAX,
  TITLE_MAX,
  computeStatus,
  eventErrorMessage,
  eventStatusLabel,
  formatEventDate,
  formatTime,
  isScheduleFromProposal,
  toTimeInput,
} from '../lib/events.js'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
import base from './ProposalForm.module.css'
import styles from './EventForm.module.css'

/* ============================================================
   EVENT FORM — modal para sa GUMAWA at MAG-EDIT ng event

   Gumawa  → sa EVENTS page na ito ginagawa (wala na sa Proposals).
             May `proposalChoices`: ang mga APPROVED na proposal ng
             Officer (sa org niya) na wala pang event. Pipili muna
             siya ng proposal sa itaas ng form.
             BLANGKO ang Title at Description — ang Officer ang
             magsusulat. Ang Date, oras at Location ay KINUKUHA sa
             napiling proposal (venue, event_date, start_time,
             end_time) at NAKA-LOCK — hindi na mababago.
             (Gumagana pa rin ang lumang `proposal` na prop: iisang
             proposal, walang pagpipilian.)
   Edit    → may `initial`: ang kasalukuyang event. Naka-lock din
             ang Date, oras at Location kapag galing ang event sa
             proposal na may schedule (initial.proposals).

   Ang lumang proposal na walang schedule ay hindi naka-lock.

   Laman: Approved proposal (Gumawa lang), Title, Description,
          Date, Start Time, End Time, Location, OG reward per
          attendee (Gumawa lang, basa lang — galing sa proposal),
          Picture (optional)

   Walang Status — kusa itong kinukuwenta mula sa Date at oras
   (tingnan ang computeStatus() sa lib/events.js).

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { imageFile, removeImage, proposal }).
   ============================================================ */

/* Ang Date, oras at Location na galing sa proposal */
function scheduleOf(proposal) {
  return {
    eventDate: proposal?.event_date ?? '',
    startTime: toTimeInput(proposal?.start_time),
    endTime: toTimeInput(proposal?.end_time),
    location: proposal?.venue ?? '',
  }
}

/* "Sports Fest — Monday, December 1, 2026 · 8:00 AM" */
function choiceLabel(p) {
  const when = p.event_date
    ? ` — ${formatEventDate(p.event_date)}${p.start_time ? ` · ${formatTime(p.start_time)}` : ''}`
    : ''
  return `${p.title}${when}`
}

function EventForm({ initial = null, proposal = null, proposalChoices = null, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  /* Gumawa mula sa Events page: pipili muna ng proposal.

     `choices` ay LAGING array (walang laman kapag Edit). Huwag
     gamitin nang direkta ang `proposalChoices` dito — null ito
     kapag Edit, at ang React Compiler ay minsang binabasa ang
     `proposalChoices[0]` kahit hindi pa natutupad ang kondisyon,
     kaya nagka-crash ang Edit ("reading '0'"). */
  const picking = !isEdit && Array.isArray(proposalChoices)
  const choices = picking ? proposalChoices : []
  const [pickedId, setPickedId] = useState(() =>
    choices.length === 1 ? (choices[0]?.id ?? '') : '',
  )
  const activeProposal = picking
    ? (choices.find((p) => p.id === pickedId) ?? null)
    : proposal

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  /* Edit → galing sa event. Gumawa → galing sa proposal. */
  const start = isEdit
    ? {
        eventDate: initial.event_date ?? '',
        startTime: toTimeInput(initial.start_time),
        endTime: toTimeInput(initial.end_time),
        location: initial.location ?? '',
      }
    : scheduleOf(activeProposal)
  const [eventDate, setEventDate] = useState(start.eventDate)
  const [startTime, setStartTime] = useState(start.startTime)
  const [endTime, setEndTime] = useState(start.endTime)
  const [location, setLocation] = useState(start.location)

  /* Naka-lock ang Date, oras at Location kapag itinakda na ng proposal.
     Naka-lock din habang wala pang napiling proposal. */
  const scheduleLocked = isScheduleFromProposal(isEdit ? initial?.proposals : activeProposal)
  const waitingForPick = picking && !activeProposal
  const fieldsLocked = scheduleLocked || waitingForPick
  const lockedClass = fieldsLocked ? ` ${styles.locked}` : ''

  /* Picture: ang bagong pinili (file + preview), o ang dati */
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(initial?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)
  const pickRef = useRef(null)

  /* Silip lang kung ano ang magiging status */
  const previewStatus =
    eventDate && startTime && endTime
      ? computeStatus({ event_date: eventDate, start_time: startTime, end_time: endTime })
      : null
  const fileRef = useRef(null)

  /* Sa unang bukas: sa pagpipilian ng proposal kapag wala pang
     napili, kung hindi ay sa Title */
  const focusPickFirst = useRef(waitingForPick)
  useEffect(() => {
    if (focusPickFirst.current) pickRef.current?.focus()
    else titleRef.current?.focus()
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

  /* Pumili ng proposal → kunin ang Date, oras at Location nito */
  function handlePickProposal(e) {
    const id = e.target.value
    setPickedId(id)
    setError('')
    const next = scheduleOf(choices.find((p) => p.id === id))
    setEventDate(next.eventDate)
    setStartTime(next.startTime)
    setEndTime(next.endTime)
    setLocation(next.location)
  }

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

    if (!isEdit && !activeProposal) {
      setError('Choose the approved proposal this event is for.')
      return
    }

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
      await onSubmit(clean, { imageFile, removeImage, proposal: activeProposal })
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

        {/* ---------- APPROVED PROPOSAL (pagpipilian) ---------- */}
        {picking && (
          <label className={base.field}>
            <span className={base.label}>Approved proposal</span>
            <select
              ref={pickRef}
              className={base.input}
              value={pickedId}
              onChange={handlePickProposal}
              disabled={saving}
              required
            >
              <option value="" disabled>
                Choose a proposal…
              </option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {choiceLabel(p)}
                </option>
              ))}
            </select>
            <span className={base.hint}>
              Only your organization&rsquo;s fully approved proposals that you submitted and that
              don&rsquo;t have an event yet are listed. The date, time and venue come from the
              proposal.
            </span>
          </label>
        )}

        {/* Lumang paraan: iisang proposal lang, walang pagpipilian */}
        {!picking && proposal && (
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
            required
          />
        </label>

        {/* ---------- DATE AT ORAS ---------- */}
        <div className={styles.grid3}>
          <label className={base.field}>
            <span className={base.label}>Date</span>
            <input
              type="date"
              className={`${base.input}${lockedClass}`}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              disabled={fieldsLocked}
              required
            />
          </label>

          <label className={base.field}>
            <span className={base.label}>Start Time</span>
            <input
              type="time"
              className={`${base.input}${lockedClass}`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={fieldsLocked}
              required
            />
          </label>

          <label className={base.field}>
            <span className={base.label}>End Time</span>
            <input
              type="time"
              className={`${base.input}${lockedClass}`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={fieldsLocked}
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
            className={`${base.input}${lockedClass}`}
            value={location}
            maxLength={LOCATION_MAX}
            onChange={(e) => setLocation(e.target.value)}
            disabled={fieldsLocked}
            required
          />
        </label>

        {/* ---------- OG REWARD (basa lang) ----------
            Galing sa proposal at NAKA-LOCK. Hindi ito kasama sa
            ise-save ng form — ang database na ang kumokopya nito
            sa event (events_copy_og_reward). */}
        {activeProposal && (
          <label className={base.field}>
            <span className={base.label}>OG reward per attendee</span>
            <input
              className={`${base.input} ${styles.locked}`}
              value={Number(activeProposal.og_reward) || 0}
              disabled
              readOnly
            />
            <span className={base.hint}>
              From the proposal. Given automatically to Members and Officers with both Time
              In and Time Out, once attendance closes. 0 means no reward.
            </span>
          </label>
        )}

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