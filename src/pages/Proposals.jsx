import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  authorName,
  authorRoleLabel,
  canManageProposal,
  canReviewProposal,
  createProposal,
  deleteProposal,
  fetchProposals,
  formatDateTime,
  reviewProposal,
  reviewerName,
  statusLabel,
} from '../lib/proposals.js'
import {
  deleteProposalFile,
  downloadProposalFile,
  formatFileSize,
  uploadProposalFile,
} from '../lib/proposalFiles.js'
import {
  canCreateEventFrom,
  createEventFromProposal,
  eventOfProposal,
} from '../lib/events.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProposalForm from '../components/ProposalForm.jsx'
import ProposalLetter from '../components/ProposalLetter.jsx'
import ReviewDialog from '../components/ReviewDialog.jsx'
import EventForm from '../components/EventForm.jsx'
import styles from './Proposals.module.css'

/* ============================================================
   PROPOSALS — TOTOONG DATA mula sa public.proposals

   Officer → gumagawa ng proposal, at nagde-delete ng SARILI
             niyang proposal HABANG naghihintay pa. Wala nang
             pag-edit — kapag may mali, burahin at gumawa ng bago.
   Adviser → nakikita ang lahat ng proposal sa org niya, at
             siya ang nag-a-Approve o nagre-Reject. Approve man o
             Reject, kailangan ng dahilan (ReviewDialog).
   Member  → wala. Wala ito sa sidebar niya, at hinaharang
             din siya ng RLS sa database.

   Kapag APPROVED na, ang Officer na NAGPASA ay may lalabas na
   "Gumawa ng Event". Isang event lang bawat proposal — kapag
   nagawa na, "Tingnan ang Event" na ang lalabas.

   Ang bawat proposal ay binubuksan bilang PORMAL NA SULAT
   (components/ProposalLetter.jsx), na pwedeng i-print.

   Ang RLS sa database ang totoong nagbabantay. Ang
   can.propose at canManageProposal() dito ay para lang itago
   ang mga button na hindi mo magagamit.
   ============================================================ */
function Proposals() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  /* Bukas ba ang form ng bagong proposal */
  const [formOpen, setFormOpen] = useState(false)

  /* Aling proposal ang bukas bilang sulat */
  const [viewing, setViewing] = useState(null)

  const [deletingId, setDeletingId] = useState(null)

  /* Bukas na Approve/Reject dialog:
     null, o { proposal, action: 'approved' | 'rejected' } */
  const [reviewing, setReviewing] = useState(null)

  /* Aling approved na proposal ang ginagawan ng event */
  const [eventFor, setEventFor] = useState(null)

  /* Aling proposal ang dina-download ang file */
  const [downloadingId, setDownloadingId] = useState(null)

  const load = useCallback(async () => {
    try {
      setProposals(await fetchProposals())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang proposals:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const closeForm = useCallback(() => setFormOpen(false), [])
  const closeLetter = useCallback(() => setViewing(null), [])
  const closeReview = useCallback(() => setReviewing(null), [])
  const closeEventForm = useCallback(() => setEventFor(null), [])

  /* Inilalagay ang na-update na proposal sa listahan, at sa
     sulat kung iyon ang nakabukas. */
  function replaceProposal(updated) {
    setProposals((list) => list.map((p) => (p.id === updated.id ? updated : p)))
    setViewing((current) => (current?.id === updated.id ? updated : current))
  }

  /* Binubuksan ang ReviewDialog para sa Approve o Reject */
  function openReview(proposal, action) {
    setNotice('')
    setReviewing({ proposal, action })
  }

  /* Galing sa ReviewDialog. Approve man o Reject, may dahilan.
     Kapag nag-throw, doon lalabas ang error at mananatiling
     bukas ang dialog. */
  async function handleReview(comment) {
    const { proposal, action } = reviewing
    const updated = await reviewProposal(proposal.id, action, comment)
    replaceProposal(updated)
    setReviewing(null)
    setNotice(action === 'approved' ? 'Na-approve ang proposal.' : 'Na-reject ang proposal.')
  }

  /* Galing sa EventForm. Kapag nag-throw, doon lalabas ang
     error at mananatiling bukas ang form. */
  async function handleCreateEvent(values, { imageFile }) {
    const created = await createEventFromProposal(eventFor, values, imageFile)
    replaceProposal({ ...eventFor, events: { id: created.id } })
    setEventFor(null)
    setNotice('Nagawa ang event. Makikita na ito ng mga miyembro sa Events.')
  }

  /* Galing sa ProposalForm. Kapag nag-throw, doon lalabas ang
     error at mananatiling bukas ang form.

     Ang file ay ina-upload MUNA, bago i-save ang proposal.
     Kapag pumalya ang pag-save, binubura ang na-upload para
     walang maiwang file na walang gumagamit. */
  async function handleSubmit(values, { file }) {
    const uploaded = file ? await uploadProposalFile(profile, file) : null

    try {
      const created = await createProposal({ ...values, attachment: uploaded })
      setProposals((list) => [created, ...list])
      setNotice('Naipasa ang proposal.')
    } catch (err) {
      if (uploaded) await deleteProposalFile(uploaded.path)
      throw err
    }
    setFormOpen(false)
  }

  async function handleDownload(proposal) {
    setNotice('')
    setDownloadingId(proposal.id)
    try {
      await downloadProposalFile(proposal)
    } catch (err) {
      console.error('Hindi ma-download ang file:', err)
      setNotice('Hindi ma-download ang file. Subukan ulit.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(proposal) {
    const ok = window.confirm(
      `Burahin ang "${proposal.title}"? Hindi na ito maibabalik.`,
    )
    if (!ok) return

    setDeletingId(proposal.id)
    setNotice('')
    try {
      await deleteProposal(proposal.id)
      await deleteProposalFile(proposal.attachment_path)
      setProposals((list) => list.filter((p) => p.id !== proposal.id))
      setNotice('Nabura ang proposal.')
    } catch (err) {
      console.error('Hindi nabura ang proposal:', err)
      setNotice(
        err?.message === 'not-allowed'
          ? 'Wala kang pahintulot na burahin ang proposal na ito.'
          : 'Hindi nabura. Subukan ulit.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle={
          can.propose
            ? 'Gumawa ng proposal para sa organisasyon mo.'
            : 'Mga proposal na ipinasa ng mga Officer ng organisasyon.'
        }
        action={
          can.propose && (
            <ActionButton
              onClick={() => {
                setNotice('')
                setFormOpen(true)
              }}
            >
              + Gumawa ng Proposal
            </ActionButton>
          )
        }
      />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.status}>Kinukuha ang proposals…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang proposals"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && proposals.length === 0 && (
        <EmptyState
          icon="✉"
          title="Wala pang proposal"
          message={
            can.propose
              ? 'Pindutin ang "+ Gumawa ng Proposal" para gumawa ng unang sulat.'
              : 'Dito lalabas ang mga proposal na ipapasa ng mga Officer ng organisasyon mo.'
          }
        />
      )}

      {!loading && !error && proposals.length > 0 && (
        <ul className={styles.list}>
          {proposals.map((p) => {
            const manageable = canManageProposal(p, profile)
            const busy = deletingId === p.id

            return (
              <li key={p.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>{p.title}</h2>
                    <span className={`${styles.status} ${styles[`status_${p.status}`] ?? ''}`}>
                      {statusLabel(p.status)}
                    </span>
                  </div>

                  <p className={styles.meta}>
                    Proposed by: <strong>{authorName(p)}</strong> ·{' '}
                    {authorRoleLabel(p)}
                  </p>

                  <p className={styles.date}>
                    {formatDateTime(p.created_at)}
                  </p>

                  {/* Naka-attach na file — pindutin para i-download */}
                  {p.attachment_path && (
                    <button
                      type="button"
                      className={styles.fileChip}
                      onClick={() => handleDownload(p)}
                      disabled={downloadingId === p.id}
                      title="I-download ang file"
                    >
                      <span aria-hidden="true">📎</span>
                      <span className={styles.fileChipName}>{p.attachment_name}</span>
                      <span className={styles.fileChipMeta}>
                        {downloadingId === p.id
                          ? 'Dina-download…'
                          : `${formatFileSize(p.attachment_size)} · I-download`}
                      </span>
                    </button>
                  )}

                  {p.status !== 'pending' && (
                    <div
                      className={`${styles.review} ${
                        p.status === 'rejected' ? styles.reviewRejected : ''
                      }`}
                    >
                      <p className={styles.reviewHead}>
                        {p.status === 'approved' ? 'Inaprubahan' : 'Ni-reject'} ni{' '}
                        <strong>{reviewerName(p)}</strong>
                        {p.reviewed_at && ` · ${formatDateTime(p.reviewed_at)}`}
                      </p>
                      {p.review_comment && (
                        <p className={styles.reviewComment}>{p.review_comment}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.openButton}
                    onClick={() => setViewing(p)}
                  >
                    Buksan ang sulat
                  </button>

                  {canReviewProposal(p, profile) && (
                    <>
                      <button
                        type="button"
                        className={styles.approveButton}
                        onClick={() => openReview(p, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className={styles.rejectButton}
                        onClick={() => openReview(p, 'rejected')}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {canCreateEventFrom(p, profile) && (
                    <button
                      type="button"
                      className={styles.eventButton}
                      onClick={() => {
                        setNotice('')
                        setEventFor(p)
                      }}
                    >
                      + Gumawa ng Event
                    </button>
                  )}

                  {p.status === 'approved' && eventOfProposal(p) && (
                    <Link to="/events" className={styles.eventLink}>
                      Tingnan ang Event →
                    </Link>
                  )}

                  {manageable && (
                    <button
                      type="button"
                      className={`${styles.linkButton} ${styles.danger}`}
                      onClick={() => handleDelete(p)}
                      disabled={busy}
                    >
                      {busy ? 'Binubura…' : 'Burahin'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {formOpen && (
        <ProposalForm
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {viewing && (
        <ProposalLetter
          proposal={viewing}
          onClose={closeLetter}
          onDownload={handleDownload}
          downloading={downloadingId === viewing.id}
        />
      )}

      {eventFor && (
        <EventForm
          proposal={eventFor}
          onSubmit={handleCreateEvent}
          onCancel={closeEventForm}
        />
      )}

      {reviewing && (
        <ReviewDialog
          proposal={reviewing.proposal}
          action={reviewing.action}
          onSubmit={handleReview}
          onCancel={closeReview}
        />
      )}
    </>
  )
}

export default Proposals
