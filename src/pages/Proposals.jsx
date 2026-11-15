import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  Coins,
  Eye,
  Hourglass,
  MapPin,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  approversOf,
  authorName,
  authorRoleLabel,
  awaitsNoted,
  canManageProposal,
  canReviewProposal,
  createProposal,
  decisionLabel,
  deleteProposal,
  fetchProposals,
  finalStage,
  formatDateTime,
  hasBudget,
  hasSchedule,
  isPastSchedule,
  pendingReviewers,
  progressLabel,
  rejectedBy,
  reviewPath,
  reviewProgress,
  reviewProposal,
  reviewSteps,
  scheduleLabel,
  stageLabel,
} from '../lib/proposals.js'
import {
  attachmentsOf,
  deleteProposalFiles,
  downloadProposalFile,
  uploadProposalFiles,
} from '../lib/proposalFiles.js'
import { eventOfProposal, nowKey } from '../lib/events.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProposalForm from '../components/ProposalForm.jsx'
import ProposalLetter from '../components/ProposalLetter.jsx'
import ReviewDialog from '../components/ReviewDialog.jsx'
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
   Adviser     → Approve/Reject ng proposals ng org niya.
   SAO         → Approve/Reject ng proposals ng lahat ng
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

   FILES (PROPOSAL_MULTIPLE_FILES.sql): KAILANGAN may kahit isang
   file, hanggang 10. Bawat file ay may sariling download link sa
   card at sa sulat. Nasa folder pa rin ng org ang mga file.

   START DATE AT END DATE (PROPOSAL_START_END_DATE.sql): ang "When"
   sa card ay may petsa at oras ng simula at katapusan kapag higit
   isang araw ang activity (scheduleLabel()).

   PAGGAWA NG EVENT: WALA NA DITO. Inilipat na sa Events page
   ("+ Create Event" ng Officer — pipili siya ng sarili niyang
   approved na proposal ng org niya). Dito, kapag may event na
   ang isang approved na proposal, "View Event" lang ang lalabas.

   Ang bawat proposal ay binubuksan bilang PORMAL NA SULAT
   (components/ProposalLetter.jsx), na pwedeng i-print.

   Ang RLS sa database ang totoong nagbabantay. Ang
   can.propose at canManageProposal() dito ay para lang itago
   ang mga button na hindi mo magagamit.

   ITSURA ("route line" — UI lang, walang binago sa data o aksyon):
     - bawat proposal ay nasa malambot na box (hindi matapang na
       puti), may bilog na status sa kaliwa
     - ROUTE MAP: Officer → Adviser → SAO → School Head
       (→ School Admin) na parang mapa ng tren. Galing sa parehong
       data ng ReviewTrail (reviewPath + reviewSteps) — display lang.
     - Ang detalye ng review (dating ReviewTrail sa ilalim ng mapa)
       ay nakatapat na sa bawat istasyon: hal. sa ilalim ng ADVISER
       → "Pending · Waiting for: Test Adviser." Pareho ang laman at
       mga mensahe ng ReviewTrail; inilipat lang ng puwesto. Ang
       ReviewTrail component ay ginagamit pa rin ng ReviewDialog
       at ng sulat (ProposalLetter).
   ============================================================ */

/* Kulay at icon ng bawat proposal ayon sa kalagayan nito */
function toneOf(p) {
  if (p.status === 'approved') return 'approved'
  if (p.status === 'rejected') return 'rejected'
  return 'pending'
}

const TONE_ICON = {
  pending: Hourglass,
  approved: Check,
  rejected: X,
}

/* Maikling pangalan ng bawat istasyon sa route map */
const ROUTE_LABEL = {
  adviser: 'Adviser',
  sao: 'SAO',
  school_head: 'School Head',
  school_admin: 'School Admin',
}

const STATION_TEXT = {
  done: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  noted: 'Noted',
  current: 'In progress',
  upcoming: 'Not yet',
}

/* Mga istasyon ng route map (display lang):
     Officer      → "done" (naipasa)
     bawat stage  → "current" kapag naroon ngayon, o ang huling
                    desisyon doon (approved/rejected/noted), o
                    "upcoming" kapag hindi pa nararating */
function stationsOf(p) {
  const steps = reviewSteps(p)
  const lastDecision = (stage) => {
    let decision = null
    for (const step of steps) {
      const stepStage = step.stage === 'legacy' ? 'adviser' : step.stage
      if (stepStage === stage) decision = step.decision
    }
    return decision
  }

  const officer = { key: 'officer', label: 'Officer', state: 'done' }
  const stages = reviewPath(p).map((stage) => ({
    key: stage,
    label: ROUTE_LABEL[stage] ?? stageLabel(stage),
    state: p.stage === stage ? 'current' : lastDecision(stage) ?? 'upcoming',
  }))
  return [officer, ...stages]
}

const STATION_ICON = {
  done: Check,
  approved: Check,
  rejected: X,
  noted: Eye,
}

/* "Final: Approved" — kapareho ng stepLabel() sa ReviewTrail */
function stepLabel(step) {
  const label = decisionLabel(step.decision)
  return step.final ? `Final: ${label}` : label
}

/* ---------- DETALYE BAWAT ISTASYON (display lang) ----------
   Ang dating laman ng ReviewTrail, hinati ayon sa istasyon:
     entries → mga aksyong nagawa na sa stage na iyon
               (Approved / Rejected / Noted, sino, kailan, komento)
     waiting → kung naroon ngayon ang proposal: "Pending · 1 of 3"
               at kung sino ang hinihintay — PAREHONG mensahe ng
               ReviewTrail.
     chosen  → mga approver na pinili ng Officer (para sa mga
               stage na hindi pa nararating) */
function stationInfo(p) {
  const path = reviewPath(p)

  const stageOfStep = (step) => (step.stage === 'legacy' ? 'adviser' : (step.stage ?? null))

  const info = { officer: { entries: [], waiting: null, chosen: '' } }
  for (const stage of path) {
    info[stage] = {
      entries: [],
      waiting: null,
      chosen: approversOf(p, stage)
        .map((a) => a.name)
        .filter(Boolean)
        .join(', '),
    }
  }

  for (const step of reviewSteps(p)) {
    const stage = stageOfStep(step)
    if (stage && info[stage]) info[stage].entries.push(step)
  }

  /* Naghihintay pa — kapareho ng huling linya ng ReviewTrail */
  const waiting = stageLabel(p.stage)
  const target = p.stage
  if (waiting && info[target]) {
    const noted = awaitsNoted(p)
    const progress = reviewProgress(p)
    const pending = progress?.pending ?? pendingReviewers(p)
    const names = pending?.map((r) => r.name).filter(Boolean).join(', ')

    info[target].waiting = {
      status: `${noted ? 'For Noted' : 'Pending'}${
        progress && progress.total > 1 ? ` · ${progress.done} of ${progress.total}` : ''
      }`,
      text:
        pending && pending.length === 0 && (!progress || progress.total === 0)
          ? `No active ${waiting} account yet. It will continue once one is assigned.`
          : noted
            ? `Already rejected by ${rejectedBy(p)}. Waiting for "Noted" from ${names || waiting}.`
            : names
              ? `Waiting for: ${names}.`
              : p.stage === finalStage(p)
                ? `Waiting for the ${waiting}'s final decision.`
                : p.stage === 'school_head' && hasBudget(p)
                  ? 'Waiting for the School Head. It has a budget, so the School Administrator gives the final decision after.'
                  : `Waiting for action from ${waiting}.`,
    }
  }

  return info
}

function RouteMap({ proposal }) {
  const stations = stationsOf(proposal)
  const info = stationInfo(proposal)
  return (
    <ol className={styles.route} aria-label="Review route">
      {stations.map((s) => {
        const Icon = STATION_ICON[s.state]
        const { entries = [], waiting = null, chosen = '' } = info[s.key] ?? {}
        return (
          <li key={s.key} className={`${styles.station} ${styles[`st_${s.state}`] ?? ''}`}>
            <span className={styles.stationDot} aria-hidden="true">
              {Icon && <Icon size={13} strokeWidth={3} />}
            </span>
            <span className={styles.stationLabel}>{s.label}</span>

            {/* Detalye — nakatapat sa istasyong ito */}
            <div className={styles.stationInfo}>
              {entries.map((step) => (
                <div
                  key={step.key}
                  className={`${styles.info} ${styles[`info_${step.decision}`] ?? ''} ${
                    step.final ? styles.infoFinal : ''
                  }`}
                >
                  <span className={styles.infoStatus}>{stepLabel(step)}</span>
                  <span className={styles.infoText}>
                    by <strong>{step.name || '—'}</strong>
                  </span>
                  {step.at && <span className={styles.infoDate}>{formatDateTime(step.at)}</span>}
                  {step.comment && <span className={styles.infoComment}>{step.comment}</span>}
                </div>
              ))}

              {waiting && (
                <div className={`${styles.info} ${styles.info_waiting}`}>
                  <span className={styles.infoStatus}>{waiting.status}</span>
                  <span className={styles.infoText}>{waiting.text}</span>
                </div>
              )}

              {/* Officer: naipasa na (walang hinihintay sa kanya) */}
              {s.key === 'officer' && !waiting && (
                <div className={`${styles.info} ${styles.info_submitted}`}>
                  <span className={styles.infoStatus}>{STATION_TEXT.done}</span>
                </div>
              )}

              {/* Hindi pa nararating: "Not yet" + ang piniling approver */}
              {s.key !== 'officer' && !waiting && entries.length === 0 && (
                <div className={`${styles.info} ${styles.info_upcoming}`}>
                  <span className={styles.infoStatus}>{STATION_TEXT.upcoming}</span>
                  {chosen && <span className={styles.infoText}>{chosen}</span>}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

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

  /* 'mine' → naghihintay ng aksyon mo · 'all' → lahat
     Reviewer: 'mine' agad. Ang Officer ay walang filter — lahat
     ang nakikita niya. */
  const [filter, setFilter] = useState(isReviewer ? 'mine' : 'all')

  /* '' = lahat ng org, o ang id ng napiling org */
  const [orgFilter, setOrgFilter] = useState('')

  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  /* Bukas ba ang form ng bagong proposal */
  const [formOpen, setFormOpen] = useState(false)

  /* Aling proposal ang bukas bilang sulat */
  const [viewing, setViewing] = useState(null)

  const [deletingId, setDeletingId] = useState(null)

  /* Bukas na Approve/Reject/Noted dialog:
     null, o { proposal, action: 'approved' | 'rejected' | 'noted' } */
  const [reviewing, setReviewing] = useState(null)

  /* Aling file ang dina-download (ang path nito) */
  const [downloadingPath, setDownloadingPath] = useState(null)

  /* Oras ngayon sa Pilipinas — nag-a-update bawat 30 segundo para
     kusang mawala ang Approve, Reject at Noted pagpatak ng
     proposed na petsa at oras */
  const [now, setNow] = useState(() => nowKey())

  useEffect(() => {
    const timer = setInterval(() => setNow(nowKey()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])

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
     stage mo, umusad ang proposal mo), kinukuha ulit
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
  const closeLetter = useCallback(() => setViewing(null), [])
  const closeReview = useCallback(() => setReviewing(null), [])

  /* Inilalagay ang na-update na proposal sa listahan, at sa
     sulat kung iyon ang nakabukas. */
  function replaceProposal(updated) {
    setProposals((list) => list.map((p) => (p.id === updated.id ? updated : p)))
    setViewing((current) => (current?.id === updated.id ? updated : current))
  }

  /* Binubuksan ang ReviewDialog para sa Approve, Reject o Noted */
  function openReview(proposal, action) {
    setNotice('')
    setReviewing({ proposal, action })
  }

  /* Galing sa ReviewDialog. Approve, Reject o Noted man, may dahilan.
     Kapag nag-throw, doon lalabas ang error at mananatiling
     bukas ang dialog. */
  async function handleReview(comment) {
    const { proposal, action } = reviewing

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
          ? 'The proposal was approved (final). The Officer can now create its event in Events.'
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

  /* Mga proposal na naghihintay ng aksyon mo (nasa stage mo) —
     para sa Adviser, SAO, School Head at School Administrator */
  const mine = useMemo(
    () => (isReviewer ? orgScoped.filter((p) => canReviewProposal(p, profile)) : []),
    [orgScoped, profile, isReviewer],
  )
  const showFilters = isReviewer
  const shown = showFilters && filter === 'mine' ? mine : orgScoped

  /* Galing sa ProposalForm. Kapag nag-throw, doon lalabas ang
     error at mananatiling bukas ang form.

     Ang mga file ay ina-upload MUNA, bago i-save ang proposal.
     Kapag pumalya ang pag-save, binubura ang na-upload para
     walang maiwang file na walang gumagamit. */
  async function handleSubmit(values, { files }) {
    const uploaded = await uploadProposalFiles(profile, files)

    try {
      const created = await createProposal({ ...values, attachments: uploaded })
      setProposals((list) => [created, ...list])
      setNotice('Proposal submitted.')
    } catch (err) {
      await deleteProposalFiles(uploaded.map((f) => f.path))
      throw err
    }
    setFormOpen(false)
  }

  /* Dina-download ang isang file ({ path, name }) */
  async function handleDownload(file) {
    setNotice('')
    setDownloadingPath(file.path)
    try {
      await downloadProposalFile(file)
    } catch (err) {
      console.error('Hindi ma-download ang file:', err)
      setNotice('Could not download the file. Please try again.')
    } finally {
      setDownloadingPath(null)
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
      await deleteProposalFiles(attachmentsOf(proposal).map((f) => f.path))
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
    <div className={styles.page}>
      <PageHeader
        title="Proposals"
        action={
          can.propose && (
            /* Sariling itsura (.createBtn sa Proposals.module.css) — hindi
               na ang shared na ActionButton, para hindi magbago ang
               button sa ibang page (Events, Announcements, atbp.) */
            <button
              type="button"
              className={styles.createBtn}
              onClick={() => {
                setNotice('')
                setFormOpen(true)
              }}
            >
              <span className={styles.createIcon} aria-hidden="true">
                <Plus size={18} strokeWidth={2.8} />
              </span>
              Create Proposal
            </button>
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
              Awaiting your action ({mine.length})
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
            const tone = toneOf(p)
            const ToneIcon = TONE_ICON[tone]
            const yourTurn = canReviewProposal(p, profile)

            return (
              <li
                key={p.id}
                className={`${styles.card} ${styles[`tone_${tone}`] ?? ''} ${
                  yourTurn ? styles.yourTurn : ''
                }`}
              >
                {/* ---------- RAIL: bilog na status ---------- */}
                <span className={styles.rail} aria-hidden="true">
                  <span className={styles.railDot}>
                    <ToneIcon size={18} strokeWidth={2.6} />
                  </span>
                </span>

                <div className={styles.cardMain}>
                  <div className={styles.titleRow}>
                    <span className={`${styles.statusPill} ${styles[`status_${p.status}`] ?? ''}`}>
                      {progressLabel(p)}
                    </span>
                    {p.has_budget && (
                      <span className={styles.budgetTag}>
                        <Coins size={13} strokeWidth={2.6} aria-hidden="true" />
                        With budget
                      </span>
                    )}
                    <span className={styles.date}>{formatDateTime(p.created_at)}</span>
                  </div>

                  <h2 className={styles.title}>{p.title}</h2>

                  <ul className={styles.metaList}>
                    {isStaff && p.organizations?.name && (
                      <li className={styles.meta}>
                        <Building2 size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>
                          <strong>{p.organizations.name}</strong>
                          {p.organizations.program && ` · ${p.organizations.program}`}
                        </span>
                      </li>
                    )}

                    <li className={styles.meta}>
                      <User size={15} strokeWidth={2.2} aria-hidden="true" />
                      <span>
                        Proposed by: <strong>{authorName(p)}</strong> · {authorRoleLabel(p)}
                      </span>
                    </li>

                    {/* Kailan ang activity (wala sa mga lumang proposal).
                        Iisang araw: "Monday, October 5, 2026, 1:30 PM – 5:00 PM"
                        Maraming araw: "Fri, Nov 20, 2026, 8:00 AM – Sun, Nov 22, 2026, 5:00 PM" */}
                    {hasSchedule(p) && (
                      <li className={styles.meta}>
                        <CalendarDays size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>
                          When: <strong>{scheduleLabel(p)}</strong>
                        </span>
                      </li>
                    )}
                    {p.venue && (
                      <li className={styles.meta}>
                        <MapPin size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>
                          Venue: <strong>{p.venue}</strong>
                        </span>
                      </li>
                    )}
                  </ul>

                  {/* Wala nang listahan ng file dito — makikita at mada-download
                      ang mga attachment sa loob ng sulat (Open letter →
                      ProposalLetter, "Attachments"). */}

                  {/* Route map: Officer → Adviser → SAO → School Head (→ SA),
                      may detalye ng review sa ilalim ng bawat istasyon */}
                  <RouteMap proposal={p} />
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.openButton}
                    onClick={() => setViewing(p)}
                  >
                    <BookOpen size={16} strokeWidth={2.3} aria-hidden="true" />
                    Open letter
                  </button>

                  {/* Rejected na: "Noted" lang ang aksyon.
                      Wala na rin ito kapag lumampas na sa proposed na
                      petsa at oras ng activity. */}
                  {canReviewProposal(p, profile) && awaitsNoted(p) && !isPastSchedule(p, now) && (
                    <button
                      type="button"
                      className={styles.notedButton}
                      onClick={() => openReview(p, 'noted')}
                    >
                      <Eye size={16} strokeWidth={2.3} aria-hidden="true" />
                      Noted
                    </button>
                  )}

                  {/* Wala nang Approve at Reject kapag lumampas na
                      sa proposed na petsa at oras ng activity */}
                  {canReviewProposal(p, profile) && !awaitsNoted(p) && !isPastSchedule(p, now) && (
                    <>
                      <button
                        type="button"
                        className={styles.approveButton}
                        onClick={() => openReview(p, 'approved')}
                      >
                        <Check size={16} strokeWidth={2.8} aria-hidden="true" />
                        Approve
                      </button>
                      <button
                        type="button"
                        className={styles.rejectButton}
                        onClick={() => openReview(p, 'rejected')}
                      >
                        <X size={16} strokeWidth={2.8} aria-hidden="true" />
                        Reject
                      </button>
                    </>
                  )}

                  {p.status === 'approved' && eventOfProposal(p) && (
                    <Link to="/events" className={styles.eventLink}>
                      View Event
                      <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
                    </Link>
                  )}

                  {manageable && (
                    <button
                      type="button"
                      className={`${styles.linkButton} ${styles.danger}`}
                      onClick={() => handleDelete(p)}
                      disabled={busy}
                    >
                      <Trash2 size={15} strokeWidth={2.3} aria-hidden="true" />
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

      {viewing && (
        <ProposalLetter
          proposal={viewing}
          onClose={closeLetter}
          onDownload={handleDownload}
          downloadingPath={downloadingPath}
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
    </div>
  )
}

export default Proposals