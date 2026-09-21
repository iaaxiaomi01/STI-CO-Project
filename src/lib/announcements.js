import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'

/* ============================================================
   ANNOUNCEMENTS — lahat ng pakikipag-usap sa database

   Walang .eq('organization_id', ...) sa pagkuha, at sinadya
   iyon. Ang RLS sa Supabase na ang nagsasala: announcements
   lang ng SARILI mong org ang ibabalik.

   Sa paggawa, title, message at type lang ang ipinapadala.
   Ang org, author, role at petsa ay itinatakda ng trigger sa
   database — hindi mapepeke mula sa browser.
   ============================================================ */

/* Dapat tugma sa check constraint na announcements_type_valid */
export const ANNOUNCEMENT_TYPES = [
  { value: 'general', label: 'Pangkalahatan' },
  { value: 'event', label: 'Event' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'reminder', label: 'Paalala' },
  { value: 'urgent', label: 'Urgent' },
]

export const TITLE_MAX = 150
export const MESSAGE_MAX = 5000

export function typeLabel(value) {
  return ANNOUNCEMENT_TYPES.find((t) => t.value === value)?.label ?? value
}

const COLUMNS = `
  id, organization_id, title, message, type,
  author_id, author_name, author_role_id,
  created_at, updated_at, updated_by
`

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createAnnouncement({ title, message, type }) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, message, type })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return data
}

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

/* "Juan Dela Cruz · Officer" */
export function authorLabel(announcement) {
  const name = toTitleCase(announcement.author_name)
  const role = getRoleConfig(roleKeyFromId(announcement.author_role_id)).label
  return `${name} · ${role}`
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
