import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'
import { formatEventDate, formatTime, nowKey } from './events.js'

/* ============================================================
   PROPOSALS — lahat ng pakikipag-usap sa database

   Walang .eq('organization_id', ...) sa pagkuha, at sinadya
   iyon. Ang RLS sa Supabase na ang nagsasala: Officer at
   Adviser: proposals lang ng SARILI nilang org. SAO at School
   Head: lahat ng org. Ang Member ay walang makukuha dito.

   Sa paggawa, title, description, venue, petsa, oras at (kung
   meron) ang file ang ipinapadala. Ang org, author at petsa ay itinatakda ng
   trigger sa database — hindi mapepeke mula sa browser.

   Ang Organization Name at Logo sa sulat ay galing sa
   organizations ( ... ) na join, hindi nakakopya sa proposal.
   Kaya kapag pinalitan ng Adviser ang logo sa Org Profile,
   kusang nagbabago rin ang lumang sulat.

   Ang events ( id ) na join ay para malaman kung may event na
   ang isang approved na proposal — para alam kung "Gumawa ng
   Event" o "Tingnan ang Event" ang ipapakita.

   ANG DALOY NG REVIEW (PROPOSAL_REJECT_IMMEDIATE.sql)
     Officer nagpasa → Adviser → SAO → School Head
   Kapag may NAG-REJECT sa tatlo, REJECTED na AGAD ang status
   (pinal). Pero tuloy pa rin ito sa mga susunod, at "Noted" na
   lang ang aksyon nila (may komento). Approved lang kapag
   LAHAT ng tatlo ay nag-Approve — saka lang makakagawa ng
   event ang Officer.

   MARAMING SAO AT SCHOOL HEAD (PROPOSAL_MULTI_SAO_SCHOOL_HEAD.sql)
     Dumadaan ang proposal sa LAHAT ng aktibong SAO, saka sa LAHAT
     ng aktibong School Head — sabay-sabay, kahit sino ang mauna.
     Lilipat lang sa susunod na stage kapag nakaaksyon na ang
     lahat. Ang aksyon ng bawat isa ay nasa proposal_reviews; ang
     mga hinihintay pa ay galing sa RPC na
     proposal_pending_reviewers() (pending_reviewers sa bawat
     proposal). Isang Adviser lang ng org, tulad ng dati.

   REVISE (PROPOSAL_REVISE.sql)
     Bukod sa Approve/Reject, ang Adviser at SAO ay may "Revise".
     Ibinabalik nito ang proposal sa Officer na NAGPASA para
     i-edit (stage = 'revision'). Nakahold ito — walang ibang
     makakaaksyon. Kapag naipasa ulit ng Officer, BABALIK ito sa
     nag-pa-revise (revision_from), hindi na uulit sa simula.
     Sa SAO: mananatili ang Approve ng mga SAO na nakaaksyon na;
     ang nag-pa-revise at ang hindi pa umaaksyon na lang ang
     susuri.
   ============================================================ */

/* ---------- STATUS ----------
   Ang status ay ang PINAL na desisyon.
     pending  → wala pang nag-reject, hindi pa tapos
     rejected → may nag-reject (kahit nasa SAO o School Head
                pa ito para sa "Noted")
     approved → nag-Approve ang lahat ng tatlo */
export const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status
}

/* Ang mga aksyon sa isang hakbang ng review */
export const DECISION_LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
  noted: 'Noted',
  revision: 'Revision requested',
}

export function decisionLabel(decision) {
  return DECISION_LABELS[decision] ?? decision
}

/* ---------- STAGE: kanino nakatoka ang proposal ngayon ----------
   adviser → sao → school_head → done
   Kapareho ito ng review_proposal() sa database. */
export const STAGES = {
  adviser: { roleId: 3, label: 'Adviser' },
  sao: { roleId: 4, label: 'SAO' },
  school_head: { roleId: 6, label: 'School Head' },
}

export function stageLabel(stage) {
  return STAGES[stage]?.label ?? ''
}

/* Mga stage na LAHAT ng may role ang dadaanan (hindi isa lang) */
export const MULTI_STAGES = ['sao', 'school_head']

export function isMultiStage(stage) {
  return MULTI_STAGES.includes(stage)
}

