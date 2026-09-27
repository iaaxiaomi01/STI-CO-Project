import { useEffect, useRef, useState } from 'react'
import { COMMENT_MAX } from '../lib/proposals.js'
import styles from './ProposalForm.module.css'

/* ============================================================
   REJECT DIALOG — para sa Adviser

   Kapag nag-Reject, KAILANGAN ng dahilan. Dito iyon itinatype.
   Ang database din ang nagbabantay nito, kaya walang
   makakalusot na rejected na walang dahilan.

   Ginagamit nito ang istilo ng ProposalForm para pare-pareho
   ang itsura ng mga modal.
   ============================================================ */
function RejectDialog({ proposal, onSubmit, onCancel }) {
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
      setError('Kailangan ang dahilan ng pag-reject.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean)
    } catch (err) {
      console.error('Hindi na-reject ang proposal:', err)
      setError(
        err?.message === 'not-allowed'
          ? 'Wala kang pahintulot na aksyunan ang proposal na ito.'
          : 'Hindi na-save. Subukan ulit.',
      )
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
        aria-labelledby="reject-dialog-title"
      >
        <h2 id="reject-dialog-title" className={styles.heading}>
          I-reject ang proposal
        </h2>

        <p className={styles.note}>
          <strong>{proposal.title}</strong>
          <br />
          Makikita ng Officer na nagpasa ang dahilang isusulat mo.
        </p>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>Dahilan</span>
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
            placeholder="hal. Sabay ito sa midterm exam week. Ilipat sa Disyembre."
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
          <button type="submit" className={styles.danger} disabled={saving}>
            {saving ? 'Sine-save…' : 'I-reject'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RejectDialog
