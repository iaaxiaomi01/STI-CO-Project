import { useEffect } from 'react'
import {
  authorName,
  authorRoleLabel,
  formatLetterDate,
  wasEdited,
} from '../lib/proposals.js'
import styles from './ProposalLetter.module.css'

/* ============================================================
   PROPOSAL LETTER — ang proposal bilang PORMAL NA SULAT

   Ang laman:
     Organization Logo at Name  → galing sa organizations
     Petsa                      → kailan ginawa
     Proposed to                → tinype ng Officer
     Title                      → nagiging SUBJECT ng sulat
     Description                → katawan ng sulat
     Proposed by                → ang gumawa, at ang role niya

   Ang Logo at Organization Name ay hindi nakakopya sa
   proposal. Galing sila sa Org Profile, kaya kusang nag-a-update.

   PAG-PRINT: ang sulat lang ang lalabas sa papel — nakatago
   ang sidebar at ang mga button (tingnan ang @media print sa
   ProposalLetter.module.css).
   ============================================================ */
function ProposalLetter({ proposal, onClose }) {
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
        <button type="button" className={styles.toolButton} onClick={() => window.print()}>
          I-print
        </button>
        <button type="button" className={styles.toolButton} onClick={onClose}>
          Isara
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

          <div className={styles.recipient}>
            <p className={styles.recipientLabel}>Proposed to:</p>
            <p className={styles.recipientName}>{proposal.proposed_to}</p>
          </div>

          <p className={styles.subject}>
            <span className={styles.subjectLabel}>SUBJECT:</span> {proposal.title}
          </p>

          <div className={styles.text}>{proposal.description}</div>

          <div className={styles.signature}>
            <p className={styles.closing}>Respectfully yours,</p>
            <p className={styles.signName}>{authorName(proposal)}</p>
            <p className={styles.signRole}>
              {authorRoleLabel(proposal)}
              {org?.name && `, ${org.name}`}
            </p>
          </div>

          {wasEdited(proposal) && (
            <p className={styles.editedNote}>
              Na-edit noong {formatLetterDate(proposal.updated_at)}
            </p>
          )}
        </div>
      </article>
    </div>
  )
}

export default ProposalLetter
