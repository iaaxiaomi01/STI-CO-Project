import { supabase } from './supabaseClient.js'
import {
  fetchParticipants,
  formatDateTimeShort,
  formatEventDate,
  formatTime,
  nowKey,
  participantLabel,
} from './events.js'
import {
  PHASE_BEFORE,
  PHASE_CLOSED,
  PHASE_IN,
  attendancePhase,
  fetchEventAttendance,
  formatClock,
} from './attendance.js'
import { fullNameOf, toTitleCase } from './profile.js'
import { fetchOrganization } from './organization.js'
import { buildAttendanceWorkbook } from './attendanceWorkbook.js'
import stiLogoUrl from '../assets/sti-logo.png'

/* ============================================================
   EXPORT NG ATTENDANCE (bawat event) — Officer at Adviser

   Gumagawa ng totoong .xlsx na may design (kulay ng STI, logo,
   summary cards, kulay ng Status). Bumubukas sa Excel, Google
   Sheets at LibreOffice. Walang dagdag na package — sariling
   writer ang lib/xlsx.js, at ang itsura ay nasa
   lib/attendanceWorkbook.js.

   Laman:
     - itaas: banner, detalye ng event at ng org, at buod
     - talaan: lahat ng nag-Join, may Time In / Time Out at status

   Ang RLS pa rin ang nagbabantay: Officer/Adviser lang ang
   nakakabasa ng buong listahan at ng attendance ng org nila,
   at profile lang ng ka-org ang nababasa nila. Kung hindi
   mabasa ang profile (hal. lumipat ng org), blangko lang ang
   Student ID / Program / Year Level.
   ============================================================ */

const METHOD_LABEL = { qr: 'QR', manual: 'Manual' }

/* "Dela Cruz, Juan S." mula sa profile; kung wala, ang
   naka-save na pangalan sa event_participants */
function nameFor(participant, prof) {
  if (prof?.last_name && prof?.first_name) {
    const middle = prof.middle_name ? ` ${prof.middle_name.charAt(0).toUpperCase()}.` : ''
    return `${toTitleCase(prof.last_name)}, ${toTitleCase(prof.first_name)}${middle}`
  }
  return participantLabel(participant).name
}

/* Status ng bawat tao, ayon sa oras ngayon */
function statusFor(record, phase) {
  if (record?.time_in && record?.time_out) return 'Complete'
  if (record?.time_in) return phase === PHASE_CLOSED ? 'No Time Out' : 'Timed In'
  if (phase === PHASE_BEFORE || phase === PHASE_IN) return 'Not yet timed in'
  return 'Did not attend'
}

/* Profile ng mga sumali → { [id]: profile } */
async function fetchProfiles(ids) {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, student_id, first_name, middle_name, last_name, program, year_level')
    .in('id', ids)

  /* Hindi kritikal — blangko lang ang mga dagdag na column */
  if (error) {
    console.error('Hindi makuha ang profile ng mga sumali:', error)
    return {}
  }
  const map = {}
  ;(data ?? []).forEach((p) => {
    map[p.id] = p
  })
  return map
}

/* "attendance-general-assembly-2026-10-18.xlsx" */
function fileNameFor(event) {
  const slug =
    String(event.title ?? 'event')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'event'
  return `attendance-${slug}-${event.event_date}.xlsx`
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* Pangalan at department ng org — hindi kritikal */
async function fetchOrgInfo(orgId) {
  if (!orgId) return { name: '', department: '' }
  try {
    const org = await fetchOrganization(orgId)
    return { name: org?.name ?? '', department: org?.department ?? '' }
  } catch (err) {
    console.error('Hindi makuha ang org para sa export:', err)
    return { name: '', department: '' }
  }
}

/* STI logo → maliit na PNG (malaki ang orihinal na file, kaya
   pinapaliit muna para hindi bumigat ang .xlsx).
   Kapag pumalya, walang logo lang — tuloy pa rin ang export. */
async function loadLogo() {
  try {
    const img = new Image()
    img.src = stiLogoUrl
    await img.decode()
    const height = 140 // 2x ng 70px na lalabas sa Excel, para malinaw
    const width = Math.round((img.naturalWidth / img.naturalHeight) * height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return null
    return { data: new Uint8Array(await blob.arrayBuffer()), width, height }
  } catch (err) {
    console.error('Hindi ma-load ang logo para sa export:', err)
    return null
  }
}

/* Kinukuha ang data, gumagawa ng .xlsx, at dina-download.
   Ibinabalik ang bilang ng taong naisama.

   exportedBy (opsyonal): profile ng nag-export, para lumabas
   ang pangalan niya sa "Exported by". */
export async function exportEventAttendance(event, { exportedBy = null } = {}) {
  const [participants, attendance, org, logo] = await Promise.all([
    fetchParticipants(event.id),
    fetchEventAttendance(event.id),
    fetchOrgInfo(event.organization_id),
    loadLogo(),
  ])
  const profiles = await fetchProfiles(participants.map((p) => p.profile_id))

  const phase = attendancePhase(event, nowKey())

  const people = participants
    .map((p) => {
      const prof = profiles[p.profile_id]
      const rec = attendance[p.profile_id]
      return {
        name: nameFor(p, prof),
        studentId: prof?.student_id ?? '',
        role: participantLabel(p).role,
        program: prof?.program ?? '',
        yearLevel: prof?.year_level ?? '',
        joinedAt: p.joined_at ? formatDateTimeShort(p.joined_at) : '',
        timeIn: rec?.time_in ? formatClock(rec.time_in) : '',
        timeInMethod: METHOD_LABEL[rec?.time_in_method] ?? '',
        timeOut: rec?.time_out ? formatClock(rec.time_out) : '',
        timeOutMethod: METHOD_LABEL[rec?.time_out_method] ?? '',
        status: statusFor(rec, phase),
        hasIn: Boolean(rec?.time_in),
        hasOut: Boolean(rec?.time_out),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en-PH', { sensitivity: 'base' }))

  const workbook = buildAttendanceWorkbook({
    school: 'STI COLLEGE SAN PABLO',
    orgName: org.name,
    department: org.department,
    title: event.title,
    date: formatEventDate(event.event_date),
    time: `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`,
    location: event.location,
    exportedOn: formatDateTimeShort(new Date().toISOString()),
    exportedBy: exportedBy ? fullNameOf(exportedBy) : '',
    people,
    logo,
  })

  download(workbook.toBlob(), fileNameFor(event))
  return people.length
}
