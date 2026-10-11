import { formatDateTime, reviewSteps, stageLabel, statusLabel } from '../lib/proposals.js'
import styles from './ReviewTrail.module.css'

/* ============================================================
   REVIEW TRAIL — ang daan ng proposal: Adviser → SAO → School Head

   Ipinapakita ang bawat aksyong nagawa na (Approved o Rejected,
   sino, kailan, at ang dahilan). Kapag naghihintay pa, may
   huling linya na nagsasabi kung kanino ito nakatoka ngayon.

   Ang aksyon ng Adviser at SAO ay rekomendasyon lang — ang
   School Head ang PINAL, kaya iyon ang may "Pinal na desisyon".

     <ReviewTrail proposal={p} />            → para sa card
     <ReviewTrail proposal={p} variant="letter" /> → para sa sulat
   ============================================================ */
function ReviewTrail({ proposal, variant = 'card' }) {
  const steps = reviewSteps(proposal)
  const waiting = proposal.status === 'pending' ? stageLabel(proposal.stage) : ''

  if (steps.length === 0 && !waiting) return null

  return (
    <ol className={`${styles.trail} ${variant === 'letter' ? styles.letter : ''}`}>
      {steps.map((step) => (
        <li
          key={step.key}
          className={`${styles.step} ${
            step.decision === 'approved' ? styles.approved : styles.rejected
          } ${step.final ? styles.final : ''}`}
        >
          <p className={styles.head}>
            <span className={styles.role}>{step.role}</span>
            <span className={styles.decision}>
              {step.final ? `Pinal: ${statusLabel(step.decision)}` : statusLabel(step.decision)}
            </span>
          </p>
          <p className={styles.by}>
            {step.decision === 'approved' ? 'Inaprubahan' : 'Ni-reject'} ni{' '}
            <strong>{step.name || '—'}</strong>
            {step.at && ` · ${formatDateTime(step.at)}`}
          </p>
          {step.comment && <p className={styles.comment}>{step.comment}</p>}
        </li>
      ))}

      {waiting && (
        <li className={`${styles.step} ${styles.waiting}`}>
          <p className={styles.head}>
            <span className={styles.role}>{waiting}</span>
            <span className={styles.decision}>Naghihintay</span>
          </p>
          <p className={styles.by}>
            {proposal.stage === 'school_head'
              ? 'Hinihintay ang pinal na desisyon ng School Head.'
              : `Hinihintay ang aksyon ng ${waiting}.`}
          </p>
        </li>
      )}
    </ol>
  )
}

export default ReviewTrail
