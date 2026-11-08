import {
  approversOf,
  authorName,
  awaitsNoted,
  decisionLabel,
  finalStage,
  formatDateTime,
  hasBudget,
  hasChosenApprovers,
  pendingReviewers,
  rejectedBy,
  reviewPath,
  reviewProgress,
  reviewSteps,
  stageLabel,
} from '../lib/proposals.js'
import styles from './ReviewTrail.module.css'

/* ============================================================
   REVIEW TRAIL — ang daan ng proposal: Adviser → SAO → School Head
                  (→ School Administrator kapag may budget)

   Ipinapakita ang bawat aksyong nagawa na (Approved, Rejected,
   Noted o Ipina-revise, sino, kailan, at ang dahilan). Kapag
   naghihintay pa, may huling linya na nagsasabi kung kanino ito
   nakatoka ngayon — kasama ang Officer kapag ibinalik ito para
   i-revise.

   Ang hakbang na NAGPASYA ang may "Pinal": ang unang nag-Reject,
   o ang huling Approve ng School Head. Ang mga sumunod sa isang
   Reject ay "Noted" na lang.

   APPROVERS (PROPOSAL_APPROVER_PICKER.sql): sa unang linya,
   nakalista ang mga approver na pinili ng Officer bawat stage —
   pwedeng higit sa isa sa SAO, School Head at SA (wala ito sa mga
   lumang proposal). Sa huling linya, nakasulat
   kung SINO ang hinihintay ngayon — kasama na ang Adviser.

   MARAMING SAO / SCHOOL HEAD (lumang proposal, o hindi na available
   ang napili): nakalista kung SINO pa ang hinihintay
   (hal. "1 of 3 · Waiting for: Ana Cruz, Ben Reyes").

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
  const pending = inRevision ? null : (progress?.pending ?? pendingReviewers(proposal))
  const names = pending?.map((r) => r.name).filter(Boolean).join(', ')

  /* Ang mga napili ng Officer: [{ stage, label, name: 'Ana Cruz, Ben Reyes' }] */
  const chosen = hasChosenApprovers(proposal)
    ? reviewPath(proposal)
        .map((stage) => ({
          stage,
          label: stageLabel(stage),
          name: approversOf(proposal, stage)
            .map((a) => a.name)
            .filter(Boolean)
            .join(', '),
        }))
        .filter((a) => a.name)
    : []

  if (steps.length === 0 && !waiting && chosen.length === 0) return null

  return (
    <ol className={`${styles.trail} ${variant === 'letter' ? styles.letter : ''}`}>
      {chosen.length > 0 && (
        <li className={styles.step}>
          <p className={styles.head}>
            <span className={styles.role}>Approvers</span>
            <span className={styles.decision}>Chosen by the Officer</span>
          </p>
          <p className={styles.by}>
            {chosen.map((a, index) => (
              <span key={a.stage}>
                {index > 0 && ' · '}
                {a.label}: <strong>{a.name}</strong>
              </span>
            ))}
          </p>
        </li>
      )}

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
            {pending && pending.length === 0 && (!progress || progress.total === 0)
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
              : proposal.stage === finalStage(proposal)
                ? `Waiting for the ${waiting}'s final decision.`
                : proposal.stage === 'school_head' && hasBudget(proposal)
                  ? 'Waiting for the School Head. It has a budget, so the School Administrator gives the final decision after.'
                  : `Waiting for action from ${waiting}.`}
          </p>
        </li>
      )}
    </ol>
  )
}

export default ReviewTrail