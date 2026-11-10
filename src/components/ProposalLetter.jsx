import { useEffect } from 'react'
import {
  authorName,
  authorPositionLabel,
  authorRoleLabel,
  formatLetterDate,
  hasSchedule,
  isMultiDaySchedule,
  scheduleDateLabel,
  scheduleEndLabel,
  scheduleStartLabel,
  scheduleTimeLabel,
} from '../lib/proposals.js'
import { attachmentsOf } from '../lib/proposalFiles.js'
import ReviewTrail from './ReviewTrail.jsx'
import styles from './ProposalLetter.module.css'

/* ============================================================
   PROPOSAL LETTER — ang proposal bilang PORMAL NA SULAT

   Ang laman:
     Organization Logo at Name  → galing sa organizations
     Petsa                      → kailan ginawa
     Title                      → nagiging SUBJECT ng sulat
     Venue, Date, Time          → kailan at saan ang activity
                                  (wala sa mga lumang proposal).
                                  Kapag MARAMING ARAW
                                  (PROPOSAL_START_END_DATE.sql):
                                  "Start:" at "End:" — petsa at
                                  oras ng simula at katapusan.
     Description                → katawan ng sulat
     Proposed by                → ang gumawa, ang officer position
                                  niya (kung meron), at ang role
     Attachments                → listahan ng mga file; pindutin
                                  ang pangalan para i-download
                                  (PROPOSAL_MULTIPLE_FILES.sql)
     Budget                     → "With budget" kapag naka-check
     OG Reward                  → ilang OG ng org bawat dadalo
                                  (kapag higit sa 0). Dito lang
                                  ito makikita, wala sa card.
     Daan ng review             → Adviser → SAO → School Head
                                  (→ School Administrator kapag
                                  may budget), bawat isa ay may
                                  Approved/Rejected at dahilan.
                                  Ang huli ang pinal.

   Ang Logo at Organization Name ay hindi nakakopya sa
   proposal. Galing sila sa Org Profile, kaya kusang nag-a-update.

   PAG-PRINT: ang sulat lang ang lalabas sa papel — nakatago
   ang sidebar at ang mga button (tingnan ang @media print sa
   ProposalLetter.module.css). Ang mga pangalan ng file ay
   lumalabas bilang karaniwang teksto.
   ============================================================ */
function ProposalLetter({ proposal, onClose, onDownload, downloadingPath = null }) {
  const org = proposal.organizations
  const ogReward = Number(proposal.og_reward) || 0
  const files = attachmentsOf(proposal)

  /* Esc para isara */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const initials = (org?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolButton} onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className={styles.toolButton} onClick={onClose}>
          Close
        </button>
      </div>

      <article
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Proposal: ${proposal.title}`}
      >
        {/* ---------- LETTERHEAD ---------- */}
        <header className={styles.letterhead}>
          <div className={styles.logo}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt="" className={styles.logoImage} />
            ) : (
              <span className={styles.logoInitials} aria-hidden="true">
                {initials || '—'}
              </span>
            )}
          </div>

          <div className={styles.orgText}>
            <h1 className={styles.orgName}>{org?.name ?? 'Organization'}</h1>
            {org?.program && <p className={styles.orgProgram}>{org.program}</p>}
          </div>
        </header>

        {/* ---------- KATAWAN NG SULAT ---------- */}
        <div className={styles.body}>
          <p className={styles.date}>{formatLetterDate(proposal.created_at)}</p>

          <p className={styles.subject}>
            <span className={styles.subjectLabel}>SUBJECT:</span> {proposal.title}
          </p>

          {(hasSchedule(proposal) || proposal.venue || proposal.has_budget || ogReward > 0) && (
            <dl className={styles.details}>
              {proposal.venue && (
                <div className={styles.detailRow}>
                  <dt>Venue:</dt>
                  <dd>{proposal.venue}</dd>
                </div>
              )}
              {/* Maraming araw: Start at End, may petsa at oras bawat isa */}
              {isMultiDaySchedule(proposal) && (
                <>
                  <div className={styles.detailRow}>
                    <dt>Start:</dt>
                    <dd>{scheduleStartLabel(proposal)}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>End:</dt>
                    <dd>{scheduleEndLabel(proposal)}</dd>
                  </div>
                </>
              )}
              {/* Iisang araw: Date at Time, tulad ng dati */}
              {hasSchedule(proposal) && !isMultiDaySchedule(proposal) && (
                <>
                  <div className={styles.detailRow}>
                    <dt>Date:</dt>
                    <dd>{scheduleDateLabel(proposal)}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Time:</dt>
                    <dd>{scheduleTimeLabel(proposal)}</dd>
                  </div>
                </>
              )}
              {proposal.has_budget && (
                <div className={styles.detailRow}>
                  <dt>Budget:</dt>
                  <dd>(Please see the attached {files.length > 1 ? 'files' : 'file'})</dd>
                </div>
              )}
              {/* OG ng org na ito — para sa bawat dadalo na may
                  Time In at Time Out. Dito na lang ito makikita;
                  wala na sa card ng Proposals page. */}
              {ogReward > 0 && (
                <div className={styles.detailRow}>
                  <dt>OG Reward:</dt>
                  <dd>
                    {ogReward.toLocaleString('en-PH')} OG per attendee
                    {org?.name && ` (${org.name})`}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className={styles.text}>{proposal.description}</div>

          <div className={styles.signature}>
            <p className={styles.closing}>Respectfully yours,</p>
            <p className={styles.signName}>{authorName(proposal)}</p>
            {/* Officer position (hal. President) — wala sa mga
                proposal ng walang position */}
            {authorPositionLabel(proposal) && (
              <p className={styles.signPosition}>{authorPositionLabel(proposal)}</p>
            )}
            <p className={styles.signRole}>
              {authorRoleLabel(proposal)}
              {org?.name && `, ${org.name}`}
            </p>
          </div>

          {files.length > 0 && (
            <div className={styles.attachment}>
              <span className={styles.attachmentLabel}>
                {files.length > 1 ? `Attachments (${files.length}):` : 'Attachment:'}
              </span>
              <ol className={styles.attachmentList}>
                {files.map((f) => (
                  <li key={f.path}>
                    {onDownload ? (
                      <button
                        type="button"
                        className={styles.attachmentLink}
                        onClick={() => onDownload(f)}
                        disabled={downloadingPath === f.path}
                        title={`Download ${f.name}`}
                      >
                        {f.name}
                        {downloadingPath === f.path && (
                          <span className={styles.attachmentBusy}> (downloading…)</span>
                        )}
                      </button>
                    ) : (
                      f.name
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <ReviewTrail proposal={proposal} variant="letter" />
        </div>
      </article>
    </div>
  )
}

export default ProposalLetter