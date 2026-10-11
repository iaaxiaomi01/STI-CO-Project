import { useEffect, useRef, useState } from 'react'
import { COMMENT_MAX, isFinalReview, stageLabel } from '../lib/proposals.js'
import ReviewTrail from './ReviewTrail.jsx'
import styles from './ProposalForm.module.css'

/* ============================================================
   REVIEW DIALOG — para sa Adviser, SAO at School Head
                   (Approve at Reject)

   Adviser at SAO: Approve man o Reject, ipapasa pa rin ang
   proposal sa susunod. School Head: PINAL ang desisyon —
   kapag Approved, makakagawa na ng event ang Officer.
   Ipinapakita rin dito ang mga naunang aksyon at dahilan.

   Pinalitan nito ang dating RejectDialog. Approve man o Reject,
   KAILANGAN na ng dahilan. Dito iyon itinatype.
   Ang database din ang nagbabantay nito (proposals_before_update),
   kaya walang makakalusot na aksyon na walang dahilan.

     <ReviewDialog action="approved" ... />  → berdeng "I-approve"
     <ReviewDialog action="rejected" ... />  → pulang "I-reject"

   Ginagamit nito ang istilo ng ProposalForm para pare-pareho
   ang itsura ng mga modal.
   ============================================================ */

const TEXT = {
  approved: {
    heading: 'I-approve ang proposal',
    label: 'Dahilan ng pag-approve',
    placeholder: 'hal. Malinaw ang layunin at kumpleto ang budget. Ituloy.',
    required: 'Kailangan ang dahilan ng pag-approve.',
    button: 'I-approve',
    buttonClass: 'success',
  },
  rejected: {
    heading: 'I-reject ang proposal',
    label: 'Dahilan ng pag-reject',
    placeholder: 'hal. Sabay ito sa midterm exam week. Ilipat sa Disyembre.',
    required: 'Kailangan ang dahilan ng pag-reject.',
    button: 'I-reject',
    buttonClass: 'danger',
  },
}

function ReviewDialog({ proposal, action, onSubmit, onCancel }) {
  const text = TEXT[action] ?? TEXT.rejected
  const final = isFinalReview(proposal)
  const nextStage = proposal.stage === 'adviser' ? 'sao' : 'school_head'

  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const commentRef = useRef(null)

  useEffect(() => {
    commentRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const clean = comment.trim()
    if (!clean) {
      setError(text.required)
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean)
    } catch (err) {
      console.error('Hindi na-save ang aksyon sa proposal:', err)
      let message = 'Hindi na-save. Subukan ulit.'
      if (err?.message === 'not-allowed') {
        message = 'Wala kang pahintulot na aksyunan ang proposal na ito.'
      } else if (err?.code === 'P0001' && err.message) {
        /* Mensahe galing sa review_proposal() sa database,
           hal. "Tapos na ang pagsusuri sa proposal na ito." */
        message = err.message
      }
      setError(message)
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
      <form
        className={styles.modal}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
      >
        <h2 id="review-dialog-title" className={styles.heading}>
          {text.heading}
        </h2>

        <p className={styles.note}>
          <strong>{proposal.title}</strong>
          <br />
          {final ? (
            <>
              <strong>Ito ang PINAL na desisyon.</strong>{' '}
              {action === 'approved'
                ? 'Makakagawa na ng event ang Officer mula sa proposal na ito.'
                : 'Hindi na matutuloy ang proposal, at walang event na magagawa mula rito.'}
            </>
          ) : (
            <>
              Hindi pa ito ang pinal na desisyon. Approve man o Reject, ipapasa ito sa{' '}
              <strong>{stageLabel(nextStage)}</strong> kasama ang dahilan mo.
            </>
          )}
          <br />
          Makikita ng Officer na nagpasa ang dahilang isusulat mo.
        </p>

        <ReviewTrail proposal={proposal} />

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>{text.label}</span>
            <span className={styles.counter}>
              {comment.length} / {COMMENT_MAX}
            </span>
          </span>
          <textarea
            ref={commentRef}
            className={`${styles.input} ${styles.textarea}`}
            value={comment}
            maxLength={COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            rows={6}
            placeholder={text.placeholder}
            required
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Kanselahin
          </button>
          <button type="submit" className={styles[text.buttonClass]} disabled={saving}>
            {saving ? 'Sine-save…' : text.button}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReviewDialog
