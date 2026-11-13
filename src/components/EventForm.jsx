import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, CalendarDays, Clock, ImagePlus, Info, Lock, Pencil, Sparkles } from 'lucide-react'
import {
  DESCRIPTION_MAX,
  LOCATION_MAX,
  PROPOSAL_STARTED_MESSAGE,
  TITLE_MAX,
  computeStatus,
  endDateOf,
  eventErrorMessage,
  eventStatusLabel,
  formatEventDateRange,
  formatTime,
  isScheduleFromProposal,
  nowKey,
  proposalHasStarted,
  toTimeInput,
} from '../lib/events.js'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
/* Sariling disenyo ng Event form (asul ng STI). Hindi na ginagamit
   ang ProposalForm.module.css at EventForm.module.css dito — shared
   pa ang mga iyon ng ibang form (hal. ShopItemForm). */
import styles from './EventFormUI.module.css'

/* ============================================================
   EVENT FORM — modal para sa GUMAWA at MAG-EDIT ng event

   Gumawa  → sa EVENTS page na ito ginagawa (wala na sa Proposals).
             May `proposalChoices`: ang mga APPROVED na proposal ng
             Officer (sa org niya) na wala pang event. Pipili muna
             siya ng proposal sa itaas ng form.
             BLANGKO ang Title at Description — ang Officer ang
             magsusulat. Ang Start Date, End Date, oras at Location
             ay KINUKUHA sa napiling proposal (venue, event_date,
             end_date, start_time, end_time) at NAKA-LOCK — hindi
             na mababago.
             (Gumagana pa rin ang lumang `proposal` na prop: iisang
             proposal, walang pagpipilian.)
   Edit    → may `initial`: ang kasalukuyang event. Naka-lock din
             ang petsa, oras at Location kapag galing ang event sa
             proposal na may schedule (initial.proposals).

   Ang lumang proposal na walang schedule ay hindi naka-lock.
   Ang walang end_date ay iisang araw (End Date = Start Date).

   DUMATING NA ANG PROPOSED NA PETSA AT ORAS:
     Habang bukas ang form, sinusuri bawat 30 segundo ang oras
     ngayon (Pilipinas). Kapag dumating na ang Start Date + Start
     Time ng isang proposal, KUSA itong nawawala sa "Approved
     proposal". Kapag iyon ang napili, aalisin ang pagpili at may
     paalala. Kapag wala nang natira, may paalala at hindi na
     makaka-Create.
     Hinaharang din ito ng database (EVENT_CREATE_BEFORE_SCHEDULE.sql).

   Laman: Approved proposal (Gumawa lang), Title, Description,
          Start Date, End Date, Start Time, End Time, Location,
          OG reward per attendee (Gumawa lang, basa lang — galing
          sa proposal), Picture (optional)

   Walang Status — kusa itong kinukuwenta mula sa petsa at oras
   (tingnan ang computeStatus() sa lib/events.js).

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { imageFile, removeImage, proposal }).
   ============================================================ */

/* Ang petsa, oras at Location na galing sa proposal */
function scheduleOf(proposal) {
  return {
    eventDate: proposal?.event_date ?? '',
    endDate: proposal?.event_date ? endDateOf(proposal) : '',
    startTime: toTimeInput(proposal?.start_time),
    endTime: toTimeInput(proposal?.end_time),
    location: proposal?.venue ?? '',
  }
}

/* "Sports Fest — Monday, December 1, 2026 · 8:00 AM"
   "Camp — Fri, Nov 20, 2026 – Sun, Nov 22, 2026 · 8:00 AM" */
function choiceLabel(p) {
  const when = p.event_date
    ? ` — ${formatEventDateRange(p)}${p.start_time ? ` · ${formatTime(p.start_time)}` : ''}`
    : ''
  return `${p.title}${when}`
}

function EventForm({ initial = null, proposal = null, proposalChoices = null, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  /* Oras ngayon sa Pilipinas — nire-refresh bawat 30 segundo para
     kusang mawala ang proposal na dumating na ang oras */
  const [now, setNow] = useState(() => nowKey())
  useEffect(() => {
    const timer = setInterval(() => setNow(nowKey()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])

  /* Gumawa mula sa Events page: pipili muna ng proposal.

     `choices` ay LAGING array (walang laman kapag Edit). Huwag
     gamitin nang direkta ang `proposalChoices` dito — null ito
     kapag Edit, at ang React Compiler ay minsang binabasa ang
     `proposalChoices[0]` kahit hindi pa natutupad ang kondisyon,
     kaya nagka-crash ang Edit ("reading '0'").

     Ang mga proposal na dumating na ang Start Time ay inaalis. */
  const picking = !isEdit && Array.isArray(proposalChoices)
  const allChoices = picking ? proposalChoices : []
  const choices = allChoices.filter((p) => !proposalHasStarted(p, now))
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
        endDate: initial.event_date ? endDateOf(initial) : '',
        startTime: toTimeInput(initial.start_time),
        endTime: toTimeInput(initial.end_time),
        location: initial.location ?? '',
      }
    : scheduleOf(activeProposal)
  /* eventDate = START DATE (event_date sa database) */
  const [eventDate, setEventDate] = useState(start.eventDate)
  const [endDate, setEndDate] = useState(start.endDate)
  const [startTime, setStartTime] = useState(start.startTime)
  const [endTime, setEndTime] = useState(start.endTime)
  const [location, setLocation] = useState(start.location)

  /* Picture: ang bagong pinili (file + preview), o ang dati */
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(initial?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* Dumating na ang oras ng NAPILING proposal → nawala ito sa
     choices. Alisin ang pagpili at linisin ang petsa, oras at
     Location. (Inaayos habang nagre-render, ayon sa React docs:
     "adjusting state when a prop changes".) */
  if (picking && pickedId !== '' && !activeProposal && !saving) {
    const lost = allChoices.find((p) => p.id === pickedId)
    setPickedId('')
    setEventDate('')
    setEndDate('')
    setStartTime('')
    setEndTime('')
    setLocation('')
    setError(
      lost
        ? `“${lost.title}” has reached its proposed date and time, so an event can no longer be created for it.`
        : PROPOSAL_STARTED_MESSAGE,
    )
  }

  /* Wala nang natirang proposal na pwedeng gawan ng event */
  const noChoicesLeft = picking && choices.length === 0

  /* Naka-lock ang petsa, oras at Location kapag itinakda na ng proposal.
     Naka-lock din habang wala pang napiling proposal. */
  const scheduleLocked = isScheduleFromProposal(isEdit ? initial?.proposals : activeProposal)
  const waitingForPick = picking && !activeProposal
  const fieldsLocked = scheduleLocked || waitingForPick
  const lockedClass = fieldsLocked ? ` ${styles.locked}` : ''

  const titleRef = useRef(null)
  const pickRef = useRef(null)

  /* Tama ba ang pagkakasunod ng petsa at oras? (para sa silip ng status) */
  const scheduleValid =
    Boolean(eventDate && endDate && startTime && endTime) &&
    `${endDate} ${endTime}` > `${eventDate} ${startTime}`

  /* Silip lang kung ano ang magiging status */
  const previewStatus = scheduleValid
    ? computeStatus({
        event_date: eventDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
      })
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

  /* Pumili ng proposal → kunin ang petsa, oras at Location nito */
  function handlePickProposal(e) {
    const id = e.target.value
    setPickedId(id)
    setError('')
    const next = scheduleOf(choices.find((p) => p.id === id))
    setEventDate(next.eventDate)
    setEndDate(next.endDate)
    setStartTime(next.startTime)
    setEndTime(next.endTime)
    setLocation(next.location)
  }

  /* Start Date (kapag hindi naka-lock, hal. lumang event):
     sumusunod ang End Date kapag blangko o mas maaga */
  function handleStartDateChange(value) {
    setEventDate(value)
    if (value && (!endDate || endDate < value)) setEndDate(value)
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
      setError(
        noChoicesLeft
          ? 'None of your approved proposals can be used anymore — their proposed date and time have already arrived.'
          : 'Choose the approved proposal this event is for.',
      )
      return
    }

    /* Sigurado: baka dumating ang oras sa pagitan ng 30 segundo */
    if (!isEdit && proposalHasStarted(activeProposal, nowKey())) {
      setNow(nowKey())
      setError(PROPOSAL_STARTED_MESSAGE)
      return
    }

    const clean = {
      title: title.trim(),
      description: description.trim(),
      eventDate,
      endDate,
      startTime,
      endTime,
      location: location.trim(),
    }

    if (
      !clean.title ||
      !clean.description ||
      !clean.eventDate ||
      !clean.endDate ||
      !clean.startTime ||
      !clean.endTime ||
      !clean.location
    ) {
      setError('All fields except Picture are required.')
      return
    }

    if (clean.endDate < clean.eventDate) {
      setError('End Date cannot be earlier than Start Date.')
      return
    }

    if (clean.endDate === clean.eventDate && clean.endTime <= clean.startTime) {
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

  /* Label ng badge sa Schedule & venue card */
  const lockLabel = waitingForPick
    ? 'Choose a proposal first'
    : scheduleLocked
      ? 'From proposal'
      : null

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
        aria-labelledby="event-form-title"
      >
        {/* ---------- HEADER (nakadikit sa itaas habang nag-i-scroll) ---------- */}
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            {isEdit ? (
              <Pencil size={21} strokeWidth={2.3} />
            ) : (
              <CalendarCheck size={22} strokeWidth={2.2} />
            )}
          </span>
          <h2 id="event-form-title" className={styles.heading}>
            {isEdit ? 'Edit event' : 'Create event'}
          </h2>
        </div>

        <div className={styles.body}>
          {/* ---------- PAALALA ---------- */}
          {picking && (
            <p className={styles.note}>
              <Info size={16} strokeWidth={2.4} className={styles.noteIcon} aria-hidden="true" />
              <span>
                Select an <strong>approved proposal</strong> to create an event. 
                Its date, time, and venue are automatically applied and cannot be changed.
              </span>
            </p>
          )}

          {/* Lumang paraan: iisang proposal lang, walang pagpipilian */}
          {!picking && proposal && (
            <p className={styles.note}>
              <Info size={16} strokeWidth={2.4} className={styles.noteIcon} aria-hidden="true" />
              <span>
                From approved proposal: <strong>{proposal.title}</strong>
              </span>
            </p>
          )}

          {/* ---------- APPROVED PROPOSAL (pagpipilian) ---------- */}
          {picking && (
            <label className={styles.field}>
              <span className={styles.label}>Approved proposal</span>
              <select
                ref={pickRef}
                className={`${styles.input} ${styles.select}`}
                value={pickedId}
                onChange={handlePickProposal}
                disabled={saving || noChoicesLeft}
                required
              >
                <option value="" disabled>
                  {noChoicesLeft ? 'No proposals available' : 'Choose a proposal…'}
                </option>
                {choices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {choiceLabel(p)}
                  </option>
                ))}
              </select>
              {noChoicesLeft && (
                <span className={styles.hint}>
                  Your remaining approved proposals have reached their proposed date and time, so
                  events can no longer be created for them.
                </span>
              )}
            </label>
          )}

          {/* ---------- TITLE ---------- */}
          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.label}>Title</span>
              <span className={styles.counter}>
                {title.length} / {TITLE_MAX}
              </span>
            </span>
            <input
              ref={titleRef}
              className={styles.input}
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          {/* ---------- DESCRIPTION ---------- */}
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
              required
            />
          </label>

          {/* ---------- SCHEDULE & VENUE ---------- */}
          <div className={styles.scheduleCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>
                <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
                Schedule &amp; venue
              </span>
              {lockLabel && (
                <span className={styles.lockBadge}>
                  <Lock size={12} strokeWidth={2.6} aria-hidden="true" />
                  {lockLabel}
                </span>
              )}
            </div>

            {/* START DATE · END DATE */}
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span className={styles.label}>Start Date</span>
                <input
                  type="date"
                  className={`${styles.input}${lockedClass}`}
                  value={eventDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  disabled={fieldsLocked}
                  required
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>End Date</span>
                <input
                  type="date"
                  className={`${styles.input}${lockedClass}`}
                  value={endDate}
                  min={eventDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={fieldsLocked}
                  required
                />
              </label>
            </div>

            {/* START TIME · END TIME */}
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span className={styles.label}>Start Time</span>
                <input
                  type="time"
                  className={`${styles.input}${lockedClass}`}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={fieldsLocked}
                  required
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>End Time</span>
                <input
                  type="time"
                  className={`${styles.input}${lockedClass}`}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={fieldsLocked}
                  required
                />
              </label>
            </div>

            {/* LOCATION */}
            <label className={styles.field}>
              <span className={styles.label}>Location</span>
              <input
                className={`${styles.input}${lockedClass}`}
                value={location}
                maxLength={LOCATION_MAX}
                onChange={(e) => setLocation(e.target.value)}
                disabled={fieldsLocked}
                required
              />
            </label>

            {/* Silip ng magiging status */}
            {scheduleValid && (
              <p className={styles.statusPreview}>
                <Clock size={15} strokeWidth={2.4} aria-hidden="true" />
                <span>
                  Status: <strong>{eventStatusLabel(previewStatus)}</strong>
                  <span> · updates automatically based on date and time</span>
                </span>
              </p>
            )}
          </div>

          {/* ---------- OG REWARD (basa lang) ----------
              Galing sa proposal at NAKA-LOCK. Hindi ito kasama sa
              ise-save ng form — ang database na ang kumokopya nito
              sa event (events_copy_og_reward). */}
          {activeProposal && (
            <div className={styles.reward}>
              <span className={styles.rewardIcon} aria-hidden="true">
                <Sparkles size={18} strokeWidth={2.3} />
              </span>
              <div className={styles.rewardInfo}>
                <div className={styles.rewardTop}>
                  <span className={styles.rewardLabel}>OG reward per attendee</span>
                  <span className={styles.rewardValue}>
                    {Number(activeProposal.og_reward) || 0}
                    <small>OG</small>
                  </span>
                </div>
                <span className={styles.hint}>
                  From the proposal. Given automatically to Members and Officers with both Time
                  In and Time Out, once attendance closes. 0 means no reward.
                </span>
              </div>
            </div>
          )}

          {/* ---------- PICTURE (optional) ---------- */}
          <div className={styles.field}>
            <span className={styles.label}>
              Picture <span className={styles.optional}>(optional)</span>
            </span>

            {preview ? (
              <div className={styles.preview}>
                <img src={preview} alt="Event picture preview" />
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className={`${styles.smallButton} ${styles.removeButton}`}
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
                className={styles.uploadButton}
                onClick={() => fileRef.current?.click()}
                disabled={saving}
              >
                <span className={styles.uploadIcon} aria-hidden="true">
                  <ImagePlus size={18} strokeWidth={2.4} />
                </span>
                <span>Choose a picture</span>
                <span className={styles.hint}>JPG, PNG or WEBP · up to 10 MB</span>
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

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {/* ---------- MGA BUTTON (nakadikit sa ibaba habang nag-i-scroll) ---------- */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.primary}
            disabled={saving || noChoicesLeft}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EventForm