import { useEffect, useRef, useState } from 'react'
import {
  COMMENT_MAX,
  authorName,
  isFinalReview,
  rejectedBy,
  stageLabel,
} from '../lib/proposals.js'
import ReviewTrail from './ReviewTrail.jsx'
import styles from './ProposalForm.module.css'

/* ============================================================
   REVIEW DIALOG — para sa Adviser, SAO at School Head
                   (Approve, Reject, Revise at Noted)

   Approve → ipapasa sa susunod (sa School Head: Approved na,
             makakagawa na ng event ang Officer).
   Reject  → REJECTED na AGAD (pinal), kahit sino sa tatlo.
             Tuloy pa rin sa mga susunod para sa "Noted".
   Noted   → para sa proposal na rejected na: "nakita ko na".
   Ipinapakita rin dito ang mga naunang aksyon at dahilan.

   Approve, Reject o Noted man, KAILANGAN ng komento. Dito iyon
   itinatype.
   Ang database din ang nagbabantay nito (proposals_before_update),
   kaya walang makakalusot na aksyon na walang dahilan.

     <ReviewDialog action="approved" ... />  → berdeng "I-approve"
     <ReviewDialog action="rejected" ... />  → pulang "I-reject"
     <ReviewDialog action="revision" ... />  → kahel na "Ipa-revise"
                                               (Adviser at SAO lang)
     <ReviewDialog action="noted" ... />     → asul na "Noted"
                                               (kapag rejected na)

   REVISE: ibinabalik ang proposal sa Officer na nagpasa para
   i-edit. Nakahold ito hanggang maipasa niya ulit, at saka
   BABALIK sa nag-pa-revise — hindi na uulit sa simula.

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
  noted: {
    heading: 'Noted ang proposal',
    label: 'Komento',
    placeholder: 'hal. Nakita ko na. Sang-ayon ako sa dahilan ng pag-reject.',
    required: 'Kailangan ng komento.',
    button: 'Noted',
    buttonClass: 'primary',
  },
  revision: {
    heading: 'Ipa-revise ang proposal',
    label: 'Ano ang kailangang baguhin',
    placeholder: 'hal. Idagdag ang detalyadong budget at ang listahan ng mga kalahok.',
    required: 'Isulat kung ano ang kailangang baguhin.',
    button: 'Ipa-revise',
    buttonClass: 'warning',
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
          {action === 'revision' ? (
            <>
              Ibabalik ito kay <strong>{authorName(proposal)}</strong> para i-edit.
              Naka-hold ito habang nire-revise. Kapag naipasa na ulit, babalik ito sa{' '}
              <strong>iyo ({stageLabel(proposal.stage)})</strong> para suriin muli.
            </>
          ) : action === 'noted' ? (
            <>
              <strong>Rejected na ito ng {rejectedBy(proposal)}</strong> at hindi na
              mababago. Ang &quot;Noted&quot; ay pagpapatunay na nakita mo na.{' '}
              {final ? (
                'Dito na matatapos ang daan ng proposal.'
              ) : (
                <>
                  Ipapasa pa ito sa <strong>{stageLabel(nextStage)}</strong> para sa
                  kanyang &quot;Noted&quot;.
                </>
              )}
            </>
          ) : action === 'rejected' ? (
            <>
              <strong>REJECTED na AGAD ang proposal</strong> kapag ni-reject mo — pinal na ito
              at walang event na magagawa mula rito.{' '}
              {final ? null : (
                <>
                  Dadaan pa rin ito sa <strong>{stageLabel(nextStage)}</strong>
                  {nextStage === 'sao' && ' at School Head'}, pero &quot;Noted&quot; na lang ang
                  magagawa nila.
                </>
              )}
            </>
          ) : final ? (
            <>
              <strong>Ito ang huling pag-apruba.</strong> Makakagawa na ng event ang Officer
              mula sa proposal na ito.
            </>
          ) : (
            <>
              Ipapasa ito sa <strong>{stageLabel(nextStage)}</strong> kasama ang dahilan mo.
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
