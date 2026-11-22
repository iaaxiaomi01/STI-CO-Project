import { useEffect, useRef } from 'react'
import { Building2, Check, Clock, Globe, Hourglass, Trash2, X } from 'lucide-react'
import { formatDate, proposalAudienceOf, typeLabel } from '../lib/announcements.js'
import styles from './AnnouncementProposals.module.css'

/* ============================================================
   ANNOUNCEMENT PROPOSALS — ANNOUNCEMENT_APPROVAL.sql

   Nasa itaas ng Announcements page.

     Adviser → "For your approval": mga pending na proposal ng
               Officers ng org niya, may Approve at Reject.
               Approve → kusang na-po-post.
     Officer → "My proposals": ang mga naghihintay pa (may
               Withdraw) at ang mga na-reject (may dahilan, at
               Remove para alisin sa listahan). Ang na-approve ay
               nasa listahan na ng announcements mismo.

   Walang ipinapakita kapag walang laman ang listahan.

   Props:
     proposals   — ang mga ipapakita (na-filter na ng page)
     mode        — 'review' (Adviser) o 'mine' (Officer)
     orgNames    — { [org id]: name } para sa "Selected organizations"
     highlightId — proposal na sandaling naka-highlight (galing sa
                   notification: /announcements?proposal=<id>)
     busyId      — proposal na may ginagawa pa
     onApprove, onReject, onRemove — (proposal) => void
   ============================================================ */

const STATUS = {
  pending: { label: 'Waiting for Adviser', icon: Hourglass },
  rejected: { label: 'Not approved', icon: X },
  approved: { label: 'Approved', icon: Check },
}

function AnnouncementProposals({
  proposals,
  mode,
  orgNames = {},
  highlightId = null,
  busyId = null,
  onApprove,
  onReject,
  onRemove,
}) {
  const highlightRef = useRef(null)

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId])

  if (proposals.length === 0) return null

  const review = mode === 'review'

  return (
    <section className={styles.section} aria-labelledby="announcement-proposals-heading">
      <h2 id="announcement-proposals-heading" className={styles.heading}>
        {review ? 'For your approval' : 'My proposals'}
        <span className={styles.count}>{proposals.length}</span>
      </h2>
      <p className={styles.lead}>
        {review
          ? 'Proposed by Officers of your organization. Approve to post it right away, or reject with a reason.'
          : 'Sent to your Adviser. Once approved, it is posted automatically.'}
      </p>

      <ul className={styles.list}>
        {proposals.map((p) => {
          const status = STATUS[p.status] ?? STATUS.pending
          const StatusIcon = status.icon
          const audience = proposalAudienceOf(p)
          const busy = busyId === p.id
          const highlighted = highlightId === p.id

          return (
            <li
              key={p.id}
              id={`proposal-${p.id}`}
              ref={highlighted ? highlightRef : undefined}
              className={[
                styles.item,
                styles[`s_${p.status}`] ?? '',
                highlighted ? styles.highlight : '',
              ].join(' ')}
            >
              <div className={styles.top}>
                <span className={styles.status}>
                  <StatusIcon size={13} strokeWidth={2.6} aria-hidden="true" />
                  {status.label}
                </span>
                <span className={styles.type}>{typeLabel(p.type)}</span>
                {audience === 'all' && (
                  <span className={styles.type}>
                    <Globe size={12} strokeWidth={2.6} aria-hidden="true" />
                    All organizations
                  </span>
                )}
                {audience === 'selected' && (
                  <span className={styles.type}>
                    <Building2 size={12} strokeWidth={2.6} aria-hidden="true" />
                    Selected organizations
                  </span>
                )}
                <time className={styles.date} dateTime={p.submitted_at}>
                  <Clock size={13} strokeWidth={2.4} aria-hidden="true" />
                  {formatDate(p.submitted_at)}
                </time>
              </div>

              <h3 className={styles.title}>{p.title}</h3>
              {audience === 'selected' && (
                <p className={styles.meta}>
                  To: your organization,{' '}
                  {p.org_ids.map((id) => orgNames[id] ?? 'Organization').join(', ')}
                </p>
              )}
              <p className={styles.message}>{p.message}</p>

              {p.image_url && (
                <a
                  className={styles.picture}
                  href={p.image_url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open full picture"
                >
                  <img src={p.image_url} alt={`Picture for "${p.title}"`} loading="lazy" />
                </a>
              )}

              {review && <p className={styles.meta}>Proposed by {p.author_name}</p>}

              {p.status === 'rejected' && (
                <p className={styles.reason}>
                  <strong>
                    Rejected by {p.reviewed_by_name}
                    {p.reviewed_at && ` · ${formatDate(p.reviewed_at)}`}
                  </strong>
                  Reason: {p.review_comment}
                </p>
              )}

              <div className={styles.actions}>
                {review && p.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.reject}`}
                      onClick={() => onReject(p)}
                      disabled={busy}
                    >
                      <X size={15} strokeWidth={2.6} aria-hidden="true" />
                      Reject
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.approve}`}
                      onClick={() => onApprove(p)}
                      disabled={busy}
                    >
                      <Check size={15} strokeWidth={2.6} aria-hidden="true" />
                      Approve
                    </button>
                  </>
                )}

                {!review && p.status !== 'approved' && (
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => onRemove(p)}
                    disabled={busy}
                  >
                    <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    {p.status === 'pending' ? 'Withdraw' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default AnnouncementProposals