/* Mga aksyon sa isang stage (SAO o School Head), mula pinakaluma */
export function stageReviews(proposal, stage = proposal.stage) {
  return (proposal.proposal_reviews ?? [])
    .filter((r) => r.stage === stage)
    .sort((a, b) => new Date(a.reviewed_at) - new Date(b.reviewed_at))
}

/* Nakaaksyon ka na ba sa stage na ito? */
export function hasReviewed(proposal, profileId, stage = proposal.stage) {
  return stageReviews(proposal, stage).some((r) => r.reviewer_id === profileId)
}

/* Sino pa ang hinihintay sa kasalukuyang stage (SAO / School Head):
   [{ id, name }]. null kapag hindi alam (hal. hindi makuha). */
export function pendingReviewers(proposal) {
  return proposal.pending_reviewers ?? null
}

/* Ilan na ang umaksyon sa kasalukuyang stage, at ilan lahat.
   null kapag hindi SAO / School Head ang stage o hindi alam. */
export function reviewProgress(proposal) {
  if (!isMultiStage(proposal.stage)) return null
  const pending = pendingReviewers(proposal)
  if (!pending) return null
  const done = stageReviews(proposal).length
  return { done, total: done + pending.length, pending }
}

/* Ilan pa ang hinihintay BUKOD sa iyo (para malaman kung ikaw na
   ang huli sa stage). 0 kapag Adviser stage. */
export function othersPendingCount(proposal, profileId) {
  if (!isMultiStage(proposal.stage)) return 0
  const pending = pendingReviewers(proposal)
  if (!pending) return 0
  return pending.filter((r) => r.id !== profileId).length
}

/* Nasa daan pa ba (may hinihintay pang aksyon)? Kasama ang
   rejected na dumadaan pa para sa "Noted". */
export function isInReview(proposal) {
  return Boolean(STAGES[proposal.stage])
}

/* Rejected na, pero hinihintay pa ang "Noted" ng susunod */
export function awaitsNoted(proposal) {
  return proposal.status === 'rejected' && isInReview(proposal)
}

/* Ang nakasulat sa badge ng card:
   "Nasa Adviser" / "Nasa SAO" / "Nasa School Head" habang
   naghihintay; "Rejected · Nasa SAO" kapag rejected na pero
   dumadaan pa; "Approved" / "Rejected" kapag tapos na. */
export function progressLabel(proposal) {
  if (isInRevision(proposal)) {
    return `Returned by ${stageLabel(proposal.revision_from)} · Revise`
  }
  if (awaitsNoted(proposal)) {
    return `Rejected · With ${stageLabel(proposal.stage)}`
  }
  if (proposal.status === 'pending' && isInReview(proposal)) {
    const progress = reviewProgress(proposal)
    return progress && progress.total > 1
      ? `With ${stageLabel(proposal.stage)} · ${progress.done}/${progress.total}`
      : `With ${stageLabel(proposal.stage)}`
  }
  return statusLabel(proposal.status)
}

export const COMMENT_MAX = 2000
export const TITLE_MAX = 150
export const DESCRIPTION_MAX = 8000
export const VENUE_MAX = 200

const COLUMNS = `
  id, organization_id, title, description,
  venue, event_date, start_time, end_time,
  attachment_path, attachment_name, attachment_size,
  author_id, author_name, author_role_id, author_position,
  status, review_comment, reviewed_by, reviewer_name, reviewed_at,
  stage, head_decision,
  adviser_decision, adviser_comment, adviser_name, adviser_reviewed_at,
  sao_decision, sao_comment, sao_name, sao_reviewed_at,
  revision_from, revision_count,
  created_at, updated_at, updated_by,
  organizations ( name, department, logo_url ),
  events ( id ),
  proposal_revisions ( id, stage, requester_name, comment, requested_at, resubmitted_at ),
  proposal_reviews ( id, stage, reviewer_id, reviewer_name, decision, comment, reviewed_at )
`

/* Idinadagdag sa bawat proposal ang pending_reviewers: ang mga SAO /
   School Head na hinihintay pa. Galing sa RPC dahil hindi nababasa
   ng Officer ang profiles ng staff (RLS).

   Kapag pumalya, null ang ilalagay — gagana pa rin ang page, hindi
   lang maipapakita kung sino ang hinihintay. */
async function withPendingReviewers(list) {
  const ids = list.filter((p) => isMultiStage(p.stage)).map((p) => p.id)
  if (ids.length === 0) return list.map((p) => ({ ...p, pending_reviewers: [] }))

  const { data, error } = await supabase.rpc('proposal_pending_reviewers', { p_ids: ids })
  if (error) {
    console.error('Hindi makuha ang mga hinihintay na reviewer:', error)
    return list.map((p) => ({ ...p, pending_reviewers: null }))
  }

  const byProposal = new Map()
  for (const row of data ?? []) {
    if (!byProposal.has(row.proposal_id)) byProposal.set(row.proposal_id, [])
    byProposal.get(row.proposal_id).push({
      id: row.reviewer_id,
      name: toTitleCase(row.reviewer_name ?? ''),
    })
  }

  return list.map((p) => ({
    ...p,
    pending_reviewers: isMultiStage(p.stage) ? (byProposal.get(p.id) ?? []) : [],
  }))
}

async function fetchOne(id) {
  const { data, error } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw error
  const [withPending] = await withPendingReviewers([data])
  return withPending
}

/* Mensahe galing sa database (raise exception) → Error na may
   parehong message, para maipakita sa dialog. */
function rpcError(error) {
  if (error.message === 'not-allowed') return new Error('not-allowed')
  return error
}

export async function fetchProposals() {
  const { data, error } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return withPendingReviewers(data ?? [])
}

/* attachment = { path, name, size } galing sa uploadProposalFile()
   (lib/proposalFiles.js), o null kapag walang file. */
function attachmentColumns(attachment) {
  return {
    attachment_path: attachment?.path ?? null,
    attachment_name: attachment?.name ?? null,
    attachment_size: attachment?.size ?? null,
  }
}

/* Venue, petsa at oras ng activity (PROPOSAL_VENUE_DATE_TIME.sql).
   Galing sa ProposalForm: eventDate "2026-10-05",
   startTime/endTime "13:30". */
function scheduleColumns({ venue, eventDate, startTime, endTime }) {
  return {
    venue,
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
  }
}

export async function createProposal({ title, description, attachment = null, ...schedule }) {
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      title,
      description,
      ...scheduleColumns(schedule),
      ...attachmentColumns(attachment),
    })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return { ...data, pending_reviewers: [] }
}

export async function deleteProposal(id) {
  const { data, error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')
}

/* ============================================================
   AKSYON NG ADVISER, SAO AT SCHOOL HEAD — Approve, Reject, Noted

   Dumadaan sa function na review_proposal() sa database. Doon
   sinusuri kung ikaw ang tamang tao para sa kasalukuyang stage,
   at doon itinatakda ang pangalan mo, ang petsa, at ang
   susunod na stage. Ang komento ay KAILANGAN sa lahat —
   hinaharang ito ng database kahit malusutan ang check sa
   browser.

   decision = 'approved' | 'rejected'  → kapag pending pa
            = 'noted'                  → kapag rejected na
   ============================================================ */
export async function reviewProposal(id, decision, comment = '') {
  const { error } = await supabase.rpc('review_proposal', {
    p_id: id,
    p_decision: decision,
    p_comment: comment.trim(),
  })

  if (error) throw rpcError(error)
  return fetchOne(id)
}

/* ============================================================
   REVISE — Adviser o SAO: ibalik sa Officer para i-edit

   Kailangan ang komento: ano ang dapat baguhin. Nakahold ang
   proposal hanggang maipasa ulit ng Officer. Hindi na pwede
   kapag rejected na.
   ============================================================ */
export async function requestRevision(id, comment) {
  const { error } = await supabase.rpc('request_proposal_revision', {
    p_id: id,
    p_comment: comment.trim(),
  })

  if (error) throw rpcError(error)
  return fetchOne(id)
}

/* Officer: ipasa ulit ang na-edit na proposal.
   attachment = { path, name, size } o null kapag walang file.
   Kapag pareho ang path sa dati, hindi binago ang file. */
export async function resubmitProposal(
  id,
  { title, description, venue, eventDate, startTime, endTime, attachment = null },
) {
  const { error } = await supabase.rpc('resubmit_proposal', {
    p_id: id,
    p_title: title,
    p_description: description,
    p_attachment_path: attachment?.path ?? null,
    p_attachment_name: attachment?.name ?? null,
    p_attachment_size: attachment?.size ?? null,
    p_venue: venue,
    p_event_date: eventDate,
    p_start_time: startTime,
    p_end_time: endTime,
  })

  if (error) throw rpcError(error)
  return fetchOne(id)
}

/* Nakabalik ba sa Officer para i-revise? */
export function isInRevision(proposal) {
  return proposal.status === 'pending' && proposal.stage === 'revision'
}

/* Ang pinakahuling pa-revise (ang hinihintay pang maipasa ulit) */
export function latestRevision(proposal) {
  const list = revisionsOf(proposal)
  return list.length ? list[list.length - 1] : null
}

/* Lahat ng pa-revise, mula pinakaluma */
export function revisionsOf(proposal) {
  return [...(proposal.proposal_revisions ?? [])].sort(
    (a, b) => new Date(a.requested_at) - new Date(b.requested_at),
  )
}

/* Pwede ka bang mag-Revise ngayon? Adviser at SAO lang, kapag
   nasa stage mo ang proposal (hindi ang School Head), hindi pa
   ito rejected, at hindi ka pa nakaaksyon dito. */
export function canRequestRevision(proposal, profile) {
  return (
    proposal.status === 'pending' &&
    ['adviser', 'sao'].includes(proposal.stage) &&
    canReviewProposal(proposal, profile)
  )
}

/* Ikaw ba ang Officer na dapat mag-revise? */
export function canReviseProposal(proposal, profile) {
  return Boolean(
    profile?.is_active &&
      profile.role_id === 2 &&
      isInRevision(proposal) &&
      proposal.organization_id === profile.organization_id &&
      proposal.author_id === profile.id,
  )
}

/* Ikaw ba ang dapat umaksyon ngayon?
     stage 'adviser'     → Adviser ng org na iyon
     stage 'sao'         → bawat SAO na HINDI pa nakaaksyon
     stage 'school_head' → bawat School Head na HINDI pa nakaaksyon
   Kasama ang rejected na — "Noted" ang aksyon doon
   (tingnan ang awaitsNoted()). */
export function canReviewProposal(proposal, profile) {
  if (!profile?.is_active || proposal.status === 'approved') return false

  const stage = STAGES[proposal.stage]
  if (!stage || profile.role_id !== stage.roleId) return false

  if (proposal.stage === 'adviser') {
    return proposal.organization_id === profile.organization_id
  }
  return !hasReviewed(proposal, profile.id)
}

/* Ikaw ba ang HULING aksyon sa buong daan? School Head stage, at
   wala nang ibang School Head na hinihintay. */
export function isFinalReview(proposal, profileId) {
  return proposal.stage === 'school_head' && othersPendingCount(proposal, profileId) === 0
}

/* Uusad ba ang proposal sa susunod na stage pagkatapos ng aksyon
   mo? Adviser: laging oo. SAO / School Head: kapag ikaw na ang huli. */
export function completesStage(proposal, profileId) {
  return othersPendingCount(proposal, profileId) === 0
}

/* Sino ang nag-reject: 'Adviser', 'SAO (Juan Cruz)',
   'School Head (Maria Santos)', o ''.
   Ang UNA lang ang mahalaga — iyon ang nagpasya. */
export function rejectedBy(proposal) {
  if (proposal.status !== 'rejected') return ''
  if (proposal.adviser_decision === 'rejected') return 'Adviser'

  for (const stage of MULTI_STAGES) {
    const first = stageReviews(proposal, stage).find((r) => r.decision === 'rejected')
    if (first) {
      const name = toTitleCase(first.reviewer_name ?? '')
      return name && name !== '—' ? `${stageLabel(stage)} (${name})` : stageLabel(stage)
    }
  }

  if (proposal.sao_decision === 'rejected') return 'SAO'
  return 'School Head'
}

/* Ang mga aksyong nagawa na, sunod-sunod ayon sa oras:
   [{ key, role, decision, comment, name, at, final, resubmittedAt }]

   decision = 'approved' | 'rejected' | 'noted' | 'revision'
   Ang 'revision' ay galing sa proposal_revisions; may
   resubmittedAt kapag naipasa na ulit ng Officer.

   Ang bawat SAO at School Head ay may sariling hakbang (galing sa
   proposal_reviews), kaya kung tatlo ang SAO, tatlo rin ang linya.

   final = true sa hakbang na NAGPASYA:
     approved → ang HULING Approve ng School Head
     rejected → ang UNANG nag-Reject (Adviser, SAO o School Head)

   Ang mga LUMANG proposal (bago ang 3-step review) ay walang
   adviser_decision at walang proposal_reviews. Ang Adviser ang
   nag-review sa kanila, at iyon na ang pinal. */
export function reviewSteps(proposal) {
  const steps = []

  for (const rev of revisionsOf(proposal)) {
    steps.push({
      key: `revision-${rev.id}`,
      role: stageLabel(rev.stage),
      decision: 'revision',
      comment: rev.comment,
      name: toTitleCase(rev.requester_name ?? ''),
      at: rev.requested_at,
      final: false,
      resubmittedAt: rev.resubmitted_at,
    })
  }

  if (proposal.adviser_decision) {
    steps.push({
      key: 'adviser',
      stage: 'adviser',
      role: 'Adviser',
      decision: proposal.adviser_decision,
      comment: proposal.adviser_comment,
      name: toTitleCase(proposal.adviser_name ?? ''),
      at: proposal.adviser_reviewed_at,
      final: false,
    })
  }

  const reviews = proposal.proposal_reviews ?? []
  for (const review of reviews) {
    steps.push({
      key: `review-${review.id}`,
      stage: review.stage,
      role: stageLabel(review.stage),
      decision: review.decision,
      comment: review.comment,
      name: toTitleCase(review.reviewer_name ?? ''),
      at: review.reviewed_at,
      final: false,
    })
  }

  /* LUMANG proposal: Adviser lang ang nag-review, at pinal na iyon.
     Walang head_decision; ang status ang desisyon. */
  if (proposal.stage === 'done' && !proposal.adviser_decision && reviews.length === 0) {
    steps.push({
      key: 'legacy',
      stage: 'legacy',
      role: 'Adviser',
      decision: proposal.head_decision ?? proposal.status,
      comment: proposal.review_comment,
      name: reviewerName(proposal),
      at: proposal.reviewed_at,
      final: proposal.status !== 'pending',
    })
  }

  const byTime = (a, b) =>
    (a.at ? new Date(a.at).getTime() : 0) - (b.at ? new Date(b.at).getTime() : 0)

  /* Alin ang nagpasya */
  if (proposal.status === 'approved') {
    const heads = steps
      .filter((s) => s.stage === 'school_head' && s.decision === 'approved')
      .sort(byTime)
    if (heads.length) heads[heads.length - 1].final = true
  } else if (proposal.status === 'rejected') {
    const adviser = steps.find((s) => s.stage === 'adviser' && s.decision === 'rejected')
    const first =
      adviser ??
      steps
        .filter((s) => isMultiStage(s.stage) && s.decision === 'rejected')
        .sort(byTime)[0]
    if (first) first.final = true
  }

  /* Ayon sa oras, para tama ang pagkakasunod kapag may pa-revise
     sa gitna (hal. Adviser approved → SAO revise → SAO approved).
     Ang walang petsa ay nananatili sa puwesto nito. */
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      const ta = a.step.at ? new Date(a.step.at).getTime() : null
      const tb = b.step.at ? new Date(b.step.at).getTime() : null
      if (ta === null || tb === null || ta === tb) return a.index - b.index
      return ta - tb
    })
    .map(({ step }) => step)
}

