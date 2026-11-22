import { useEffect, useRef, useState } from 'react'
import { Ban, Clock, MapPin, QrCode, Sparkles, UserPlus } from 'lucide-react'
import {
  SCHEDULE_REASON_MAX,
  eventErrorMessage,
  formatSchedule,
} from '../lib/events.js'
import styles from './CancelEventDialog.module.css'

/* ============================================================
   CANCEL EVENT — EVENT_CANCEL_RESCHEDULE.sql (cancel_event())

   Ang Officer na GUMAWA ng event o ang Adviser ng org, bago
   magsimula ang event. KAILANGAN ang dahilan — makikita ito ng
   mga nag-Join, ng Adviser at ng mga nag-approve sa notification
   nila, at sa event mismo.

   Hindi nabubura ang event: "Cancelled" ang status nito, sarado
   ang Join, QR, attendance at OG reward. Pwede itong i-reschedule
   kahit kailan, o manatiling cancelled nang tuluyan.

   onConfirm(reason) — async; kapag nag-throw, dito lalabas ang
   error at mananatiling bukas ang dialog.

   ITSURA (CancelEventDialog.module.css): may maliit na "ticket"
   ng event sa itaas — navy na petsa sa kaliwa, gaya ng stub ng
   mga ticket sa Events page.
   ============================================================ */

/* "2026-11-27" → { day: '27', month: 'Nov' } — display lang */
function dateParts(ymd) {
  const [y, m, d] = (ymd ?? '').split('-').map(Number)
  if (!y) return null
  return {
    day: String(d).padStart(2, '0'),
    month: new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short' }),
  }
}

function CancelEventDialog({ event, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const keepRef = useRef(null)
  useEffect(() => {
    keepRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  async function handleConfirm() {
    setError('')
    if (!reason.trim()) {
      setError('Please write the reason. Everyone who joined will see it.')
      return
    }
    setSaving(true)
    try {
      await onConfirm(reason)
    } catch (err) {
      console.error('Hindi na-cancel ang event:', err)
      setError(eventErrorMessage(err))
      setSaving(false)
    }
  }

  const date = dateParts(event.event_date)

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-event-title"
      >
        <div className={styles.head}>
          <span className={styles.icon} aria-hidden="true">
            <Ban size={20} strokeWidth={2.4} />
          </span>
          <h2 id="cancel-event-title" className={styles.heading}>
            Cancel this event?
          </h2>
        </div>

        {/* Maliit na ticket ng event */}
        <div className={styles.ticket}>
          {date && (
            <div className={styles.date} aria-hidden="true">
              <span className={styles.month}>{date.month}</span>
              <span className={styles.day}>{date.day}</span>
            </div>
          )}
          <div className={styles.info}>
            <strong className={styles.title}>{event.title}</strong>
            <span className={styles.line}>
              <Clock size={14} strokeWidth={2.3} aria-hidden="true" />
              {formatSchedule(event)}
            </span>
            {event.location && (
              <span className={styles.line}>
                <MapPin size={14} strokeWidth={2.3} aria-hidden="true" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        <div className={styles.effects}>
          <p className={styles.effectsLead}>
            These will close, and everyone who joined, the Adviser and those who approved the
            proposal will be notified:
          </p>
          <ul className={styles.chips}>
            <li>
              <UserPlus size={14} strokeWidth={2.4} aria-hidden="true" />
              Joining
            </li>
            <li>
              <QrCode size={14} strokeWidth={2.4} aria-hidden="true" />
              QR attendance
            </li>
            <li>
              <Sparkles size={14} strokeWidth={2.4} aria-hidden="true" />
              OG reward
            </li>
          </ul>
        </div>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>Reason</span>
            <span className={styles.counter}>
              {reason.length} / {SCHEDULE_REASON_MAX}
            </span>
          </span>
          <textarea
            className={styles.input}
            rows={3}
            value={reason}
            maxLength={SCHEDULE_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The venue is not available on this date"
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            ref={keepRef}
            type="button"
            className={styles.keep}
            onClick={onCancel}
            disabled={saving}
          >
            Keep event
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <Ban size={16} strokeWidth={2.4} aria-hidden="true" />
            )}
            {saving ? 'Cancelling…' : 'Cancel event'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelEventDialog
