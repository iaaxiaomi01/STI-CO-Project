import { useEffect, useRef, useState } from 'react'
import { Check, CornerUpLeft, Megaphone, X } from 'lucide-react'
import { REVIEW_COMMENT_MAX, announcementErrorMessage, typeLabel } from '../lib/announcements.js'
import rj from './AnnouncementRejectDialog.module.css'
import ap from './AnnouncementApproveDialog.module.css'

/* ============================================================
   ANNOUNCEMENT REVIEW — Adviser (ANNOUNCEMENT_APPROVAL.sql)

     decision="approved" → "Approve": kusang na-po-post ang
                           announcement. Opsyonal ang comment.
     decision="rejected" → "Reject": KAILANGAN ang dahilan. Final ito;
                           gagawa ng bago ang Officer kung gusto.

   onConfirm(comment) — async; kapag nag-throw, dito lalabas ang
   error at mananatiling bukas ang dialog.

   ITSURA: iisa ang logic ng dalawa, magkaiba ang disenyo:
     Approve → dilaw na band + preview ng magiging post
               (AnnouncementApproveDialog.module.css)
     Reject  → "Return to sender" (AnnouncementRejectDialog.module.css)
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

  /* ---------- REJECT: "Return to sender" ---------- */
  if (!approve) {
    return (
      <div
        className={rj.backdrop}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onCancel()
        }}
      >
        <div
          className={rj.modal}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="announcement-review-title"
        >
          <div className={rj.head}>
            <span className={rj.headIcon} aria-hidden="true">
              <CornerUpLeft size={18} strokeWidth={2.6} />
            </span>
            <div>
              <h2 id="announcement-review-title" className={rj.heading}>
                Reject this announcement?
              </h2>
              <p className={rj.route}>
                Goes back to <strong>{proposal.author_name}</strong>
              </p>
            </div>
          </div>

          <div className={rj.body}>
            {/* Ang announcement na ibinabalik — maliit na papel */}
            <div className={rj.paper}>
              {proposal.type && <span className={rj.tab}>{typeLabel(proposal.type)}</span>}
              <strong className={rj.paperTitle}>{proposal.title}</strong>
              {proposal.message && <p className={rj.paperText}>{proposal.message}</p>}
            </div>

            <p className={rj.final}>
              This is final. The Officer will see your reason and can make a new proposal.
            </p>

            <label className={rj.field}>
              <span className={rj.labelRow}>
                <span className={rj.label}>Reason for the Officer</span>
                <span className={rj.counter}>
                  {comment.length} / {REVIEW_COMMENT_MAX}
                </span>
              </span>
              <textarea
                className={rj.note}
                rows={3}
                value={comment}
                maxLength={REVIEW_COMMENT_MAX}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Please add the venue and time"
              />
            </label>

            {error && <p className={rj.error}>{error}</p>}
          </div>

          <div className={rj.actions}>
            <button
              ref={cancelRef}
              type="button"
              className={rj.cancel}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={rj.reject}
              onClick={handleConfirm}
              disabled={saving}
            >
              <span className={rj.rejectIcon} aria-hidden="true">
                {saving ? (
                  <span className={rj.spinner} />
                ) : (
                  <X size={14} strokeWidth={3} />
                )}
              </span>
              {saving ? 'Saving…' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- APPROVE: preview ng magiging post ---------- */
  return (
    <div
      className={ap.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <div
        className={ap.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="announcement-review-title"
      >
        {/* Dilaw na band sa kaliwa (sa itaas kapag phone) */}
        <div className={ap.band} aria-hidden="true">
          <span className={ap.bandCheck}>
            <Check size={22} strokeWidth={3} />
          </span>
        </div>

        <div className={ap.content}>
          <h2 id="announcement-review-title" className={ap.heading}>
            Approve this announcement?
          </h2>

          <p className={ap.notice}>
            <Megaphone size={15} strokeWidth={2.4} aria-hidden="true" />
            Once approved, it will be posted to Announcements automatically.
          </p>

          {/* Ganito ang itsura nito sa feed */}
          <div className={ap.post}>
            <div className={ap.postHead}>
              <span className={ap.avatar} aria-hidden="true">
                {(proposal.author_name ?? '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className={ap.author}>{proposal.author_name}</span>
              {proposal.type && <span className={ap.type}>{typeLabel(proposal.type)}</span>}
            </div>
            <strong className={ap.postTitle}>{proposal.title}</strong>
            {proposal.message && <p className={ap.postText}>{proposal.message}</p>}
          </div>

          <label className={ap.field}>
            <span className={ap.labelRow}>
              <span className={ap.label}>
                Comment <span className={ap.optional}>(optional)</span>
              </span>
              <span className={ap.counter}>
                {comment.length} / {REVIEW_COMMENT_MAX}
              </span>
            </span>
            <textarea
              className={ap.input}
              rows={2}
              value={comment}
              maxLength={REVIEW_COMMENT_MAX}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Good to go"
            />
          </label>

          {error && <p className={ap.error}>{error}</p>}

          <div className={ap.actions}>
            <button
              ref={cancelRef}
              type="button"
              className={ap.cancel}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={ap.approve}
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? (
                <span className={ap.spinner} aria-hidden="true" />
              ) : (
                <Check size={16} strokeWidth={3} aria-hidden="true" />
              )}
              {saving ? 'Saving…' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnnouncementReviewDialog
