import { authorName, formatDateTime, reviewSteps, stageLabel, statusLabel } from '../lib/proposals.js'
import styles from './ReviewTrail.module.css'

/* ============================================================
   REVIEW TRAIL — ang daan ng proposal: Adviser → SAO → School Head

   Ipinapakita ang bawat aksyong nagawa na (Approved, Rejected o
   Ipina-revise, sino, kailan, at ang dahilan). Kapag naghihintay
   pa, may huling linya na nagsasabi kung kanino ito nakatoka
   ngayon — kasama ang Officer kapag ibinalik ito para i-revise.

   Ang aksyon ng Adviser at SAO ay rekomendasyon lang — ang
   School Head ang PINAL, kaya iyon ang may "Pinal na desisyon".

     <ReviewTrail proposal={p} />            → para sa card
     <ReviewTrail proposal={p} variant="letter" /> → para sa sulat
   ============================================================ */

const DECISION_CLASS = {
  approved: styles.approved,
  rejected: styles.rejected,
  revision: styles.revision,
}

const DECISION_VERB = {
  approved: 'Inaprubahan',
  rejected: 'Ni-reject',
  revision: 'Ipina-revise',
}

function decisionLabel(step) {
  if (step.decision === 'revision') return 'Ipina-revise'
  return step.final ? `Pinal: ${statusLabel(step.decision)}` : statusLabel(step.decision)
}

function ReviewTrail({ proposal, variant = 'card' }) {
  const steps = reviewSteps(proposal)
  const inRevision = proposal.status === 'pending' && proposal.stage === 'revision'
  const waiting =
    proposal.status !== 'pending' ? '' : inRevision ? 'Officer' : stageLabel(proposal.stage)

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
            <span className={styles.decision}>{decisionLabel(step)}</span>
          </p>
          <p className={styles.by}>
            {DECISION_VERB[step.decision] ?? ''} ni <strong>{step.name || '—'}</strong>
            {step.at && ` · ${formatDateTime(step.at)}`}
          </p>
          {step.comment && <p className={styles.comment}>{step.comment}</p>}
          {step.resubmittedAt && (
            <p className={styles.resubmitted}>
              ✓ Na-revise at naipasa ulit · {formatDateTime(step.resubmittedAt)}
            </p>
          )}
        </li>
      ))}

      {waiting && (
        <li className={`${styles.step} ${styles.waiting}`}>
          <p className={styles.head}>
            <span className={styles.role}>{waiting}</span>
            <span className={styles.decision}>
              {inRevision ? 'Nire-revise' : 'Naghihintay'}
            </span>
          </p>
          <p className={styles.by}>
            {inRevision
              ? `Hinihintay na i-revise ni ${authorName(proposal)}. Babalik ito sa ${stageLabel(
                  proposal.revision_from,
                )} pagkatapos.`
              : proposal.stage === 'school_head'
                ? 'Hinihintay ang pinal na desisyon ng School Head.'
                : `Hinihintay ang aksyon ng ${waiting}.`}
          </p>
        </li>
      )}
    </ol>
  )
}

export default ReviewTrail
