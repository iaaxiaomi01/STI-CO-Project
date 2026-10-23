import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  authorName,
  authorRoleLabel,
  awaitsNoted,
  canManageProposal,
  canRequestRevision,
  canReviewProposal,
  canReviseProposal,
  createProposal,
  deleteProposal,
  fetchProposals,
  formatDateTime,
  hasSchedule,
  isInRevision,
  progressLabel,
  requestRevision,
  resubmitProposal,
  reviewProposal,
  scheduleDateLabel,
  scheduleTimeLabel,
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
import { isProposalNotification, subscribeToNotifications } from '../lib/notifications.js'
import styles from './Proposals.module.css'

/* ============================================================
   PROPOSALS — TOTOONG DATA mula sa public.proposals

   ANG DALOY:  Officer → Adviser → SAO → School Head
               (→ School Administrator kapag MAY BUDGET)

   Officer     → gumagawa ng proposal, at nagde-delete ng SARILI
                 niyang proposal habang WALA PANG umaaksyon.
                 Wala nang pag-edit — kapag may mali, burahin at
                 gumawa ng bago.
   Adviser     → Approve/Reject/Revise ng proposals ng org niya.
   SAO         → Approve/Reject/Revise ng proposals ng lahat ng
                 org, pagkatapos ng Adviser. LAHAT ng SAO ay
                 dadaanan (sabay-sabay); lilipat lang sa School
                 Head kapag nakaaksyon na ang lahat.
   School Head → Approve/Reject pagkatapos ng LAHAT ng SAO. LAHAT
                 din ng School Head ay dadaanan. Siya ang pinal
                 kapag WALANG budget.
   School Admin→ PINAL na Approve/Reject ng proposal na MAY BUDGET,
                 pagkatapos ng LAHAT ng School Head. LAHAT ng SA ay
                 dadaanan. Ang may budget LANG ang nakikita niya
                 (ADD_SCHOOL_ADMINISTRATOR.sql).
   Member      → wala. Wala ito sa sidebar niya, at hinaharang
                 din siya ng RLS sa database.

   REJECT: kapag may nag-reject sa tatlo, REJECTED na AGAD (pinal).
   Tuloy pa rin ito hanggang School Head, pero "Noted" na lang
   ang button ng mga susunod. Approved lang kapag LAHAT ng tatlo
   ay nag-Approve. Laging may komento (ReviewDialog), at
   nakikita ng lahat ang buong daan (ReviewTrail).

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

  /* Adviser, SAO, School Head, School Administrator: may sariling
     hanay ng proposal na naghihintay ng AKSYON NILA. */
  const isReviewer = [3, 4, 6, 8].includes(profile?.role_id)

  /* SAO, School Head at School Administrator: may organization
     filter, dahil proposals ng LAHAT ng org ang nakikita nila. */
  const showOrgFilter = [4, 6, 8].includes(profile?.role_id)

  /* School Administrator: ang may budget lang ang nakikita */
  const isSchoolAdmin = profile?.role_id === 8

  /* Officer: may sariling hanay ng proposal na ibinalik sa
     kanya para i-revise. */
  const isProposer = Boolean(can.propose)

  /* 'mine' → naghihintay ng aksyon mo · 'all' → lahat
     Reviewer: 'mine' agad. Officer: 'all' muna, dahil kadalasan
     ay wala siyang kailangang i-revise. */
  const [filter, setFilter] = useState(isReviewer ? 'mine' : 'all')

  /* '' = lahat ng org, o ang id ng napiling org */
  const [orgFilter, setOrgFilter] = useState('')

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

  /* ---------- REALTIME ----------
     Kapag may notification tungkol sa proposal (bagong dating sa
     stage mo, umusad ang proposal mo, ipina-revise), kinukuha ulit
     ang listahan — kaya lumalabas agad dito nang walang refresh.
     Galing ang notification sa mga trigger sa database
     (PROPOSAL_NOTIFICATIONS.sql, PROPOSAL_REVIEW_NOTIFICATIONS.sql). */
  const profileId = profile?.id
  useEffect(() => {
    if (!profileId) return undefined
    return subscribeToNotifications(profileId, {
      onInsert: (row) => {
        if (isProposalNotification(row)) load()
      },
    })
  }, [profileId, load])

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
        `The proposal was returned to the Officer for revision. It will come back to you once resubmitted.`,
      )
      return
    }

    const updated = await reviewProposal(proposal.id, action, comment)
    replaceProposal(updated)
    setReviewing(null)

    /* last  → tapos na ang buong daan
       moved → lumipat sa susunod na stage
       kung hindi → may iba pang SAO / School Head na hinihintay */
    const last = updated.stage === 'done'
    const moved = updated.stage !== proposal.stage
    const waitingCount = updated.pending_reviewers?.length ?? 0
    const next = last
      ? ''
      : moved
        ? ` It has been forwarded to ${stageLabel(updated.stage)}.`
        : ` Waiting for ${
            waitingCount > 0 ? `${waitingCount} more` : 'the other'
          } ${stageLabel(updated.stage)} before it moves on.`

    if (action === 'noted') {
      setNotice(last ? "Noted. The proposal's review is complete." : `Noted.${next}`)
    } else if (action === 'rejected') {
      setNotice(
        last
          ? 'The proposal was rejected (final).'
          : `The proposal was rejected — it is now Rejected (final).${next} The remaining reviewers can only mark it "Noted".`,
      )
    } else {
      setNotice(
        last
          ? 'The proposal was approved (final). The Officer can now create an event.'
          : `You approved the proposal.${next}`,
      )
    }
  }

  /* Mga pagpipilian sa organization filter. Galing sa mismong
     listahan, kaya ang lalabas lang ay ang mga org na may proposal,
     kasama ang bilang ng bawat isa. */
  const orgOptions = useMemo(() => {
    if (!showOrgFilter) return []
    const map = new Map()
    proposals.forEach((p) => {
      if (!p.organization_id) return
      const entry = map.get(p.organization_id) ?? {
        id: p.organization_id,
        name: p.organizations?.name ?? 'Unnamed organization',
        count: 0,
      }
      entry.count += 1
      map.set(p.organization_id, entry)
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [proposals, showOrgFilter])

  /* Kapag nawala sa listahan ang napiling org (hal. nabura ang
     nag-iisang proposal nito), balik sa lahat ng org. */
  const activeOrg = orgOptions.some((o) => o.id === orgFilter) ? orgFilter : ''

  /* Ang mga proposal na saklaw ng napiling org */
  const orgScoped = useMemo(
    () => (activeOrg ? proposals.filter((p) => p.organization_id === activeOrg) : proposals),
    [proposals, activeOrg],
  )

  /* Mga proposal na naghihintay ng aksyon mo:
     Reviewer → nasa stage mo · Officer → ibinalik sa iyo para i-revise */
  const mine = useMemo(
    () =>
      orgScoped.filter((p) =>
        isReviewer ? canReviewProposal(p, profile) : canReviseProposal(p, profile),
      ),
    [orgScoped, profile, isReviewer],
  )
  const showFilters = isReviewer || (isProposer && mine.length > 0)
  const shown = showFilters && filter === 'mine' ? mine : orgScoped

  /* Galing sa EventForm. Kapag nag-throw, doon lalabas ang
     error at mananatiling bukas ang form. */
  async function handleCreateEvent(values, { imageFile }) {
    const created = await createEventFromProposal(eventFor, values, imageFile)
    replaceProposal({ ...eventFor, events: { id: created.id } })
    setEventFor(null)
    setNotice('Event created. Members can now see it in Events.')
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
      setNotice('Proposal submitted.')
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
    setNotice(`Proposal resubmitted. It is back with ${stageLabel(updated.stage)}.`)
  }

  async function handleDownload(proposal) {
    setNotice('')
    setDownloadingId(proposal.id)
    try {
      await downloadProposalFile(proposal)
    } catch (err) {
      console.error('Hindi ma-download ang file:', err)
      setNotice('Could not download the file. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(proposal) {
    const ok = window.confirm(
      `Delete "${proposal.title}"? This cannot be undone.`,
    )
    if (!ok) return

    setDeletingId(proposal.id)
    setNotice('')
    try {
      await deleteProposal(proposal.id)
      await deleteProposalFile(proposal.attachment_path)
      setProposals((list) => list.filter((p) => p.id !== proposal.id))
      setNotice('Proposal deleted.')
    } catch (err) {
      console.error('Hindi nabura ang proposal:', err)
      setNotice(
        err?.message === 'not-allowed'
          ? "You don't have permission to delete this proposal."
          : 'Could not delete. Please try again.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Proposals"
        action={
          can.propose && (
            <ActionButton
              onClick={() => {
                setNotice('')
                setFormOpen(true)
              }}
            >
              + Create Proposal
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
        <div className={styles.filters}>
          <div className={styles.chipGroup} role="tablist" aria-label="Filter proposals">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'mine'}
              className={`${styles.filterChip} ${filter === 'mine' ? styles.filterActive : ''}`}
              onClick={() => setFilter('mine')}
            >
              {isReviewer
                ? `Awaiting your action (${mine.length})`
                : `For you to revise (${mine.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`${styles.filterChip} ${filter === 'all' ? styles.filterActive : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({orgScoped.length})
            </button>
          </div>

          {showOrgFilter && orgOptions.length > 0 && (
            <select
              className={styles.orgSelect}
              aria-label="Filter by organization"
              value={activeOrg}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="">All organizations</option>
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.count})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading && <p className={styles.status}>Loading proposals…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load proposals"
          message="There was a problem connecting to the database. Please try again later."
        />
      )}

      {!loading && !error && proposals.length > 0 && shown.length === 0 && (
        <EmptyState
          icon="✓"
          title="Nothing needs your action"
        />
      )}

      {!loading && !error && proposals.length === 0 && (
        <EmptyState
          icon="✉"
          title="No proposals yet"
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
                    {p.has_budget && <span className={styles.budgetTag}>With budget</span>}
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

                  {/* Kailan at saan ang activity (wala sa mga lumang proposal) */}
                  {(hasSchedule(p) || p.venue) && (
                    <p className={styles.meta}>
                      {hasSchedule(p) && (
                        <>
                          When: <strong>{scheduleDateLabel(p)}</strong>,{' '}
                          {scheduleTimeLabel(p)}
                        </>
                      )}
                      {hasSchedule(p) && p.venue && ' · '}
                      {p.venue && (
                        <>
                          Venue: <strong>{p.venue}</strong>
                        </>
                      )}
                    </p>
                  )}

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
                      title="Download file"
                    >
                      <span aria-hidden="true">📎</span>
                      <span className={styles.fileChipName}>{p.attachment_name}</span>
                      <span className={styles.fileChipMeta}>
                        {downloadingId === p.id
                          ? 'Downloading…'
                          : `${formatFileSize(p.attachment_size)} · Download`}
                      </span>
                    </button>
                  )}

                  {/* Adviser → SAO → School Head (→ School Administrator) */}
                  <ReviewTrail proposal={p} />
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.openButton}
                    onClick={() => setViewing(p)}
                  >
                    Open letter
                  </button>

                  {/* Rejected na: "Noted" lang ang aksyon */}
                  {canReviewProposal(p, profile) && awaitsNoted(p) && (
                    <button
                      type="button"
                      className={styles.notedButton}
                      onClick={() => openReview(p, 'noted')}
                    >
                      Noted
                    </button>
                  )}

                  {canReviewProposal(p, profile) && !awaitsNoted(p) && (
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
                      Revise
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
                      + Create Event
                    </button>
                  )}

                  {p.status === 'approved' && eventOfProposal(p) && (
                    <Link to="/events" className={styles.eventLink}>
                      View Event →
                    </Link>
                  )}

                  {manageable && (
                    <button
                      type="button"
                      className={`${styles.linkButton} ${styles.danger}`}
                      onClick={() => handleDelete(p)}
                      disabled={busy}
                    >
                      {busy ? 'Deleting…' : 'Delete'}
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