/* ============================================================
   SINO ANG PWEDENG MAG-DELETE

   Wala nang pag-edit ng proposal. Kapag may mali, burahin ito
   habang wala pang umaaksyon, at gumawa ng bago.

   KAPAREHO ito ng "proposals_delete_own" sa database. Dito, para
   lang itago ang mga button. Ang database pa rin ang totoong
   nagbabantay — kapag binago mo ang isa, baguhin mo rin ang isa.

     Officer → sariling gawa lang, at habang nasa Adviser pa at
               hindi pa niya nagagalaw. Kapag may nag-approve o
               nag-reject na, hindi na ito mabubura.
   ============================================================ */
export function canManageProposal(proposal, profile) {
  return Boolean(
    profile?.is_active &&
      profile.role_id === 2 &&
      proposal.organization_id === profile.organization_id &&
      proposal.author_id === profile.id &&
      proposal.status === 'pending' &&
      proposal.stage === 'adviser' &&
      !proposal.adviser_decision,
  )
}

/* "Maria Santos" — ALL CAPS sa database, Title Case dito */
export function reviewerName(proposal) {
  return toTitleCase(proposal.reviewer_name ?? '')
}

/* "Juan Dela Cruz" — ALL CAPS sa database, Title Case dito */
export function authorName(proposal) {
  return toTitleCase(proposal.author_name)
}

