import { supabase } from './supabaseClient.js'

/* ============================================================
   NOTIFICATIONS — lahat ng pakikipag-usap sa database

   Table: public.notifications (tingnan ang EVENT_NOTIFICATIONS.sql)

   SAAN GALING:
     Hindi ang browser ang gumagawa ng notification. Mga TRIGGER
     sa database ang naglalagay nito:
       - bagong event → bawat aktibong Member, Officer at Adviser
         ng org (maliban sa gumawa) — EVENT_NOTIFICATIONS.sql,
         ADVISER_EVENT_NOTIFICATIONS.sql
       - na-upload (o napalitan) ang certificate mo → ikaw lang,
         na nag-Join at nakakumpleto ng event
         — CERTIFICATE_NOTIFICATIONS.sql
       - umusad ang proposal (approved, rejected, noted,
         ipina-revise) → ang Officer na nagpasa nito
         — PROPOSAL_NOTIFICATIONS.sql
       - dumating ang proposal sa stage mo → Adviser ng org,
         lahat ng SAO, o lahat ng School Head
         — PROPOSAL_REVIEW_NOTIFICATIONS.sql

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

   IISANG KONEKTA LANG para sa buong app: kahit ilang bahagi ang
   nakikinig (bell, Proposals page, bilang sa Dashboard), iisang
   realtime channel lang ang bukas. Ipinapasa sa lahat ng
   nakikinig ang bawat bagong notification. Sasara ang channel
   kapag wala nang nakikinig.
   ============================================================ */
const listeners = new Set()
let channel = null
let channelProfileId = null
let channelReady = false

/* Natatanging pangalan bawat channel, para hindi magbanggaan
   kapag mabilis na nabuksan-nasara (hal. React StrictMode sa dev) */
let channelSeq = 0

function closeChannel() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  channelProfileId = null
  channelReady = false
}

function openChannel(profileId) {
  if (channel && channelProfileId === profileId) return
  closeChannel()

  channelSeq += 1
  channelProfileId = profileId
  const mine = supabase.channel(`notifications:${profileId}:${channelSeq}`)
  channel = mine

  mine
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${profileId}`,
      },
      (payload) => {
        if (channel !== mine) return
        listeners.forEach((l) => l.onInsert?.(payload.new))
      },
    )
    .subscribe((status) => {
      /* Balita mula sa lumang channel na isinara na — huwag pansinin */
      if (channel !== mine) return
      if (status === 'SUBSCRIBED') {
        channelReady = true
        listeners.forEach((l) => l.onReconnect?.())
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        channelReady = false
        if (status !== 'CLOSED') console.warn('Realtime ng notifications:', status)
      }
    })
}

export function subscribeToNotifications(profileId, { onInsert, onReconnect } = {}) {
  const entry = { onInsert, onReconnect }
  listeners.add(entry)
  openChannel(profileId)

  /* Bukas na pala ang channel (may ibang nakikinig na) — sabihan
     agad ang bago para makakuha ito ng unang listahan */
  if (channelReady) setTimeout(() => entry.onReconnect?.(), 0)

  return () => {
    listeners.delete(entry)
    if (listeners.size === 0) closeChannel()
  }
}

/* Para sa mga page na kailangang mag-refresh kapag may galaw sa
   proposal (bagong dating, umusad, ipina-revise) */
export function isProposalNotification(row) {
  return row?.type === 'proposal_update' || row?.type === 'proposal_review'
}

/* Para sa Events page: kapag may bagong certificate, kunin ulit
   ang mga certificate mo para lumabas agad ang "I-download" */
export function isCertificateNotification(row) {
  return row?.type === 'certificate_ready'
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
