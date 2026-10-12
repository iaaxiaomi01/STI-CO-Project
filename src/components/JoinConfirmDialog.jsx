import { useEffect, useRef, useState } from 'react'
import { formatEventDate, formatTime, joinErrorMessage } from '../lib/events.js'
import base from './ProposalForm.module.css'
import styles from './JoinConfirmDialog.module.css'

/* ============================================================
   JOIN CONFIRM DIALOG — "Sigurado ka bang sasali?"

   Lumalabas kapag pinindot ng Member o Officer ang "Join" sa
   Events. Ipinapakita ang detalye ng event at ang paalala na
   HINDI na makakaalis kapag nakasali na — wala nang "Umalis"
   button, at hinaharang din ito ng database
   (EVENT_JOIN_NO_LEAVE.sql).

   Hindi dito nagse-save. Tinatawag lang ang onConfirm(); kapag
   nag-throw, dito lalabas ang error at mananatiling bukas ang
   dialog.
   ============================================================ */
function JoinConfirmDialog({ event, onConfirm, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* Nasa "Kanselahin" ang focus, hindi sa "Oo, mag-Join" —
     hindi na mababawi ang pagsali, kaya hindi dapat ito
     mangyari sa isang aksidenteng Enter. */
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
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
    setSaving(true)
    try {
      await onConfirm()
    } catch (err) {
      console.error('Hindi nakasali:', err)
      setError(joinErrorMessage(err))
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
        aria-labelledby="join-confirm-title"
        aria-describedby="join-confirm-warning"
      >
        <h2 id="join-confirm-title" className={base.heading}>
          Sasali ka ba sa event na ito?
        </h2>

        <div className={styles.event}>
          <p className={styles.title}>{event.title}</p>
          <dl className={styles.details}>
            <div>
              <dt>Petsa</dt>
              <dd>{formatEventDate(event.event_date)}</dd>
            </div>
            <div>
              <dt>Oras</dt>
              <dd>
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </dd>
            </div>
            <div>
              <dt>Lugar</dt>
              <dd>{event.location}</dd>
            </div>
          </dl>
        </div>

        <div id="join-confirm-warning" className={styles.warning} role="note">
          <span className={styles.warningIcon} aria-hidden="true">
            !
          </span>
          <p>
            <strong>Paalala:</strong> Kapag nag-Join ka, <strong>hindi ka na makakaalis</strong> sa
            event na ito. Siguraduhing makakadalo ka bago sumali.
          </p>
        </div>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={base.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Kanselahin
          </button>
          <button
            type="button"
            className={base.primary}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Sumasali…' : 'Oo, mag-Join'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default JoinConfirmDialog
