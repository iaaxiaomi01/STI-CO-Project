import { useEffect, useRef, useState } from 'react'
import { Info, Trash2 } from 'lucide-react'
import styles from './ConfirmDialog.module.css'

/* ============================================================
   CONFIRM DIALOG — kapalit ng window.confirm() ng browser

   Reusable: magagamit sa kahit anong page na may "Sigurado ka
   ba?" bago gumawa ng aksyon (delete, cancel, remove, atbp.).
   Sa ngayon, ang delete ng Announcements pa lang ang gumagamit.

   Props:
     title         — malaking tanong, hal. "Delete announcement?"
     message       — paliwanag sa ilalim (text o JSX)
     item          — (optional) pangalan ng bagay na aaksyunan,
                     hal. title ng announcement; nasa sariling kahon
     confirmLabel  — teksto ng button, hal. "Delete"
     cancelLabel   — default "Cancel"
     busyLabel     — habang naghihintay ang onConfirm, default "Please wait…"
     tone          — 'danger' (pula, para sa delete) o 'primary' (asul)
     icon          — (optional) ibang lucide icon; default Trash2 / Info
     onConfirm     — tinatawag kapag pinindot ang confirm. Pwedeng
                     async: habang hindi pa tapos, naka-disable ang
                     mga button. Kapag nag-throw, dito lalabas ang
                     error (err.message) at mananatiling bukas.
     onCancel      — isara (Cancel, Esc, o pindot sa labas)

   Nasa CANCEL ang focus pagbukas, para hindi aksidenteng
   ma-delete sa isang Enter.
   ============================================================ */
function ConfirmDialog({
  title,
  message,
  item,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busyLabel = 'Please wait…',
  tone = 'primary',
  icon,
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef(null)

  const danger = tone === 'danger'
  const Icon = icon ?? (danger ? Trash2 : Info)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  async function handleConfirm() {
    setError('')
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      console.error('Hindi natuloy ang aksyon:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className={`${styles.modal}${danger ? ` ${styles.danger}` : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
      >
        <div className={styles.content}>
          <span className={styles.icon} aria-hidden="true">
            <Icon size={22} strokeWidth={2.2} />
          </span>

          <h2 id="confirm-dialog-title" className={styles.title}>
            {title}
          </h2>

          {item && <p className={styles.item}>{item}</p>}

          {message && (
            <p id="confirm-dialog-message" className={styles.message}>
              {message}
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
