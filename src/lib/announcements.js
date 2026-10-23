import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'

/* ============================================================
   ANNOUNCEMENTS — lahat ng pakikipag-usap sa database

   Walang .eq('organization_id', ...) sa pagkuha, at sinadya
   iyon. Ang RLS sa Supabase na ang nagsasala: announcements
   ng SARILI mong org + mga GLOBAL na post (is_global = true,
   galing sa org na may can_announce_all) ang ibabalik.
   Tingnan ang ANNOUNCE_ALL_ORGS.sql.

   Sa paggawa, dumadaan sa post_announcement() (RPC) para
   sabay na magawa ang post at ang mga piniling org. Title,
   message, type at kung para kanino lang ang ipinapadala.
   Ang org, author, role at petsa ay itinatakda ng trigger sa
   database — hindi mapepeke mula sa browser.
   ============================================================ */

/* Dapat tugma sa check constraint na announcements_type_valid */
export const ANNOUNCEMENT_TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'urgent', label: 'Urgent' },
]

export const TITLE_MAX = 150
export const MESSAGE_MAX = 5000

export function typeLabel(value) {
  return ANNOUNCEMENT_TYPES.find((t) => t.value === value)?.label ?? value
}

const COLUMNS = `
  id, organization_id, title, message, type, is_global,
  author_id, author_name, author_role_id,
  created_at, updated_at, updated_by,
  organizations!announcements_organization_id_fkey ( name ),
  announcement_orgs ( organizations ( name ) )
`

/* Para kanino ang post — "Post to" sa form.
   'selected' = may rows sa announcement_orgs */
export const AUDIENCES = [
  { value: 'own', label: 'My organization only' },
  { value: 'all', label: 'All organizations' },
  { value: 'selected', label: 'Selected organizations' },
]

/* ============================================================
   ANNOUNCE SA LAHAT NG ORG

   Ang org na may organizations.can_announce_all = true (IT
   Admin ang nagse-set, sa database) ay kayang mag-post para sa
   LAHAT ng org — Officer at Adviser lang nito. Ang Member ay
   gaya pa rin ng ibang Member: hindi nakakapag-post.

   Para lang ito sa pagtatago/pagpapakita ng UI. Ang RLS pa rin
   ang totoong nagbabantay.
   ============================================================ */
export function orgCanAnnounceAll(profile) {
  return Boolean(profile?.is_active && profile?.organizations?.can_announce_all)
}

/* May "Post to: All organizations" ba sa form —
   Officer/Adviser (can.announce) ng special org */
export function canPostToAllOrgs(profile, can) {
  return Boolean(can?.announce) && orgCanAnnounceAll(profile)
}

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/* audience: 'own' | 'all' | 'selected'
   orgIds:   mga piniling org kapag 'selected' (hindi kasama ang
             sariling org — laging kasama na iyon) */
export async function createAnnouncement({
  title,
  message,
  type,
  audience = 'own',
  orgIds = [],
}) {
  const { data: id, error } = await supabase.rpc('post_announcement', {
    p_title: title,
    p_message: message,
    p_type: type,
    p_is_global: audience === 'all',
    p_org_ids: audience === 'selected' ? orgIds : [],
  })
  if (error) throw error

  const { data, error: readError } = await supabase
    .from('announcements')
    .select(COLUMNS)
    .eq('id', id)
    .single()

  if (readError) throw readError
  return data
}

/* Mga org na pwedeng piliin sa "Selected organizations":
   lahat ng aktibong org maliban sa sarili */
export async function fetchTargetOrganizations(ownOrgId) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)
    .neq('id', ownOrgId)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

/* Hindi kasama kung para kanino — hindi na ito nababago
   pagkatapos i-post (ini-lock ng announcements_before_update at
   ng RLS ng announcement_orgs). */
export async function updateAnnouncement(id, { title, message, type }) {
  const { data, error } = await supabase
    .from('announcements')
    .update({ title, message, type })
    .eq('id', id)
    .select(COLUMNS)

  if (error) throw error
  /* Walang row na bumalik = hinarang ng RLS (wala kang pahintulot) */
  if (!data || data.length === 0) throw new Error('not-allowed')
  return data[0]
}

export async function deleteAnnouncement(id) {
  const { data, error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')
}

/* Ilang announcement ang lumabas sa nakaraang ilang araw —
   para sa stat tile sa Dashboard. */
export async function countRecentAnnouncements(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('announcements')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  if (error) throw error
  return count ?? 0
}

/* ============================================================
   SINO ANG PWEDENG MAG-EDIT / MAG-DELETE

   KAPAREHO ito ng can_manage_announcement() sa database. Dito,
   para lang itago ang mga button. Ang database pa rin ang
   totoong nagbabantay — kapag binago mo ang isa, baguhin
   mo rin ang isa.

     Officer → gawa ng kahit sinong Officer sa org
     Adviser → sariling gawa + gawa ng mga Officer

   Sa SARILING org lang — kaya ang global post ay ang special
   org lang ang makakapag-edit/delete.
   ============================================================ */
export function canManageAnnouncement(announcement, profile) {
  if (!profile?.is_active) return false
  if (announcement.organization_id !== profile.organization_id) return false

  if (profile.role_id === 2) {
    return announcement.author_role_id === 2
  }
  if (profile.role_id === 3) {
    return (
      announcement.author_id === profile.id ||
      announcement.author_role_id === 2
    )
  }
  return false
}

/* Mga pangalan ng piniling org (walang laman = hindi 'selected') */
function targetNames(announcement) {
  return (announcement.announcement_orgs ?? [])
    .map((t) => t.organizations?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/* 'own' | 'all' | 'selected' */
export function audienceOf(announcement) {
  if (announcement.is_global) return 'all'
  if ((announcement.announcement_orgs ?? []).length > 0) return 'selected'
  return 'own'
}

/* "Student Council, Org A, Org B" — kasama ang org ng gumawa.
   null kapag hindi 'selected'. */
export function selectedOrgsLabel(announcement) {
  if (audienceOf(announcement) !== 'selected') return null
  const own = announcement.organizations?.name
  return [own, ...targetNames(announcement)].filter(Boolean).join(', ')
}

/* "Juan Dela Cruz · Officer"
   Para sa ibang org: "Juan Dela Cruz · Officer · Student Council" */
export function authorLabel(announcement) {
  const name = toTitleCase(announcement.author_name)
  const role = getRoleConfig(roleKeyFromId(announcement.author_role_id)).label
  const org =
    audienceOf(announcement) !== 'own' ? announcement.organizations?.name : null
  return org ? `${name} · ${role} · ${org}` : `${name} · ${role}`
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/* Na-edit kung may nag-update pagkatapos gawin */
export function wasEdited(announcement) {
  return Boolean(announcement.updated_by)
}
