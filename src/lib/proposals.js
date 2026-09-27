import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'

/* ============================================================
   PROPOSALS — lahat ng pakikipag-usap sa database

   Walang .eq('organization_id', ...) sa pagkuha, at sinadya
   iyon. Ang RLS sa Supabase na ang nagsasala: Officer at
   Adviser lang, at proposals lang ng SARILI nilang org.
   Ang Member ay walang makukuha dito.

   Sa paggawa, title, description at proposed_to lang ang
   ipinapadala. Ang org, author at petsa ay itinatakda ng
   trigger sa database — hindi mapepeke mula sa browser.

   Ang Organization Name at Logo sa sulat ay galing sa
   organizations ( ... ) na join, hindi nakakopya sa proposal.
   Kaya kapag pinalitan ng Adviser ang logo sa Org Profile,
   kusang nagbabago rin ang lumang sulat.
   ============================================================ */

export const TITLE_MAX = 150
export const DESCRIPTION_MAX = 8000
export const PROPOSED_TO_MAX = 150

const COLUMNS = `
  id, organization_id, title, description, proposed_to,
  author_id, author_name, author_role_id,
  created_at, updated_at, updated_by,
  organizations ( name, department, logo_url )
`

export async function fetchProposals() {
  const { data, error } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createProposal({ title, description, proposedTo }) {
  const { data, error } = await supabase
    .from('proposals')
    .insert({ title, description, proposed_to: proposedTo })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function updateProposal(id, { title, description, proposedTo }) {
  const { data, error } = await supabase
    .from('proposals')
    .update({ title, description, proposed_to: proposedTo })
    .eq('id', id)
    .select(COLUMNS)

  if (error) throw error
  /* Walang row na bumalik = hinarang ng RLS (wala kang pahintulot) */
  if (!data || data.length === 0) throw new Error('not-allowed')
  return data[0]
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
   SINO ANG PWEDENG MAG-EDIT / MAG-DELETE

   KAPAREHO ito ng can_manage_proposal() sa database. Dito, para
   lang itago ang mga button. Ang database pa rin ang totoong
   nagbabantay — kapag binago mo ang isa, baguhin mo rin ang isa.

     Officer → sariling gawa lang
   ============================================================ */
export function canManageProposal(proposal, profile) {
  return Boolean(
    profile?.is_active &&
      profile.role_id === 2 &&
      proposal.organization_id === profile.organization_id &&
      proposal.author_id === profile.id,
  )
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

export function wasEdited(proposal) {
  return Boolean(proposal.updated_by)
}
