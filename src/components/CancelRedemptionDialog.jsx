import { useEffect, useRef, useState } from 'react'
import { CANCEL_REASON_MAX, cancelRedemption, ogErrorMessage } from '../lib/og.js'
import { OgAmount } from './OgGem.jsx'
import base from './ProposalForm.module.css'
import styles from './RedeemDialog.module.css'

/* ============================================================
   CANCEL REDEMPTION — "Ibalik ang OG"

   Sariling redemption (Member/Officer): opsyonal ang dahilan.
   Ng iba (Officer/Adviser): KAILANGAN ang dahilan — makikita ito
   ng may-ari sa notification niya.

   Pending lang ang pwedeng i-cancel. Ibinabalik ng database ang
   OG at ang stock.
   ============================================================ */
function CancelRedemptionDialog({ redemption, ownRedemption, onCancel, onDone }) {
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
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-redemption-title"
      >
        <h2 id="cancel-redemption-title" className={base.heading}>
          Cancel this redemption?
        </h2>

        <dl className={styles.math}>
          <div>
            <dt>Item</dt>
            <dd>{redemption.item_name}</dd>
          </div>
          <div>
            <dt>Claim code</dt>
            <dd>{redemption.claim_code}</dd>
          </div>
          {!ownRedemption && (
            <div>
              <dt>Redeemed by</dt>
              <dd>{redemption.redeemer_name}</dd>
            </div>
          )}
          <div className={styles.total}>
            <dt>OG to return</dt>
            <dd>
              <OgAmount value={redemption.price} signed />
            </dd>
          </div>
        </dl>

        <label className={base.field}>
          <span className={base.labelRow}>
            <span className={base.label}>
              Reason{' '}
              {ownRedemption && <span className={base.optional}>(optional)</span>}
            </span>
            <span className={base.counter}>
              {reason.length} / {CANCEL_REASON_MAX}
            </span>
          </span>
          <textarea
            className={base.input}
            rows={3}
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              ownRedemption ? 'e.g. I changed my mind' : 'e.g. This item ran out at the booth'
            }
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
            Keep it
          </button>
          <button type="button" className={base.danger} onClick={handleConfirm} disabled={saving}>
            {saving ? 'Cancelling…' : 'Cancel & return OG'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelRedemptionDialog
