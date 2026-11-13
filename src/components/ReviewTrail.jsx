import {
  authorName,
  awaitsNoted,
  decisionLabel,
  finalStage,
  formatDateTime,
  hasBudget,
  pendingReviewers,
  rejectedBy,
  reviewProgress,
  reviewSteps,
  stageLabel,
} from '../lib/proposals.js'
import { Check, Clock, Eye, RotateCcw, X } from 'lucide-react'
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

   WALA NANG linya ng "Approvers · Chosen by the Officer" — sa
   huling linya na lang nakasulat kung SINO ang hinihintay ngayon
   (kasama na ang Adviser).

   MARAMING SAO / SCHOOL HEAD (lumang proposal, o hindi na available
   ang napili): nakalista kung SINO pa ang hinihintay
   (hal. "1 of 3 · Waiting for: Ana Cruz, Ben Reyes").

     <ReviewTrail proposal={p} />            → para sa card
     <ReviewTrail proposal={p} variant="letter" /> → para sa sulat

   SA CARD: may bilog na ICON bawat hakbang (✓ Approved, ✕ Rejected,
   ↺ Revision, mata = Noted, orasan = naghihintay). Walang guhit
   sa gilid.

   SA SULAT: pormal na table na "Review History" (Office, Action,
   Name, Date) — itim na teksto lang, walang kulay.
   ============================================================ */

const DECISION_CLASS = {
  approved: styles.approved,
  rejected: styles.rejected,
  noted: styles.noted,
  revision: styles.revision,
}

/* Icon ng bawat hakbang (card lang — wala sa sulat) */
const DECISION_ICON = {
  approved: Check,
  rejected: X,
  noted: Eye,
  revision: RotateCcw,
}

/* Bilog na icon sa kaliwa ng bawat hakbang */
function StepIcon({ icon: Icon }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <Icon size={16} strokeWidth={2.8} />
    </span>
  )
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

  const isLetter = variant === 'letter'

  if (steps.length === 0 && !waiting) return null

  /* Ang mensahe sa huling linya — kanino nakatoka ngayon */
  const waitingMessage = !waiting
    ? ''
    : pending && pending.length === 0 && (!progress || progress.total === 0)
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
                : `Waiting for action from ${waiting}.`

  const waitingStatus = waiting
    ? `${inRevision ? 'Being revised' : noted ? 'For Noted' : 'Pending'}${
        progress && progress.total > 1 ? ` (${progress.done} of ${progress.total})` : ''
      }`
    : ''

  /* ---------- SA SULAT: pormal na table ---------- */
  if (isLetter) {
    return (
      <section className={styles.record} aria-label="Review history">
        <h2 className={styles.recordTitle}>Review History</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.colOffice}>Office</th>
              <th scope="col" className={styles.colAction}>Action</th>
              <th scope="col">Name</th>
              <th scope="col" className={styles.colDate}>Date</th>
            </tr>
          </thead>
          {steps.map((step) => (
            <tbody key={step.key} className={step.final ? styles.finalRow : ''}>
              <tr>
                <td data-label="Office">{step.role}</td>
                <td data-label="Action">{stepLabel(step)}</td>
                <td data-label="Name">{step.name || '—'}</td>
                <td data-label="Date">{step.at ? formatDateTime(step.at) : '—'}</td>
              </tr>
              {(step.comment || step.resubmittedAt) && (
                <tr className={styles.remarksRow}>
                  <td aria-hidden="true" className={styles.remarksSpacer} />
                  <td colSpan={3}>
                    {step.comment && (
                      <p className={styles.remarks}>
                        <span className={styles.remarksLabel}>Remarks:</span> {step.comment}
                      </p>
                    )}
                    {step.resubmittedAt && (
                      <p className={styles.remarks}>
                        Revised and resubmitted on {formatDateTime(step.resubmittedAt)}.
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          ))}
          {waiting && (
            <tbody className={styles.waitingRow}>
              <tr>
                <td data-label="Office">{waiting}</td>
                <td data-label="Action">{waitingStatus}</td>
                <td data-label="Name" colSpan={2}>
                  {waitingMessage}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </section>
    )
  }

  return (
    <ol className={styles.trail}>
      {steps.map((step) => (
        <li
          key={step.key}
          className={`${styles.step} ${DECISION_CLASS[step.decision] ?? ''} ${
            step.final ? styles.final : ''
          }`}
        >
          <StepIcon icon={DECISION_ICON[step.decision] ?? Check} />
          <div className={styles.body}>
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
          </div>
        </li>
      ))}

      {waiting && (
        <li className={`${styles.step} ${styles.waiting}`}>
          <StepIcon icon={inRevision ? RotateCcw : Clock} />
          <div className={styles.body}>
            <p className={styles.head}>
              <span className={styles.role}>{waiting}</span>
              <span className={styles.decision}>
                {inRevision ? 'Being revised' : noted ? 'For Noted' : 'Pending'}
                {progress && progress.total > 1 && ` · ${progress.done} of ${progress.total}`}
              </span>
            </p>
            <p className={styles.by}>{waitingMessage}</p>
          </div>
        </li>
      )}
    </ol>
  )
}

export default ReviewTrail