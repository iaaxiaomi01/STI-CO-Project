import { useEffect, useRef, useState } from 'react'
import { Check, Eye, RotateCcw, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import {
  COMMENT_MAX,
  authorName,
  completesStage,
  isFinalReview,
  nextStageOf,
  othersPendingCount,
  rejectedBy,
  remainingStages,
  stageLabel,
} from '../lib/proposals.js'
import ReviewTrail from './ReviewTrail.jsx'
import styles from './ReviewDialog.module.css'

/* ============================================================
   REVIEW DIALOG — para sa Adviser, SAO, School Head at School
                   Administrator (Approve, Reject, Revise at Noted)

   Approve → ipapasa sa susunod (sa huling stage — School Head, o
             SA kapag may budget — Approved na, makakagawa na ng
             event ang Officer).
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

   MARAMING SAO / SCHOOL HEAD: lilipat lang ang proposal sa
   susunod na stage kapag ikaw na ang HULING hinihintay. Kung may
   iba pa, sinasabi ng dialog na hihintayin pa sila.

   Itsura: ReviewDialog.module.css (sariling CSS — letterhead ng
   STI). Iba ang kulay ayon sa aksyon: Approve berde, Reject pula,
   Revision amber, Noted asul. Walang placeholder ang reason.
   ============================================================ */

const TEXT = {
  approved: {
    heading: 'Approve proposal',
    label: 'Reason for approval',
    required: 'A reason for approval is required.',
    button: 'Approve',
    buttonClass: 'success',
  },
  rejected: {
    heading: 'Reject proposal',
    label: 'Reason for rejection',
    required: 'A reason for rejection is required.',
    button: 'Reject',
    buttonClass: 'danger',
  },
  noted: {
    heading: 'Mark proposal as Noted',
    label: 'Comment',
    required: 'A comment is required.',
    button: 'Noted',
    buttonClass: 'primary',
  },
  revision: {
    heading: 'Request revision',
    label: 'What needs to be changed',
    required: 'Please describe what needs to be changed.',
    button: 'Request revision',
    buttonClass: 'warning',
  },
}

/* Icon sa header, ayon sa aksyon */
const ICONS = {
  approved: Check,
  rejected: X,
  revision: RotateCcw,
  noted: Eye,
}

/* ['A', 'B', 'C'] → "A, B and C" */
function joinNames(list) {
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

function ReviewDialog({ proposal, action, onSubmit, onCancel }) {
  const { profile } = useAuth()
  const text = TEXT[action] ?? TEXT.rejected
  const final = isFinalReview(proposal, profile?.id)
  const nextStage = nextStageOf(proposal)
  const stageName = stageLabel(proposal.stage)

  /* Ilan pang SAO / School Head ang hinihintay bukod sa iyo */
  const others = othersPendingCount(proposal, profile?.id)
  const lastInStage = completesStage(proposal, profile?.id)
  const othersText = `the other ${others === 1 ? '' : `${others} `}${stageName}`
  const othersVerb = others === 1 ? 'has' : 'have'

  /* Sino pa ang dadaanan pagkatapos mo (para sa Reject). Kasama
     ang School Administrator kapag may budget ang proposal. */
  const stillPasses = [
    others > 0 && othersText,
    ...remainingStages(proposal).map(stageLabel),
  ].filter(Boolean)

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
      let message = 'Could not save. Please try again.'
      if (err?.message === 'not-allowed') {
        message = "You don't have permission to act on this proposal."
      } else if (err?.code === 'P0001' && err.message) {
        /* Mensahe galing sa review_proposal() sa database,
           hal. "Tapos na ang pagsusuri sa proposal na ito." */
        message = err.message
      }
      setError(message)
      setSaving(false)
    }
  }

  const Icon = ICONS[action] ?? X

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={`${styles.modal} ${styles[action] ?? ''}`}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
      >
        {/* ---------- HEADER (letterhead ng STI) ---------- */}
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <Icon size={22} strokeWidth={2.6} />
          </span>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>Proposal review</p>
            <h2 id="review-dialog-title" className={styles.heading}>
              {text.heading}
            </h2>
          </div>
        </div>

        <div className={styles.content}>
          {/* ---------- WHAT HAPPENS NEXT (kasama ang pangalan ng proposal) ---------- */}
          <h3 className={styles.sectionTitle}>What happens next</h3>
          <p className={styles.next}>
            <strong>{proposal.title}</strong>
            <br />
            {action === 'revision' ? (
              <>
                This will be returned to <strong>{authorName(proposal)}</strong> for editing.
                It stays on hold while being revised. Once resubmitted, it will come back to{' '}
                <strong>you ({stageName})</strong> for another review.
                {proposal.stage === 'sao' &&
                  ' SAO who already approved keep their approval; only you and those who have not acted yet will review it again.'}
              </>
            ) : action === 'noted' ? (
              <>
                <strong>This was already rejected by {rejectedBy(proposal)}</strong> and can no
                longer change. &quot;Noted&quot; confirms that you have seen it.{' '}
                {final ? (
                  'This is where the proposal\'s review ends.'
                ) : !lastInStage ? (
                  <>
                    It moves on once <strong>{othersText}</strong> {othersVerb} also marked it.
                  </>
                ) : (
                  <>
                    It will still be forwarded to <strong>{stageLabel(nextStage)}</strong> for
                    their &quot;Noted&quot;.
                  </>
                )}
              </>
            ) : action === 'rejected' ? (
              <>
                <strong>The proposal is REJECTED IMMEDIATELY</strong> once you reject it — this is
                final and no event can be created from it.{' '}
                {stillPasses.length > 0 && (
                  <>
                    It will still pass through <strong>{joinNames(stillPasses)}</strong>, but they
                    can only mark it &quot;Noted&quot;.
                  </>
                )}
              </>
            ) : final ? (
              <>
                <strong>This is the final approval.</strong> The Officer will be able to create its
                event in Events.
              </>
            ) : !lastInStage ? (
              <>
                Your approval will be recorded. It moves on once <strong>{othersText}</strong>{' '}
                {othersVerb} also acted.
              </>
            ) : (
              <>
                This will be forwarded to <strong>{stageLabel(nextStage)}</strong> along with your
                reason.
              </>
            )}
          </p>

          {/* ---------- REVIEW HISTORY (nakatago kapag wala pa) ---------- */}
          <div className={styles.history}>
            <h3 className={styles.sectionTitle}>Review history</h3>
            <ReviewTrail proposal={proposal} />
          </div>

          {/* ---------- REASON ---------- */}
          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.sectionTitle}>{text.label}</span>
              <span className={styles.counter}>
                {comment.length} / {COMMENT_MAX}
              </span>
            </span>
            <textarea
              ref={commentRef}
              className={styles.textarea}
              value={comment}
              maxLength={COMMENT_MAX}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {/* ---------- MGA BUTTON ---------- */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className={styles[text.buttonClass]} disabled={saving}>
            {!saving && <Icon size={16} strokeWidth={2.8} aria-hidden="true" />}
            {saving ? 'Saving…' : text.button}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReviewDialog