import { useEffect, useRef, useState } from 'react'
import { Ban } from 'lucide-react'
import {
  SCHEDULE_REASON_MAX,
  eventErrorMessage,
  formatSchedule,
} from '../lib/events.js'
import base from './ProposalForm.module.css'
import styles from './ScheduleChangeDialog.module.css'

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
   ============================================================ */
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

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-event-title"
      >
        <h2 id="cancel-event-title" className={`${base.heading} ${styles.heading}`}>
          <span className={`${styles.icon} ${styles.iconDanger}`} aria-hidden="true">
            <Ban size={18} strokeWidth={2.4} />
          </span>
          Cancel this event?
        </h2>

        <div className={styles.eventBox}>
          <strong>{event.title}</strong>
          <span>{formatSchedule(event)}</span>
          <span>{event.location}</span>
        </div>

        <p className={styles.explain}>
          The event stays on the list as <strong>Cancelled</strong>. Joining, QR attendance and the
          OG reward are closed. Everyone who joined, the Adviser and those who approved the proposal
          will be notified. You can reschedule it later, or leave it cancelled.
        </p>

        <label className={base.field}>
          <span className={base.labelRow}>
            <span className={base.label}>Reason</span>
            <span className={base.counter}>
              {reason.length} / {SCHEDULE_REASON_MAX}
            </span>
          </span>
          <textarea
            className={base.input}
            rows={3}
            value={reason}
            maxLength={SCHEDULE_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The venue is not available on this date"
          />
        </label>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button
            ref={keepRef}
            type="button"
            className={base.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Keep event
          </button>
          <button type="button" className={base.danger} onClick={handleConfirm} disabled={saving}>
            {saving ? 'Cancelling…' : 'Cancel event'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelEventDialog
