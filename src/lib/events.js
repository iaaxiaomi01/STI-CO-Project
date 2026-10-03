import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'
import { checkImageFile, extensionFor, ImageError, resizeToFit } from './image.js'

/* ============================================================
   EVENTS — lahat ng pakikipag-usap sa database

   Ang event ay laging galing sa isang APPROVED na proposal:
     Officer nagpasa → Adviser nag-Approve → ang NAGPASA ang
     may "Gumawa ng Event" na button sa Proposals.

   Walang .eq('organization_id', ...) sa pagkuha. Ang RLS na ang
   nagsasala: events lang ng SARILI mong org.

   Sa paggawa, ang org, author at petsa ay itinatakda ng trigger
   sa database. Sinusuri din doon na approved ang proposal at
   ikaw ang nagpasa — hindi ito malulusutan mula sa browser.

   Picture: event-images/<org id>/<proposal id>/<timestamp>.webp
   ============================================================ */

const BUCKET = 'event-images'
const IMAGE_MAX_SIDE = 1600

export const EVENT_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
]

export function eventStatusLabel(value) {
  return EVENT_STATUSES.find((s) => s.value === value)?.label ?? value
}

/* ============================================================
   AUTOMATIC NA STATUS

   Hindi na pinipili ang status. Kinukuwenta ito mula sa Date,
   Start Time at End Time, kumpara sa oras NGAYON sa Pilipinas:

     bago mag-Start Time          → Upcoming
     mula Start hanggang End Time → Ongoing
     lampas na sa End Time        → Completed

   Laging oras ng Pilipinas (Asia/Manila) ang gamit, kahit iba
   ang timezone ng computer ng tumitingin.

   Ang lumang "status" column sa database ay hindi na ginagamit.
   ============================================================ */
const EVENT_TIMEZONE = 'Asia/Manila'

