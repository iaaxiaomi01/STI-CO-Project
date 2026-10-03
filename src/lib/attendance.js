import { supabase } from './supabaseClient.js'

/* ============================================================
   ATTENDANCE (QR) — lahat ng pakikipag-usap sa database

   Tingnan ang supabase/QR_ATTENDANCE.sql para sa buong
   paliwanag. Sa maikling salita:

     Member/Officer (nag-Join) → "Ipakita ang QR"
       issueAttendanceToken() bawat ~25 segundo. Ang token ay
       nag-e-expire pagkalipas ng 45 segundo, kaya walang silbi
       ang screenshot.

     Officer/Adviser → "I-scan"
       scanAttendance(token, eventId, 'in' | 'out')

     Officer/Adviser → manual mula sa listahan
       manualAttendance(eventId, profileId, 'in' | 'out')

   Ang database ang nagsusuri ng LAHAT (oras, org, Join, role).
   Ang mga function dito na tungkol sa oras ay para lang itago
   o ipakita ang mga button.
   ============================================================ */

/* Nakasulat sa QR: "ORGATT:<token>". Ang prefix ay para
   makilala agad ang ibang QR (hal. QR ng GCash) at hindi na
   ipadala sa database. */
const QR_PREFIX = 'ORGATT:'

/* Ilang segundo bago kumuha ng bagong QR. Mas maikli ito sa
   45 segundong buhay ng token para laging may palugit. */
export const QR_REFRESH_SECONDS = 25

export const MODE_IN = 'in'
export const MODE_OUT = 'out'

/* ---------- SINO ANG PWEDE (para sa mga button lang) ---------- */

/* Member at Officer na nag-Join ang may QR */
export function canShowQr(profile) {
  return Boolean(profile?.is_active && (profile.role_id === 1 || profile.role_id === 2))
}

/* Officer at Adviser ang nag-i-scan */
export function canScanAttendance(profile) {
  return Boolean(profile?.is_active && (profile.role_id === 2 || profile.role_id === 3))
}

/* ---------- ORAS ----------
   KAPAREHO ng mga interval sa QR_ATTENDANCE.sql. Kapag binago
   mo ang isa, baguhin mo rin ang isa.

   Ginagamit ang "YYYY-MM-DD HH:MM" na galing sa nowKey() sa
   lib/events.js (oras sa Pilipinas). */

function addMinutes(dateStr, timeStr, minutes) {
  /* Kinukuwenta bilang UTC para hindi magulo ng timezone ng
     computer; ang resulta ay "YYYY-MM-DD HH:MM" pa rin. */
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d, h, min + minutes))
  return t.toISOString().slice(0, 16).replace('T', ' ')
}

const OPEN_BEFORE_START = 30
const CLOSE_AFTER_END = 60

/* Bukas ba ang QR / pag-scan ngayon?
   30 min bago ang Start hanggang 60 min lampas End */
export function isAttendanceOpen(event, now) {
  const open = addMinutes(event.event_date, event.start_time, -OPEN_BEFORE_START)
  const close = addMinutes(event.event_date, event.end_time, CLOSE_AFTER_END)
  return now >= open && now <= close
}

/* Hindi pa bukas (para sa mensaheng "magbubukas sa …") */
export function attendanceOpensAt(event) {
  return addMinutes(event.event_date, event.start_time, -OPEN_BEFORE_START)
}

/* Pwede pa bang mag-manual (hanggang 24 oras lampas End) */
export function isManualOpen(event, now) {
  const open = addMinutes(event.event_date, event.start_time, -OPEN_BEFORE_START)
  const close = addMinutes(event.event_date, event.end_time, 24 * 60)
  return now >= open && now <= close
}

/* ---------- QR ---------- */

export function qrValueFor(token) {
  return `${QR_PREFIX}${token}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* Ibinabalik ang token, o null kung hindi ito QR ng attendance */
export function parseQrValue(text) {
  if (typeof text !== 'string' || !text.startsWith(QR_PREFIX)) return null
  const token = text.slice(QR_PREFIX.length).trim()
  return UUID_RE.test(token) ? token : null
}

/* ---------- DATABASE ---------- */

export async function issueAttendanceToken(eventId) {
  const { data, error } = await supabase.rpc('issue_attendance_token', { p_event: eventId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.token) throw new Error('no-token')
  return { token: row.token, expiresAt: row.expires_at }
}

/* Ibinabalik: { result: 'ok' | 'already', mode, name, role_id, time_in, time_out } */
export async function scanAttendance(token, eventId, mode) {
  const { data, error } = await supabase.rpc('scan_attendance', {
    p_token: token,
    p_event: eventId,
    p_mode: mode,
  })
  if (error) throw error
  return data
}

export async function manualAttendance(eventId, profileId, mode) {
  const { data, error } = await supabase.rpc('manual_attendance', {
    p_event: eventId,
    p_profile: profileId,
    p_mode: mode,
  })
  if (error) throw error
  return data
}

/* Attendance ng isang event → { [profile_id]: row }
   Officer/Adviser: lahat sa event · Member: sarili lang (RLS) */
export async function fetchEventAttendance(eventId) {
  const { data, error } = await supabase
    .from('event_attendance')
    .select('profile_id, time_in, time_in_method, time_out, time_out_method')
    .eq('event_id', eventId)

  if (error) throw error
  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.profile_id] = r
  })
  return map
}

/* Sariling attendance sa lahat ng event → { [event_id]: row } */
export async function fetchMyAttendance(profileId) {
  const { data, error } = await supabase
    .from('event_attendance')
    .select('event_id, time_in, time_out')
    .eq('profile_id', profileId)

  if (error) throw error
  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.event_id] = r
  })
  return map
}

/* { [event_id]: { timedIn, timedOut } } — Officer/Adviser */
export async function fetchAttendanceCounts() {
  const { data, error } = await supabase.rpc('event_attendance_counts')
  if (error) throw error
  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.event_id] = { timedIn: Number(r.timed_in), timedOut: Number(r.timed_out) }
  })
  return map
}

/* Attendance rate para sa Dashboard.
   Member  → sa mga natapos na event na sinalihan mo, ilan ang
             may Time In ka
   Officer/Adviser → sa buong org
   Ibinabalik ang "85%" o "—" kung wala pang natapos na event. */
export async function fetchAttendanceRate({ orgWide }) {
  const { data, error } = await supabase.rpc('attendance_summary')
  if (error) throw error
  if (!data) return '—'

  const joined = Number(orgWide ? data.org_joined : data.my_joined) || 0
  const attended = Number(orgWide ? data.org_attended : data.my_attended) || 0
  if (joined === 0) return '—'
  return `${Math.round((attended / joined) * 100)}%`
}

/* ---------- MENSAHE ---------- */

export function attendanceErrorMessage(err) {
  /* Galing sa "raise exception" — nakasulat na sa Tagalog */
  if (err?.code === 'P0001' && err.message) return err.message
  if (err?.code === '22P02') return 'Hindi kilala ang QR na ito.'
  if (err?.message === 'no-token') return 'Hindi makakuha ng QR. Subukan ulit.'
  return 'May problema sa pagkonekta. Subukan ulit.'
}

/* "1:05 PM" mula sa ISO timestamp, oras sa Pilipinas */
export function formatClock(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  })
}
