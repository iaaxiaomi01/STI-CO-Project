import { useEffect, useRef, useState } from 'react'
import { RotateCcw, User, X } from 'lucide-react'
import { CANCEL_REASON_MAX, cancelRedemption, isCharged, ogErrorMessage } from '../lib/og.js'
import { OgAmount, OgGem } from './OgGem.jsx'
import styles from './CancelRedemptionDialog.module.css'

/* ============================================================
   CANCEL REDEMPTION — "Ibalik ang OG"

   Sariling redemption (Member/Officer): opsyonal ang dahilan.
   Ng iba (Officer/Adviser): KAILANGAN ang dahilan — makikita ito
   ng may-ari sa notification niya.

   Pending lang ang pwedeng i-cancel. Sa bagong daloy, wala pang
   nabawas (sa claim pa lang ang bawas), kaya walang ibabalik.
   Ang LUMANG pending lang (nabawasan na noong nag-redeem, may
   charged_at) ang ibinabalik ng database ang OG at stock.

   ITSURA (CancelRedemptionDialog.module.css): "price tag" —
   dilaw na tag na may gem at presyo sa itaas (marahang umuuga
   pagkabukas), at makukulay na pill para sa detalye.
   ============================================================ */
function CancelRedemptionDialog({ redemption, ownRedemption, onCancel, onDone }) {
  const charged = isCharged(redemption)
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
    if (!ownRedemption && !reason.trim()) {
      setError('Please write the reason. The member will see it.')
      return
    }
    setSaving(true)
    try {
      await cancelRedemption(redemption.id, reason)
      onDone()
    } catch (err) {
      console.error('Hindi na-cancel ang redemption:', err)
      setError(ogErrorMessage(err))
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
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-redemption-title"
      >
        <div className={styles.top}>
          {/* Price tag — display lang */}
          <span className={styles.tag} aria-hidden="true">
            <span className={styles.tagHole} />
            <OgGem size={18} />
            <span className={styles.tagPrice}>
              {(Number(redemption.price) || 0).toLocaleString('en-PH')}
            </span>
          </span>

          <div className={styles.titles}>
            <h2 id="cancel-redemption-title" className={styles.heading}>
              Cancel this redemption?
            </h2>
            <p className={styles.item}>{redemption.item_name}</p>
          </div>
        </div>

        {/* Walang claim code: ginagamit ito sa "Hand out items", at
            hindi dapat makita ng Officer/Adviser ang code */}
        <ul className={styles.pills}>
          {!ownRedemption && (
            <li className={styles.pillBlue}>
              <User size={14} strokeWidth={2.6} aria-hidden="true" />
              <span>
                Redeemed by <strong>{redemption.redeemer_name}</strong>
              </span>
            </li>
          )}
          {charged ? (
            <li className={styles.pillCoral}>
              <RotateCcw size={14} strokeWidth={2.6} aria-hidden="true" />
              <span>
                OG to return <OgAmount value={redemption.price} signed size={14} />
              </span>
            </li>
          ) : (
            <li className={styles.pillMint}>
              <span>
                Price <OgAmount value={redemption.price} size={14} /> · not deducted yet
              </span>
            </li>
          )}
        </ul>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>
              Reason{' '}
              {ownRedemption && <span className={styles.optional}>(optional)</span>}
            </span>
            <span className={styles.counter}>
              {reason.length} / {CANCEL_REASON_MAX}
            </span>
          </span>
          <textarea
            className={styles.input}
            rows={3}
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              ownRedemption ? 'e.g. I changed my mind' : 'e.g. This item ran out at the booth'
            }
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
            Keep it
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleConfirm}
            disabled={saving}
          >
            <span className={styles.confirmIcon} aria-hidden="true">
              {saving ? <span className={styles.spinner} /> : <X size={13} strokeWidth={3.2} />}
            </span>
            {saving ? 'Cancelling…' : charged ? 'Cancel & return OG' : 'Cancel redemption'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelRedemptionDialog
