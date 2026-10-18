import { supabase } from './supabaseClient.js'

/* ============================================================
   NOTIFICATIONS — lahat ng pakikipag-usap sa database

   Table: public.notifications (tingnan ang EVENT_NOTIFICATIONS.sql)

   SAAN GALING:
     Hindi ang browser ang gumagawa ng notification. Mga TRIGGER
     sa database ang naglalagay nito:
       - bagong event → bawat aktibong Member at Officer ng org
         (maliban sa gumawa) — EVENT_NOTIFICATIONS.sql
       - umusad ang proposal (approved, rejected, noted,
         ipina-revise) → ang Officer na nagpasa nito
         — PROPOSAL_NOTIFICATIONS.sql

   REALTIME:
     subscribeToNotifications() → nakikinig sa Supabase Realtime.
     Kapag may bagong row para sa iyo, tinatawag agad ang
     onInsert — walang refresh na kailangan.

   Sariling notification lang ang nakikita (RLS). Ang pagmarka
   na nabasa ay sa mga function lang sa database.
   ============================================================ */

const COLUMNS = 'id, type, title, body, link, event_id, proposal_id, tone, created_at, read_at'

/* Ilan ang ipapakita sa panel */
export const NOTIFICATION_LIMIT = 30

export async function fetchNotifications(limit = NOTIFICATION_LIMIT) {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/* Bilang ng hindi pa nababasa (lahat, hindi lang ang nasa panel) */
export async function countUnreadNotifications() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id) {
  const { error } = await supabase.rpc('mark_notification_read', { p_id: id })
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw error
}

/* ============================================================
   REALTIME

   handlers.onInsert(row) → may bagong notification
   handlers.onReconnect() → bagong konekta (unang beses, o
                            pagkatapos mawalan ng internet) —
                            dito kukunin ulit ang listahan para
                            walang makaligtaan

   Ibinabalik ang function na pantanggal ng subscription.
   ============================================================ */
/* Natatanging pangalan bawat subscription, para hindi magbanggaan
   kapag dalawang beses na-mount (hal. React StrictMode sa dev) */
let channelSeq = 0

export function subscribeToNotifications(profileId, { onInsert, onReconnect }) {
  channelSeq += 1
  const channel = supabase
    .channel(`notifications:${profileId}:${channelSeq}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${profileId}`,
      },
      (payload) => onInsert?.(payload.new),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onReconnect?.()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime ng notifications:', status)
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

/* ---------- PAG-FORMAT ---------- */

/* "Ngayon lang", "5 minuto na", "2 oras na", "Kahapon",
   "Okt 12" — maikli para sa panel */
export function timeAgo(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'Ngayon lang'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minuto na`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} oras na`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Kahapon'
  if (days < 7) return `${days} araw na`
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  })
}