/* "Officer" */
export function authorRoleLabel(proposal) {
  return getRoleConfig(roleKeyFromId(proposal.author_role_id)).label
}

/* "President" — officer position ng nagpasa NOONG ipinasa ito.
   Kinokopya ng trigger sa database (PROPOSAL_AUTHOR_POSITION.sql),
   kaya hindi nagbabago kahit mapalitan ang position mamaya.
   null kapag walang position. */
export function authorPositionLabel(proposal) {
  return proposal.author_position?.trim() || null
}

/* "September 28, 2026" — pang-sulat na petsa */
export function formatLetterDate(iso) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/* "Sep 28, 2026, 2:15 PM" — para sa listahan */
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/* Para sa stat tile sa Dashboard.
     Officer                   → lahat ng naghihintay pa sa org niya
                                 (kasama ang nakabalik para i-revise)
     Adviser                   → lahat ng nasa Adviser stage ng org niya
     SAO, School Head          → ang nasa stage niya na HINDI pa niya
                                 naaaksyunan (Approve/Reject o Noted)
   Ang RLS na ang nagsasala kung aling org ang kasama. */
export async function countPendingProposals(roleId, profileId) {
  const stage = Object.keys(STAGES).find((key) => STAGES[key].roleId === roleId)

  /* SAO / School Head: bawasan ng mga naaksyunan na niya */
  if (isMultiStage(stage)) {
    const [atStage, mine] = await Promise.all([
      supabase.from('proposals').select('id').eq('stage', stage),
      supabase
        .from('proposal_reviews')
        .select('proposal_id')
        .eq('stage', stage)
        .eq('reviewer_id', profileId),
    ])

    if (atStage.error) throw atStage.error
    if (mine.error) throw mine.error

    const done = new Set((mine.data ?? []).map((r) => r.proposal_id))
    return (atStage.data ?? []).filter((p) => !done.has(p.id)).length
  }

  let query = supabase.from('proposals').select('id', { count: 'exact', head: true })

  /* Adviser: lahat ng nasa stage niya, kasama ang rejected na
     naghihintay ng "Noted". Officer: ang hindi pa napapasyahan. */
  query = stage ? query.eq('stage', stage) : query.eq('status', 'pending')

  const { count, error } = await query

  if (error) throw error
  return count ?? 0
}

/* ============================================================
   VENUE, PETSA AT ORAS NG ACTIVITY

   Ang mga LUMANG proposal (bago ang PROPOSAL_VENUE_DATE_TIME.sql)
   ay walang laman dito — kaya laging suriin ang hasSchedule().
   ============================================================ */
export function hasSchedule(proposal) {
  return Boolean(proposal?.event_date && proposal?.start_time && proposal?.end_time)
}

/* "Monday, October 5, 2026" */
export function scheduleDateLabel(proposal) {
  return hasSchedule(proposal) ? formatEventDate(proposal.event_date) : ''
}

/* "1:30 PM – 5:00 PM" */
export function scheduleTimeLabel(proposal) {
  if (!hasSchedule(proposal)) return ''
  return `${formatTime(proposal.start_time)} – ${formatTime(proposal.end_time)}`
}

/* "2026-10-20" — ngayong araw sa Pilipinas, para sa min ng
   <input type="date"> */
export function todayKey() {
  return nowKey().slice(0, 10)
}

/* Nasa hinaharap ba ang simula? Kapareho ng check sa database. */
export function isFutureSchedule(eventDate, startTime) {
  return `${eventDate} ${startTime.slice(0, 5)}` > nowKey()
}
