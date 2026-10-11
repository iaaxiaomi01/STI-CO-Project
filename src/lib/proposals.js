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

   ANG DALOY NG REVIEW (PROPOSAL_THREE_STEP_REVIEW.sql)
     Officer nagpasa → Adviser → SAO → School Head
   Approve man o Reject ang Adviser at SAO, TULOY pa rin ito
   hanggang School Head. Ang School Head ang PINAL: siya lang
   ang nagtatakda ng status, at kapag 'approved', saka lang
   makakagawa ng event ang Officer.
   ============================================================ */

/* ---------- STATUS ----------
   Ang status ay ang PINAL na desisyon. Habang 'pending',
   nasa isa sa tatlong stage ang proposal. */
export const STATUS_LABELS = {
  pending: 'Naghihintay',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status
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

/* Ang nakasulat sa badge ng card:
   "Nasa Adviser" / "Nasa SAO" / "Nasa School Head" habang
   naghihintay; "Approved" / "Rejected" kapag tapos na. */
export function progressLabel(proposal) {
  if (proposal.status === 'pending' && STAGES[proposal.stage]) {
    return `Nasa ${stageLabel(proposal.stage)}`
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
  stage,
  adviser_decision, adviser_comment, adviser_name, adviser_reviewed_at,
  sao_decision, sao_comment, sao_name, sao_reviewed_at,
  created_at, updated_at, updated_by,
  organizations ( name, department, logo_url ),
  events ( id )
`

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
   AKSYON NG ADVISER, SAO AT SCHOOL HEAD — Approve at Reject

   Dumadaan sa function na review_proposal() sa database. Doon
   sinusuri kung ikaw ang tamang tao para sa kasalukuyang stage,
   at doon itinatakda ang pangalan mo, ang petsa, at ang
   susunod na stage. Ang komento ay KAILANGAN, Approve man o
   Reject — hinaharang ito ng database kahit malusutan ang
   check sa browser.

   decision = 'approved' | 'rejected'
   ============================================================ */
export async function reviewProposal(id, decision, comment = '') {
  const { error } = await supabase.rpc('review_proposal', {
    p_id: id,
    p_decision: decision,
    p_comment: comment.trim(),
  })

  if (error) {
    if (error.message === 'not-allowed') throw new Error('not-allowed')
    throw error
  }

  const { data, error: fetchError } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError
  return data
}

/* Ikaw ba ang dapat umaksyon ngayon?
     stage 'adviser'     → Adviser ng org na iyon
     stage 'sao'         → SAO
     stage 'school_head' → School Head */
export function canReviewProposal(proposal, profile) {
  if (!profile?.is_active || proposal.status !== 'pending') return false

  const stage = STAGES[proposal.stage]
  if (!stage || profile.role_id !== stage.roleId) return false

  if (proposal.stage === 'adviser') {
    return proposal.organization_id === profile.organization_id
  }
  return true
}

/* Ang School Head ang nagbibigay ng PINAL na desisyon */
export function isFinalReview(proposal) {
  return proposal.stage === 'school_head'
}

/* Ang mga aksyong nagawa na, sunod-sunod:
   [{ key, role, decision, comment, name, at, final }]

   Ang mga LUMANG proposal (bago ang 3-step review) ay walang
   adviser_decision at sao_decision. Ang Adviser ang nag-review
   sa kanila, at iyon na ang pinal. */
export function reviewSteps(proposal) {
  const steps = []

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

  if (proposal.status !== 'pending') {
    const legacy = !proposal.adviser_decision && !proposal.sao_decision
    steps.push({
      key: 'final',
      role: legacy ? 'Adviser' : 'School Head',
      decision: proposal.status,
      comment: proposal.review_comment,
      name: reviewerName(proposal),
      at: proposal.reviewed_at,
      final: true,
    })
  }

  return steps
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
     Adviser, SAO, School Head → ang naghihintay ng AKSYON NIYA
   Ang RLS na ang nagsasala kung aling org ang kasama. */
export async function countPendingProposals(roleId) {
  const stage = Object.keys(STAGES).find((key) => STAGES[key].roleId === roleId)

  let query = supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (stage) query = query.eq('stage', stage)

  const { count, error } = await query

  if (error) throw error
  return count ?? 0
}