/* "2026-09-29 17:27" — ang oras ngayon sa Pilipinas */
export function nowKey(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: EVENT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/* Pareho ang anyo ng "YYYY-MM-DD HH:MM", kaya pwedeng
   ikumpara bilang text. */
export function computeStatus(event, now = nowKey()) {
  const start = `${event.event_date} ${event.start_time.slice(0, 5)}`
  const end = `${event.event_date} ${event.end_time.slice(0, 5)}`
  if (now < start) return 'upcoming'
  if (now < end) return 'ongoing'
  return 'completed'
}

export const TITLE_MAX = 150
export const DESCRIPTION_MAX = 8000
export const LOCATION_MAX = 200

const COLUMNS = `
  id, organization_id, proposal_id,
  status, title, description, event_date, start_time, end_time, location, image_url,
  author_id, author_name, author_role_id,
  created_at, updated_at, updated_by
`

/* Isinasalin ang error ng database sa mensaheng maiintindihan */
export function eventErrorMessage(err) {
  if (err instanceof ImageError) return err.message
  if (err?.code === '23505') return 'May event na para sa proposal na ito.'
  if (err?.code === '23514') {
    if (err.message?.includes('events_time_order')) {
      return 'Dapat mas huli ang End Time kaysa sa Start Time.'
    }
    return 'May mali sa inilagay mo. Suriin ang mga field.'
  }
  if (err?.message === 'not-allowed') return 'Wala kang pahintulot na baguhin ang event na ito.'
  /* Galing sa "raise exception" ng trigger — nakasulat na sa Tagalog */
  if (err?.code === 'P0001' && err.message) return err.message
  return 'Hindi na-save. Subukan ulit.'
}

export async function fetchEvents() {
  const { data, error } = await supabase
    .from('events')
    .select(COLUMNS)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return data ?? []
}

/* ============================================================
   BILANG PARA SA DASHBOARD

   Automatic ang status (kinukuwenta sa browser), kaya hindi ito
   mabibilang sa database. Kinukuha ang petsa at oras ng mga
   event mula NGAYONG ARAW pataas — ang mas luma ay siguradong
   Completed na — tapos binibilang dito.

     upcoming → hindi pa nagsisimula
     ongoing  → nagaganap ngayon
     active   → upcoming + ongoing
   ============================================================ */
export async function countEventsByStatus() {
  const now = nowKey()
  const today = now.slice(0, 10)

  const { data, error } = await supabase
    .from('events')
    .select('event_date, start_time, end_time')
    .gte('event_date', today)

  if (error) throw error

  const counts = { upcoming: 0, ongoing: 0, active: 0 }
  ;(data ?? []).forEach((e) => {
    const status = computeStatus(e, now)
    if (status === 'completed') return
    counts[status] += 1
    counts.active += 1
  })
  return counts
}

/* ---------- PICTURE ---------- */

function folderOf(orgId, proposalId) {
  return `${orgId}/${proposalId}`
}

async function uploadImage(orgId, proposalId, file) {
  checkImageFile(file)

  const blob = await resizeToFit(file, IMAGE_MAX_SIDE)
  const path = `${folderOf(orgId, proposalId)}/${Date.now()}.${extensionFor(blob)}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { path, publicUrl }
}

async function removeFiles(paths) {
  if (paths.length === 0) return
  try {
    await supabase.storage.from(BUCKET).remove(paths)
  } catch (err) {
    console.warn('Hindi nabura ang larawan:', err)
  }
}

/* Binubura ang lahat ng larawan ng event na ito, maliban sa `keep`.
   Hindi kritikal kapag pumalya — lumang file lang ang maiiwan. */
async function cleanupImages(orgId, proposalId, keep) {
  if (!proposalId) return
  try {
    const folder = folderOf(orgId, proposalId)
    const { data, error } = await supabase.storage.from(BUCKET).list(folder)
    if (error) throw error
    const paths = (data ?? [])
      .map((f) => `${folder}/${f.name}`)
      .filter((p) => p !== keep)
    await removeFiles(paths)
  } catch (err) {
    console.warn('Hindi nabura ang lumang larawan ng event:', err)
  }
}

/* ---------- GUMAWA / MAG-EDIT / MAG-BURA ---------- */

function toRow(values) {
  return {
    title: values.title,
    description: values.description,
    event_date: values.eventDate,
    start_time: values.startTime,
    end_time: values.endTime,
    location: values.location,
  }
}

export async function createEventFromProposal(proposal, values, imageFile = null) {
  let uploaded = null
  if (imageFile) {
    uploaded = await uploadImage(proposal.organization_id, proposal.id, imageFile)
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      ...toRow(values),
      proposal_id: proposal.id,
      image_url: uploaded?.publicUrl ?? null,
    })
    .select(COLUMNS)
    .single()

  if (error) {
    /* Hindi na-save → burahin ang na-upload para walang maiwang file */
    if (uploaded) await removeFiles([uploaded.path])
    throw error
  }
  return data
}

/* options.imageFile   → bagong larawan
   options.removeImage → alisin ang kasalukuyang larawan */
export async function updateEvent(event, values, { imageFile = null, removeImage = false } = {}) {
  const row = toRow(values)

  let uploaded = null
  if (imageFile) {
    if (!event.proposal_id) {
      throw new ImageError('Hindi na mapapalitan ang larawan ng event na ito.')
    }
    uploaded = await uploadImage(event.organization_id, event.proposal_id, imageFile)
    row.image_url = uploaded.publicUrl
  } else if (removeImage) {
    row.image_url = null
  }

  const { data, error } = await supabase
    .from('events')
    .update(row)
    .eq('id', event.id)
    .select(COLUMNS)

  if (error || !data || data.length === 0) {
    if (uploaded) await removeFiles([uploaded.path])
    if (error) throw error
    /* Walang row na bumalik = hinarang ng RLS */
    throw new Error('not-allowed')
  }

  if (uploaded || removeImage) {
    await cleanupImages(event.organization_id, event.proposal_id, uploaded?.path ?? null)
  }
  return data[0]
}

export async function deleteEvent(event) {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', event.id)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')

  await cleanupImages(event.organization_id, event.proposal_id, null)
}

/* ============================================================
   SINO ANG PWEDENG GUMAWA / MAG-EDIT / MAG-DELETE

   KAPAREHO ito ng events_before_insert() at can_manage_event()
   sa database. Dito, para lang itago ang mga button — kapag
   binago mo ang isa, baguhin mo rin ang isa.

     Gumawa  → Officer na NAGPASA ng proposal, kapag approved
               na, at wala pang event
     Edit    → Officer: sariling gawa · Adviser: lahat sa org
   ============================================================ */

/* Ang event na naka-kabit sa proposal (galing sa join sa
   lib/proposals.js). Object o array ang ibinabalik ng Supabase
   depende sa relasyon, kaya tinatanggap ang dalawa. */
export function eventOfProposal(proposal) {
  const e = proposal?.events
  if (Array.isArray(e)) return e[0] ?? null
  return e ?? null
}

export function canCreateEventFrom(proposal, profile) {
  return Boolean(
    profile?.is_active &&
      profile.role_id === 2 &&
      proposal.organization_id === profile.organization_id &&
      proposal.author_id === profile.id &&
      proposal.status === 'approved' &&
      !eventOfProposal(proposal),
  )
}

export function canManageEvent(event, profile) {
  if (!profile?.is_active) return false
  if (event.organization_id !== profile.organization_id) return false
  if (profile.role_id === 3) return true
  if (profile.role_id === 2) return event.author_id === profile.id
  return false
}

/* ---------- PAG-FORMAT ---------- */

/* "2026-10-05" → "Monday, October 5, 2026"
   Binabasa bilang lokal na petsa para hindi umatras ng isang
   araw dahil sa timezone. */
export function formatEventDate(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/* "13:30:00" → "1:30 PM" */
export function formatTime(hms) {
  if (!hms) return ''
  const [h, min] = hms.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, min)
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

/* "13:30:00" → "13:30" para sa <input type="time"> */
export function toTimeInput(hms) {
  return hms ? hms.slice(0, 5) : ''
}

export function authorLabel(event) {
  const name = toTitleCase(event.author_name)
  const role = getRoleConfig(roleKeyFromId(event.author_role_id)).label
  return `${name} · ${role}`
}

export function wasEdited(event) {
  return Boolean(event.updated_by)
}

/* ============================================================
   JOIN — pagsali ng Member at Officer sa event

   Table: public.event_participants
     Join    → insert (event_id lang ang ipinapadala; ang pangalan,
               role at org ay itinatakda ng trigger sa database)
     Umalis  → delete ng sariling row

   Parehong hinaharang ng database kapag tapos na ang event.

   Sino ang nakakakita:
     Member           → sariling join lang, at ang BILANG ng sasali
     Officer, Adviser → buong listahan ng sasali
   ============================================================ */

/* Member at Officer lang ang may Join */
export function canJoinEvents(profile) {
  return Boolean(profile?.is_active && (profile.role_id === 1 || profile.role_id === 2))
}

/* Officer at Adviser lang ang nakakakita ng listahan */
export function canViewParticipants(profile) {
  return Boolean(profile?.is_active && (profile.role_id === 2 || profile.role_id === 3))
}

/* Mga event_id na sinalihan mo → Set */
export async function fetchMyJoinedEventIds(profileId) {
  const { data, error } = await supabase
    .from('event_participants')
    .select('event_id')
    .eq('profile_id', profileId)

  if (error) throw error
  return new Set((data ?? []).map((r) => r.event_id))
}

/* { [event_id]: bilang ng sasali } */
export async function fetchParticipantCounts() {
  const { data, error } = await supabase.rpc('event_participant_counts')
  if (error) throw error

  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.event_id] = Number(r.total)
  })
  return map
}

export async function joinEvent(eventId) {
  const { error } = await supabase.from('event_participants').insert({ event_id: eventId })

  /* 23505 = nakasali ka na (baka dalawang beses napindot) */
  if (error && error.code !== '23505') throw error
}

export async function leaveEvent(eventId, profileId) {
  const { data, error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .select('event_id')

  if (error) throw error
  /* Walang nabura = tapos na ang event, naka-Time In ka na (QR
     attendance), o hindi ka naman nakasali */
  if (!data || data.length === 0) throw new Error('not-allowed')
}

export async function fetchParticipants(eventId) {
  const { data, error } = await supabase
    .from('event_participants')
    .select('profile_id, participant_name, participant_role_id, joined_at')
    .eq('event_id', eventId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function participantLabel(p) {
  return {
    name: toTitleCase(p.participant_name),
    role: getRoleConfig(roleKeyFromId(p.participant_role_id)).label,
  }
}

export function joinErrorMessage(err) {
  if (err?.message === 'not-allowed') {
    return 'Hindi na pwedeng umalis — tapos na ang event, o naka-Time In ka na.'
  }
  /* Galing sa trigger — nakasulat na sa Tagalog */
  if (err?.code === 'P0001' && err.message) return err.message
  /* RLS: tapos na ang event o wala kang pahintulot */
  if (err?.code === '42501') return 'Hindi ka na makakasali — tapos na ang event.'
  return 'Hindi na-save. Subukan ulit.'
}

/* Mga event na sinalihan mo, kasama ang detalye ng event —
   para sa Attendance page ng Member at Officer.
   Pinakabagong sinalihan muna. */
export async function fetchMyJoinedEvents(profileId) {
  const { data, error } = await supabase
    .from('event_participants')
    .select(
      `joined_at,
       events ( id, title, event_date, start_time, end_time, location, image_url )`,
    )
    .eq('profile_id', profileId)
    .order('joined_at', { ascending: false })

  if (error) throw error
  /* Laktawan kung hindi na mabasa ang event (hal. nabura) */
  return (data ?? [])
    .filter((r) => r.events)
    .map((r) => ({ ...r.events, joined_at: r.joined_at }))
}

/* "Sep 30, 2026, 12:30 AM" */
export function formatDateTimeShort(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
