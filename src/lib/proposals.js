import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'

/* ============================================================
   PROPOSALS — lahat ng pakikipag-usap sa database

   Walang .eq('organization_id', ...) sa pagkuha, at sinadya
   iyon. Ang RLS sa Supabase na ang nagsasala: Officer at
   Adviser: proposals lang ng SARILI nilang org. SAO at School
   Head: lahat ng org. Ang Member ay walang makukuha dito.

   Sa paggawa, title, description at (kung meron) ang file
   ang ipinapadala. Ang org, author at petsa ay itinatakda ng
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

   REVISE (PROPOSAL_REVISE.sql)
     Bukod sa Approve/Reject, ang Adviser at SAO ay may "Revise".
     Ibinabalik nito ang proposal sa Officer na NAGPASA para
     i-edit (stage = 'revision'). Nakahold ito — walang ibang
     makakaaksyon. Kapag naipasa ulit ng Officer, BABALIK ito sa
     nag-pa-revise (revision_from), hindi na uulit sa simula.
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
    return `With ${stageLabel(proposal.stage)}`
  }
  return statusLabel(proposal.status)
}

export const COMMENT_MAX = 2000
export const TITLE_MAX = 150
export const DESCRIPTION_MAX = 8000

const COLUMNS = `
  id, organization_id, title, description,
  attachment_path, attachment_name, attachment_size,
  author_id, author_name, author_role_id,
  status, review_comment, reviewed_by, reviewer_name, reviewed_at,
  stage, head_decision,
  adviser_decision, adviser_comment, adviser_name, adviser_reviewed_at,
  sao_decision, sao_comment, sao_name, sao_reviewed_at,
  revision_from, revision_count,
  created_at, updated_at, updated_by,
  organizations ( name, department, logo_url ),
  events ( id ),
  proposal_revisions ( id, stage, requester_name, comment, requested_at, resubmitted_at )
`

async function fetchOne(id) {
  const { data, error } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
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
  return data ?? []
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

export async function createProposal({ title, description, attachment = null }) {
  const { data, error } = await supabase
    .from('proposals')
    .insert({ title, description, ...attachmentColumns(attachment) })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return data
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
export async function resubmitProposal(id, { title, description, attachment = null }) {
  const { error } = await supabase.rpc('resubmit_proposal', {
    p_id: id,
    p_title: title,
    p_description: description,
    p_attachment_path: attachment?.path ?? null,
    p_attachment_name: attachment?.name ?? null,
    p_attachment_size: attachment?.size ?? null,
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
   nasa stage mo ang proposal (hindi ang School Head), at hindi
   pa ito rejected. */
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
     stage 'sao'         → SAO
     stage 'school_head' → School Head
   Kasama ang rejected na — "Noted" ang aksyon doon
   (tingnan ang awaitsNoted()). */
export function canReviewProposal(proposal, profile) {
  if (!profile?.is_active || proposal.status === 'approved') return false

  const stage = STAGES[proposal.stage]
  if (!stage || profile.role_id !== stage.roleId) return false

  if (proposal.stage === 'adviser') {
    return proposal.organization_id === profile.organization_id
  }
  return true
}

/* Ang School Head ang huling hakbang */
export function isFinalReview(proposal) {
  return proposal.stage === 'school_head'
}

/* Sino ang nag-reject: 'Adviser' / 'SAO' / 'School Head', o ''.
   Ang UNA lang ang mahalaga — iyon ang nagpasya. */
export function rejectedBy(proposal) {
  if (proposal.status !== 'rejected') return ''
  if (proposal.adviser_decision === 'rejected') return 'Adviser'
  if (proposal.sao_decision === 'rejected') return 'SAO'
  return 'School Head'
}

/* Ang mga aksyong nagawa na, sunod-sunod ayon sa oras:
   [{ key, role, decision, comment, name, at, final, resubmittedAt }]

   decision = 'approved' | 'rejected' | 'noted' | 'revision'
   Ang 'revision' ay galing sa proposal_revisions; may
   resubmittedAt kapag naipasa na ulit ng Officer.

   final = true sa hakbang na NAGPASYA:
     approved → ang Approve ng School Head
     rejected → ang UNANG nag-Reject (Adviser, SAO o School Head)

   Ang mga LUMANG proposal (bago ang 3-step review) ay walang
   adviser_decision at sao_decision. Ang Adviser ang nag-review
   sa kanila, at iyon na ang pinal. */
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
      role: 'Adviser',
      decision: proposal.adviser_decision,
      comment: proposal.adviser_comment,
      name: toTitleCase(proposal.adviser_name ?? ''),
      at: proposal.adviser_reviewed_at,
      final: false,
    })
  }

  if (proposal.sao_decision) {
    steps.push({
      key: 'sao',
      role: 'SAO',
      decision: proposal.sao_decision,
      comment: proposal.sao_comment,
      name: toTitleCase(proposal.sao_name ?? ''),
      at: proposal.sao_reviewed_at,
      final: false,
    })
  }

  /* Ang aksyon ng School Head (o ng Adviser sa mga LUMANG
     proposal) — kapag tapos na ang daan. Walang head_decision
     ang mga lumang proposal; ang status ang desisyon nila. */
  if (proposal.stage === 'done') {
    const legacy = !proposal.adviser_decision && !proposal.sao_decision
    steps.push({
      key: 'final',
      role: legacy ? 'Adviser' : 'School Head',
      decision: proposal.head_decision ?? proposal.status,
      comment: proposal.review_comment,
      name: reviewerName(proposal),
      at: proposal.reviewed_at,
      final: false,
    })
  }

  /* Alin ang nagpasya */
  if (proposal.status === 'approved') {
    const head = steps.find((s) => s.key === 'final')
    if (head) head.final = true
  } else if (proposal.status === 'rejected') {
    const first = ['adviser', 'sao', 'final']
      .map((key) => steps.find((s) => s.key === key))
      .find((s) => s?.decision === 'rejected')
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
     Adviser, SAO, School Head → ang naghihintay ng AKSYON NIYA
                                 (Approve/Reject o Noted)
   Ang RLS na ang nagsasala kung aling org ang kasama. */
export async function countPendingProposals(roleId) {
  const stage = Object.keys(STAGES).find((key) => STAGES[key].roleId === roleId)

  let query = supabase.from('proposals').select('id', { count: 'exact', head: true })

  /* Reviewer: lahat ng nasa stage niya, kasama ang rejected na
     naghihintay ng "Noted". Officer: ang hindi pa napapasyahan. */
  query = stage ? query.eq('stage', stage) : query.eq('status', 'pending')

  const { count, error } = await query

  if (error) throw error
  return count ?? 0
}
