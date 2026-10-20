import { useEffect, useRef, useState } from 'react'
import { ogErrorMessage, redeemItem } from '../lib/og.js'
import { OgAmount, OgGem } from './OgGem.jsx'
import base from './ProposalForm.module.css'
import styles from './RedeemDialog.module.css'

/* ============================================================
   REDEEM DIALOG — Member at Officer

   Dalawang hakbang:
     1. "Sigurado ka ba?" — ipinapakita ang presyo at ang matitira
     2. Tagumpay — malaking CLAIM CODE na ipapakita sa Officer o
        Adviser kapag kukunin na ang item

   Ibinabawas AGAD ang OG (redeem_og_item sa database). Kapag
   na-cancel habang hindi pa na-claim, ibabalik ito.

   onDone(result) — tinatawag kapag isinara pagkatapos ng
   matagumpay na redeem (para i-refresh ang balance at listahan).
   ============================================================ */
function RedeemDialog({ item, balance, onCancel, onDone }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const cancelRef = useRef(null)
  const doneRef = useRef(null)

  useEffect(() => {
    ;(result ? doneRef : cancelRef).current?.focus()
  }, [result])

  function close() {
    if (saving) return
    if (result) onDone(result)
    else onCancel()
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleRedeem() {
    setError('')
    setSaving(true)
    try {
      setResult(await redeemItem(item.id))
    } catch (err) {
      console.error('Hindi na-redeem:', err)
      setError(ogErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const after = balance - item.price

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="redeem-title"
      >
        {!result ? (
          <>
            <h2 id="redeem-title" className={base.heading}>
              Redeem this item?
            </h2>

            <div className={styles.item}>
              {item.image_url ? (
                <img className={styles.thumb} src={item.image_url} alt="" />
              ) : (
                <div className={styles.thumbPlaceholder} aria-hidden="true">
                  <OgGem size={26} />
                </div>
              )}
              <div className={styles.itemText}>
                <p className={styles.itemName}>{item.name}</p>
                <OgAmount value={item.price} />
              </div>
            </div>

            <dl className={styles.math}>
              <div>
                <dt>Your OG now</dt>
                <dd>{balance.toLocaleString('en-PH')} OG</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd className={styles.minus}>− {item.price.toLocaleString('en-PH')} OG</dd>
              </div>
              <div className={styles.total}>
                <dt>OG left after</dt>
                <dd>{after.toLocaleString('en-PH')} OG</dd>
              </div>
            </dl>

            <p className={styles.note}>
              The OG is deducted right away. You'll get a <strong>claim code</strong> to show an
              Officer or the Adviser when you pick up the item. You can cancel and get your OG
              back while it hasn't been claimed yet.
            </p>

            {error && <p className={base.error}>{error}</p>}

            <div className={base.actions}>
              <button
                ref={cancelRef}
                type="button"
                className={base.secondary}
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={base.primary}
                onClick={handleRedeem}
                disabled={saving || after < 0}
              >
                {saving ? 'Redeeming…' : `Redeem for ${item.price.toLocaleString('en-PH')} OG`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.successIcon} aria-hidden="true">
              ✓
            </div>
            <h2 id="redeem-title" className={`${base.heading} ${styles.centered}`}>
              Redeemed!
            </h2>
            <p className={`${styles.centered} ${styles.successText}`}>
              <strong>{result.item_name}</strong> is reserved for you.
            </p>

            <div className={styles.codeBox}>
              <span className={styles.codeLabel}>Your claim code</span>
              <span className={styles.code}>{result.claim_code}</span>
              <span className={styles.codeHint}>
                Show this to an Officer or the Adviser to get your item. You can find it again
                under <strong>My redemptions</strong>.
              </span>
            </div>

            <p className={`${styles.centered} ${styles.left}`}>
              OG left: <OgAmount value={result.balance} />
            </p>

            <div className={`${base.actions} ${styles.centerActions}`}>
              <button ref={doneRef} type="button" className={base.primary} onClick={close}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RedeemDialog
