import { useEffect, useRef, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import {
  LOCATION_MAX,
  SCHEDULE_REASON_MAX,
  addDaysKey,
  endDateOf,
  eventErrorMessage,
  formatSchedule,
  isFutureStart,
  nowKey,
  toTimeInput,
} from '../lib/events.js'
import base from './ProposalForm.module.css'
import styles from './ScheduleChangeDialog.module.css'

/* ============================================================
   RESCHEDULE EVENT — EVENT_CANCEL_RESCHEDULE.sql (reschedule_event())

   Para sa NA-CANCEL na event lang. Ang Officer na GUMAWA ng event
   o ang Adviser ng org. Agad na epektibo — walang approval; may
   notification sa mga nag-Join, sa Adviser at sa mga nag-approve
   ng proposal.

   Bagong Start Date, End Date, Start Time, End Time, at Location
   (nakalagay na ang dati; palitan lang kung iba na). Opsyonal ang
   note. Ang proposal mismo ay hindi ginagalaw.

   Ang mga nag-Join ay nananatiling naka-Join, pero pwede silang
   umalis hanggang bago magsimula ang bagong schedule.

   onConfirm(values) — async; values = { eventDate, endDate,
   startTime, endTime, location, note }. Kapag nag-throw, dito
   lalabas ang error at mananatiling bukas ang dialog.
   ============================================================ */

/* Ilang araw mula Start Date hanggang End Date (0 = iisang araw) */
function utcDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function daySpan(from, to) {
  return Math.max(0, Math.round((utcDay(to) - utcDay(from)) / 86400000))
}

function RescheduleEventDialog({ event, onConfirm, onCancel }) {
  /* Para manatili ang haba ng event (hal. 3 araw) kapag binago
     ang Start Date */
  const span = daySpan(event.event_date, endDateOf(event))

  const [eventDate, setEventDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState(toTimeInput(event.start_time))
  const [endTime, setEndTime] = useState(toTimeInput(event.end_time))
  const [location, setLocation] = useState(event.location ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const firstRef = useRef(null)
  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  function handleStartDateChange(value) {
    setEventDate(value)
    if (value) setEndDate(addDaysKey(value, span))
  }

  const today = nowKey().slice(0, 10)
  const complete = Boolean(eventDate && endDate && startTime && endTime)
  const preview = complete
    ? formatSchedule({ event_date: eventDate, end_date: endDate, start_time: startTime, end_time: endTime })
    : ''

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!complete) {
      setError('Please fill in the Start Date, End Date, Start Time and End Time.')
      return
    }
    if (`${endDate} ${endTime}` <= `${eventDate} ${startTime}`) {
      setError('The end (End Date and End Time) must be later than the start.')
      return
    }
    if (!isFutureStart(eventDate, startTime)) {
      setError('The new start date and time must be in the future.')
      return
    }
    if (!location.trim()) {
      setError('Please enter the location.')
      return
    }

    setSaving(true)
    try {
      await onConfirm({ eventDate, endDate, startTime, endTime, location, note })
    } catch (err) {
      console.error('Hindi na-reschedule ang event:', err)
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-event-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <h2 id="reschedule-event-title" className={`${base.heading} ${styles.heading}`}>
          <span className={styles.icon} aria-hidden="true">
            <CalendarClock size={18} strokeWidth={2.4} />
          </span>
          Reschedule event
        </h2>

        <div className={styles.eventBox}>
          <strong>{event.title}</strong>
          <span>
            <span className={styles.was}>Was:</span> {formatSchedule(event)}
          </span>
          {event.cancel_reason && (
            <span>
              <span className={styles.was}>Cancelled because:</span> {event.cancel_reason}
            </span>
          )}
        </div>

        <div className={base.grid2}>
          <label className={base.field}>
            <span className={base.label}>New Start Date</span>
            <input
              ref={firstRef}
              type="date"
              className={base.input}
              value={eventDate}
              min={today}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
            />
          </label>
          <label className={base.field}>
            <span className={base.label}>New End Date</span>
            <input
              type="date"
              className={base.input}
              value={endDate}
              min={eventDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>

        <div className={base.grid2}>
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

        {preview && <p className={base.schedulePreview}>New schedule: {preview}</p>}

        <label className={base.field}>
          <span className={base.label}>Location</span>
          <input
            type="text"
            className={base.input}
            value={location}
            maxLength={LOCATION_MAX}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <span className={base.hint}>Change it only if the venue is different.</span>
        </label>

        <label className={base.field}>
          <span className={base.labelRow}>
            <span className={base.label}>
              Note <span className={base.optional}>(optional)</span>
            </span>
            <span className={base.counter}>
              {note.length} / {SCHEDULE_REASON_MAX}
            </span>
          </span>
          <textarea
            className={base.input}
            rows={2}
            value={note}
            maxLength={SCHEDULE_REASON_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Moved to the next week because of the holiday"
          />
        </label>

        <p className={styles.explain}>
          This takes effect right away. Everyone who joined stays joined, and is notified of the new
          schedule. Those who can no longer attend may leave the event before it starts.
        </p>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onCancel} disabled={saving}>
            Close
          </button>
          <button type="submit" className={base.primary} disabled={saving}>
            {saving ? 'Saving…' : 'Reschedule'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RescheduleEventDialog
