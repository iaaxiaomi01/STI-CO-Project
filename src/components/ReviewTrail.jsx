import {
  authorName,
  awaitsNoted,
  decisionLabel,
  formatDateTime,
  rejectedBy,
  reviewProgress,
  reviewSteps,
  stageLabel,
} from '../lib/proposals.js'
import styles from './ReviewTrail.module.css'

/* ============================================================
   REVIEW TRAIL — ang daan ng proposal: Adviser → SAO → School Head

   Ipinapakita ang bawat aksyong nagawa na (Approved, Rejected,
   Noted o Ipina-revise, sino, kailan, at ang dahilan). Kapag
   naghihintay pa, may huling linya na nagsasabi kung kanino ito
   nakatoka ngayon — kasama ang Officer kapag ibinalik ito para
   i-revise.

   Ang hakbang na NAGPASYA ang may "Pinal": ang unang nag-Reject,
   o ang huling Approve ng School Head. Ang mga sumunod sa isang
   Reject ay "Noted" na lang.

   MARAMING SAO / SCHOOL HEAD: may sariling linya ang bawat isa
   na nakaaksyon na. Sa huling linya, nakalista kung SINO pa ang
   hinihintay (hal. "1 of 3 · Waiting for: Ana Cruz, Ben Reyes").

     <ReviewTrail proposal={p} />            → para sa card
     <ReviewTrail proposal={p} variant="letter" /> → para sa sulat
   ============================================================ */

const DECISION_CLASS = {
  approved: styles.approved,
  rejected: styles.rejected,
  noted: styles.noted,
  revision: styles.revision,
}

const DECISION_VERB = {
  approved: 'Approved',
  rejected: 'Rejected',
  noted: 'Noted',
  revision: 'Revision requested',
}

function stepLabel(step) {
  const label = decisionLabel(step.decision)
  return step.final ? `Final: ${label}` : label
}

function ReviewTrail({ proposal, variant = 'card' }) {
  const steps = reviewSteps(proposal)
  const inRevision = proposal.status === 'pending' && proposal.stage === 'revision'
  const noted = awaitsNoted(proposal)
  const waiting = inRevision ? 'Officer' : stageLabel(proposal.stage)
  const progress = inRevision ? null : reviewProgress(proposal)
  const names = progress?.pending.map((r) => r.name).filter(Boolean).join(', ')

  if (steps.length === 0 && !waiting) return null

  return (
    <ol className={`${styles.trail} ${variant === 'letter' ? styles.letter : ''}`}>
      {steps.map((step) => (
        <li
          key={step.key}
          className={`${styles.step} ${DECISION_CLASS[step.decision] ?? ''} ${
            step.final ? styles.final : ''
          }`}
        >
          <p className={styles.head}>
            <span className={styles.role}>{step.role}</span>
            <span className={styles.decision}>{stepLabel(step)}</span>
          </p>
          <p className={styles.by}>
            {DECISION_VERB[step.decision] ?? ''} by{' '}
            <strong>{step.name || '—'}</strong>
            {step.at && ` · ${formatDateTime(step.at)}`}
          </p>
          {step.comment && <p className={styles.comment}>{step.comment}</p>}
          {step.resubmittedAt && (
            <p className={styles.resubmitted}>
              ✓ Revised and resubmitted · {formatDateTime(step.resubmittedAt)}
            </p>
          )}
        </li>
      ))}

      {waiting && (
        <li className={`${styles.step} ${styles.waiting}`}>
          <p className={styles.head}>
            <span className={styles.role}>{waiting}</span>
            <span className={styles.decision}>
              {inRevision ? 'Being revised' : noted ? 'For Noted' : 'Pending'}
              {progress && progress.total > 1 && ` · ${progress.done} of ${progress.total}`}
            </span>
          </p>
          <p className={styles.by}>
            {progress && progress.total === 0
              ? `No active ${waiting} account yet. It will continue once one is assigned.`
              : noted
              ? `Already rejected by ${rejectedBy(proposal)}. Waiting for "Noted" from ${
                  names || waiting
                }.`
              : names
              ? `Waiting for: ${names}.`
              : inRevision
              ? `Waiting for ${authorName(proposal)} to revise. It will go back to ${stageLabel(
                  proposal.revision_from,
                )} afterwards.`
              : proposal.stage === 'school_head'
                ? "Waiting for the School Head's final decision."
                : `Waiting for action from ${waiting}.`}
          </p>
        </li>
      )}
    </ol>
  )
}

export default ReviewTrail
