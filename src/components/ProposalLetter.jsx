import { useEffect } from 'react'
import {
  authorName,
  authorPositionLabel,
  authorRoleLabel,
  formatLetterDate,
  hasSchedule,
  scheduleDateLabel,
  scheduleTimeLabel,
} from '../lib/proposals.js'
import ReviewTrail from './ReviewTrail.jsx'
import styles from './ProposalLetter.module.css'

/* ============================================================
   PROPOSAL LETTER — ang proposal bilang PORMAL NA SULAT

   Ang laman:
     Organization Logo at Name  → galing sa organizations
     Petsa                      → kailan ginawa
     Title                      → nagiging SUBJECT ng sulat
     Venue, Date, Time          → kailan at saan ang activity
                                  (wala sa mga lumang proposal)
     Description                → katawan ng sulat
     Proposed by                → ang gumawa, ang officer position
                                  niya (kung meron), at ang role
     Attachment                 → pangalan ng file (kung meron);
                                  "I-download" sa itaas na toolbar
     Budget                     → "With budget" kapag naka-check
     Daan ng review             → Adviser → SAO → School Head
                                  (→ School Administrator kapag
                                  may budget), bawat isa ay may
                                  Approved/Rejected at dahilan.
                                  Ang huli ang pinal.

   Ang Logo at Organization Name ay hindi nakakopya sa
   proposal. Galing sila sa Org Profile, kaya kusang nag-a-update.

   PAG-PRINT: ang sulat lang ang lalabas sa papel — nakatago
   ang sidebar at ang mga button (tingnan ang @media print sa
   ProposalLetter.module.css).
   ============================================================ */
function ProposalLetter({ proposal, onClose, onDownload, downloading = false }) {
  const org = proposal.organizations

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
        {proposal.attachment_path && onDownload && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => onDownload(proposal)}
            disabled={downloading}
          >
            {downloading ? 'Downloading…' : 'Download file'}
          </button>
        )}
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
            {org?.department && <p className={styles.orgDept}>{org.department}</p>}
          </div>
        </header>

        {/* ---------- KATAWAN NG SULAT ---------- */}
        <div className={styles.body}>
          <p className={styles.date}>{formatLetterDate(proposal.created_at)}</p>

          <p className={styles.subject}>
            <span className={styles.subjectLabel}>SUBJECT:</span> {proposal.title}
          </p>

          {(hasSchedule(proposal) || proposal.venue || proposal.has_budget) && (
            <dl className={styles.details}>
              {proposal.venue && (
                <div className={styles.detailRow}>
                  <dt>Venue:</dt>
                  <dd>{proposal.venue}</dd>
                </div>
              )}
              {hasSchedule(proposal) && (
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
                  <dd>(Please see the attached file)</dd>
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

          {proposal.attachment_name && (
            <p className={styles.attachment}>
              <span className={styles.attachmentLabel}>Attachment:</span>{' '}
              {proposal.attachment_name}
            </p>
          )}

          <ReviewTrail proposal={proposal} variant="letter" />
        </div>
      </article>
    </div>
  )
}

export default ProposalLetter