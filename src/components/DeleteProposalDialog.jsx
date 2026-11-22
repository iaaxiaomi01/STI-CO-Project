import { useEffect, useRef } from 'react'
import { Paperclip, Trash2 } from 'lucide-react'
import { attachmentsOf } from '../lib/proposalFiles.js'
import styles from './DeleteProposalDialog.module.css'

/* ============================================================
   DELETE PROPOSAL — Officer (Proposals.jsx)

   Kapalit ng dating window.confirm(). Sagot lang ang trabaho
   nito: onConfirm() = oo, onCancel() = hindi. Ang pag-delete
   mismo ay nasa handleDelete() pa rin ng Proposals.jsx.

   ITSURA (DeleteProposalDialog.module.css): madilim na navy,
   nakagitna, at may maliit na "sulat" ng proposal na nakausli
   sa itaas. Kapag tinapatan ang Delete, tumatagilid at
   lumalabo ang sulat — ipinapakita kung ano ang mawawala.
   ============================================================ */
function DeleteProposalDialog({ proposal, onConfirm, onCancel }) {
  const keepRef = useRef(null)
  const files = attachmentsOf(proposal).length

  useEffect(() => {
    keepRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-proposal-title"
        aria-describedby="delete-proposal-desc"
      >
        {/* Maliit na sulat ng proposal — display lang */}
        <div className={styles.sheet} aria-hidden="true">
          <span className={styles.letterhead} />
          <span className={`${styles.rule} ${styles.ruleTitle}`} />
          <span className={styles.rule} />
          <span className={styles.rule} />
          <span className={`${styles.rule} ${styles.ruleShort}`} />
          {files > 0 && (
            <span className={styles.clip}>
              <Paperclip size={14} strokeWidth={2.4} />
            </span>
          )}
        </div>

        <h2 id="delete-proposal-title" className={styles.heading}>
          Delete this proposal?
        </h2>
        <p className={styles.name}>{proposal.title}</p>

        <p id="delete-proposal-desc" className={styles.desc}>
          This can’t be undone.
          {files > 0 &&
            ` ${files === 1 ? 'Its attached file' : `Its ${files} attached files`} will be deleted too.`}
        </p>

        <div className={styles.actions}>
          <button ref={keepRef} type="button" className={styles.keep} onClick={onCancel}>
            Keep it
          </button>
          <button type="button" className={styles.delete} onClick={onConfirm}>
            <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteProposalDialog
