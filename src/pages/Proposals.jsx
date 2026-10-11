import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  authorName,
  authorRoleLabel,
  canManageProposal,
  canRequestRevision,
  canReviewProposal,
  canReviseProposal,
  createProposal,
  deleteProposal,
  fetchProposals,
  formatDateTime,
  isFinalReview,
  isInRevision,
  progressLabel,
  requestRevision,
  resubmitProposal,
  reviewProposal,
  stageLabel,
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
import ReviewTrail from '../components/ReviewTrail.jsx'
import EventForm from '../components/EventForm.jsx'
import styles from './Proposals.module.css'

/* ============================================================
   PROPOSALS — TOTOONG DATA mula sa public.proposals

   ANG DALOY:  Officer → Adviser → SAO → School Head

   Officer     → gumagawa ng proposal, at nagde-delete ng SARILI
                 niyang proposal habang WALA PANG umaaksyon.
                 Wala nang pag-edit — kapag may mali, burahin at
                 gumawa ng bago.
   Adviser     → Approve/Reject/Revise ng proposals ng org niya.
   SAO         → Approve/Reject/Revise ng proposals ng lahat ng
                 org, pagkatapos ng Adviser.
   School Head → PINAL na Approve/Reject, pagkatapos ng SAO.
   Member      → wala. Wala ito sa sidebar niya, at hinaharang
                 din siya ng RLS sa database.

   Approve man o Reject ang Adviser at SAO, tuloy pa rin ang
   proposal hanggang School Head. Laging may dahilan
   (ReviewDialog), at nakikita ng lahat ang buong daan
   (ReviewTrail).

   REVISE: ibinabalik ng Adviser o SAO ang proposal sa Officer
   na NAGPASA, may komento kung ano ang babaguhin. Ang Officer
   ay may "I-revise" na button (ProposalForm na naka-edit mode).
   Pagkapasa ulit, babalik ito sa nag-pa-revise.

   Kapag APPROVED na ng School Head, ang Officer na NAGPASA ay
   may lalabas na "Gumawa ng Event". Kapag REJECTED, wala.
   Isang event lang bawat proposal — kapag nagawa na,
   "Tingnan ang Event" na ang lalabas.

   Ang bawat proposal ay binubuksan bilang PORMAL NA SULAT
   (components/ProposalLetter.jsx), na pwedeng i-print.

   Ang RLS sa database ang totoong nagbabantay. Ang
   can.propose at canManageProposal() dito ay para lang itago
   ang mga button na hindi mo magagamit.
   ============================================================ */
function Proposals() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  /* SAO (at iba pang staff): proposals ng LAHAT ng org ang
     nakikita, kaya ipinapakita rin kung aling org ang bawat isa. */
  const isStaff = (profile?.role_id ?? 0) >= 4

  /* Adviser, SAO, School Head: may sariling hanay ng proposal
     na naghihintay ng AKSYON NILA. */
  const isReviewer = [3, 4, 6].includes(profile?.role_id)

  /* Officer: may sariling hanay ng proposal na ibinalik sa
     kanya para i-revise. */
  const isProposer = Boolean(can.propose)

  /* 'mine' → naghihintay ng aksyon mo · 'all' → lahat
     Reviewer: 'mine' agad. Officer: 'all' muna, dahil kadalasan
     ay wala siyang kailangang i-revise. */
  const [filter, setFilter] = useState(isReviewer ? 'mine' : 'all')

  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  /* Bukas ba ang form ng bagong proposal */
  const [formOpen, setFormOpen] = useState(false)

  /* Aling proposal ang nire-revise ng Officer */
  const [revising, setRevising] = useState(null)

  /* Aling proposal ang bukas bilang sulat */
  const [viewing, setViewing] = useState(null)

  const [deletingId, setDeletingId] = useState(null)

  /* Bukas na Approve/Reject/Revise dialog:
     null, o { proposal, action: 'approved' | 'rejected' | 'revision' } */
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
  const closeRevise = useCallback(() => setRevising(null), [])
  const closeLetter = useCallback(() => setViewing(null), [])
  const closeReview = useCallback(() => setReviewing(null), [])
  const closeEventForm = useCallback(() => setEventFor(null), [])

  /* Inilalagay ang na-update na proposal sa listahan, at sa
     sulat kung iyon ang nakabukas. */
  function replaceProposal(updated) {
    setProposals((list) => list.map((p) => (p.id === updated.id ? updated : p)))
    setViewing((current) => (current?.id === updated.id ? updated : current))
  }

  /* Binubuksan ang ReviewDialog para sa Approve, Reject o Revise */
  function openReview(proposal, action) {
    setNotice('')
    setReviewing({ proposal, action })
  }

  /* Galing sa ReviewDialog. Approve man o Reject, may dahilan.
     Kapag nag-throw, doon lalabas ang error at mananatiling
     bukas ang dialog. */
  async function handleReview(comment) {
    const { proposal, action } = reviewing

    if (action === 'revision') {
      const updated = await requestRevision(proposal.id, comment)
      replaceProposal(updated)
      setReviewing(null)
      setNotice(
        `Ibinalik ang proposal sa Officer para i-revise. Babalik ito sa iyo kapag naipasa na ulit.`,
      )
      return
    }

    const updated = await reviewProposal(proposal.id, action, comment)
    replaceProposal(updated)
    setReviewing(null)

    const verb = action === 'approved' ? 'Na-approve' : 'Na-reject'
    if (isFinalReview(proposal)) {
      setNotice(
        action === 'approved'
          ? 'Na-approve ang proposal (pinal). Makakagawa na ng event ang Officer.'
          : 'Na-reject ang proposal (pinal).',
      )
    } else {
      setNotice(`${verb} mo ang proposal. Naipasa na ito sa ${stageLabel(updated.stage)}.`)
    }
  }

  /* Mga proposal na naghihintay ng aksyon mo:
     Reviewer → nasa stage mo · Officer → ibinalik sa iyo para i-revise */
  const mine = useMemo(
    () =>
      proposals.filter((p) =>
        isReviewer ? canReviewProposal(p, profile) : canReviseProposal(p, profile),
      ),
    [proposals, profile, isReviewer],
  )
  const showFilters = isReviewer || (isProposer && mine.length > 0)
  const shown = showFilters && filter === 'mine' ? mine : proposals

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

  /* Galing sa ProposalForm (naka-edit mode). Kapag nag-throw,
     doon lalabas ang error at mananatiling bukas ang form.

     Bagong file → i-upload muna. Kapag pumalya ang pag-save,
     binubura ang bagong upload. Kapag tagumpay at napalitan o
     naalis ang dating file, binubura ang dati sa storage. */
  async function handleResubmit(values, { file, keepExisting }) {
    const proposal = revising
    const uploaded = file ? await uploadProposalFile(profile, file) : null

    const attachment =
      uploaded ??
      (keepExisting && proposal.attachment_path
        ? {
            path: proposal.attachment_path,
            name: proposal.attachment_name,
            size: proposal.attachment_size,
          }
        : null)

    let updated
    try {
      updated = await resubmitProposal(proposal.id, { ...values, attachment })
    } catch (err) {
      if (uploaded) await deleteProposalFile(uploaded.path)
      throw err
    }

    if (proposal.attachment_path && proposal.attachment_path !== updated.attachment_path) {
      await deleteProposalFile(proposal.attachment_path)
    }

    replaceProposal(updated)
    setRevising(null)
    setFilter('all')
    setNotice(`Naipasa ulit ang proposal. Nasa ${stageLabel(updated.stage)} na ito ulit.`)
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
            ? 'Gumawa ng proposal para sa organisasyon mo. Dadaan ito sa Adviser, SAO, at School Head.'
            : profile?.role_id === 6
              ? 'Ikaw ang nagbibigay ng PINAL na desisyon sa mga proposal ng lahat ng organisasyon.'
              : isStaff
                ? 'Suriin ang mga proposal ng lahat ng organisasyon. Ipapasa ito sa School Head para sa pinal na desisyon.'
                : 'Suriin ang mga proposal ng organisasyon. Ipapasa ito sa SAO at School Head.'
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

      {showFilters && !loading && !error && (
        <div className={styles.filters} role="tablist" aria-label="Salain ang proposals">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'mine'}
            className={`${styles.filterChip} ${filter === 'mine' ? styles.filterActive : ''}`}
            onClick={() => setFilter('mine')}
          >
            {isReviewer
              ? `Naghihintay ng aksyon mo (${mine.length})`
              : `Para i-revise mo (${mine.length})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`${styles.filterChip} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}
          >
            Lahat ({proposals.length})
          </button>
        </div>
      )}

      {loading && <p className={styles.status}>Kinukuha ang proposals…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang proposals"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && proposals.length > 0 && shown.length === 0 && (
        <EmptyState
          icon="✓"
          title="Wala kang kailangang aksyunan"
          message='Walang proposal na naghihintay sa iyo ngayon. Pindutin ang "Lahat" para makita ang iba.'
        />
      )}

      {!loading && !error && proposals.length === 0 && (
        <EmptyState
          icon="✉"
          title="Wala pang proposal"
          message={
            can.propose
              ? 'Pindutin ang "+ Gumawa ng Proposal" para gumawa ng unang sulat.'
              : isStaff
                ? 'Dito lalabas ang mga proposal na ipapasa ng mga Officer ng lahat ng organisasyon.'
                : 'Dito lalabas ang mga proposal na ipapasa ng mga Officer ng organisasyon mo.'
          }
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <ul className={styles.list}>
          {shown.map((p) => {
            const manageable = canManageProposal(p, profile)
            const busy = deletingId === p.id

            return (
              <li key={p.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>{p.title}</h2>
                    <span
                      className={`${styles.status} ${
                        styles[isInRevision(p) ? 'status_revision' : `status_${p.status}`] ?? ''
                      }`}
                    >
                      {progressLabel(p)}
                    </span>
                  </div>

                  {isStaff && p.organizations?.name && (
                    <p className={styles.meta}>
                      <strong>{p.organizations.name}</strong>
                      {p.organizations.department && ` · ${p.organizations.department}`}
                    </p>
                  )}

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

                  {/* Adviser → SAO → School Head */}
                  <ReviewTrail proposal={p} />
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
                      {canRequestRevision(p, profile) && (
                        <button
                          type="button"
                          className={styles.reviseButton}
                          onClick={() => openReview(p, 'revision')}
                        >
                          Revise
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.rejectButton}
                        onClick={() => openReview(p, 'rejected')}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {canReviseProposal(p, profile) && (
                    <button
                      type="button"
                      className={styles.reviseButton}
                      onClick={() => {
                        setNotice('')
                        setRevising(p)
                      }}
                    >
                      I-revise
                    </button>
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

      {revising && (
        <ProposalForm
          proposal={revising}
          onSubmit={handleResubmit}
          onCancel={closeRevise}
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