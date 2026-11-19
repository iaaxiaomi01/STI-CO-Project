import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { REVIEW_COMMENT_MAX, announcementErrorMessage } from '../lib/announcements.js'
import base from './ProposalForm.module.css'

/* ============================================================
   ANNOUNCEMENT REVIEW — Adviser (ANNOUNCEMENT_APPROVAL.sql)

     decision="approved" → "Approve & post": kusang na-po-post ang
                           announcement. Opsyonal ang comment.
     decision="rejected" → "Reject": KAILANGAN ang dahilan. Final ito;
                           gagawa ng bago ang Officer kung gusto.

   onConfirm(comment) — async; kapag nag-throw, dito lalabas ang
   error at mananatiling bukas ang dialog.
   ============================================================ */
function AnnouncementReviewDialog({ proposal, decision, onConfirm, onCancel }) {
  const approve = decision === 'approved'
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    if (!approve && !comment.trim()) {
      setError('Please write the reason. The Officer will see it.')
      return
    }
    setSaving(true)
    try {
      await onConfirm(comment)
    } catch (err) {
      console.error('Hindi na-save ang desisyon:', err)
      setError(announcementErrorMessage(err))
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
        className={base.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="announcement-review-title"
      >
        <h2 id="announcement-review-title" className={base.heading}>
          {approve ? 'Approve and post this announcement?' : 'Reject this announcement?'}
        </h2>

        <p className={base.note}>
          <strong>{proposal.title}</strong> · proposed by {proposal.author_name}
          <br />
          {approve
            ? 'It will be posted right away under the Officer’s name, and members will be notified.'
            : 'This is final. The Officer will see your reason and can make a new proposal.'}
        </p>

        <label className={base.field}>
          <span className={base.labelRow}>
            <span className={base.label}>
              {approve ? 'Comment' : 'Reason'}{' '}
              {approve && <span className={base.optional}>(optional)</span>}
            </span>
            <span className={base.counter}>
              {comment.length} / {REVIEW_COMMENT_MAX}
            </span>
          </span>
          <textarea
            className={base.input}
            rows={3}
            value={comment}
            maxLength={REVIEW_COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            placeholder={approve ? 'e.g. Good to go' : 'e.g. Please add the venue and time'}
          />
        </label>

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
            className={approve ? base.primary : base.danger}
            onClick={handleConfirm}
            disabled={saving}
          >
            {approve ? (
              <Check size={15} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <X size={15} strokeWidth={2.6} aria-hidden="true" />
            )}{' '}
            {saving ? 'Saving…' : approve ? 'Approve & post' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnnouncementReviewDialog
