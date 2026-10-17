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
import { toTitleCase } from './profile.js'

/* ============================================================
   EXPORT NG ATTENDANCE (bawat event) — Officer at Adviser

   Gumagawa ng .csv na bumubukas nang diretso sa Excel at
   Google Sheets. Walang dagdag na package.

   Laman:
     - itaas: pangalan, petsa, oras at lugar ng event, at buod
     - talaan: lahat ng nag-Join, may Time In / Time Out at status

   Ang RLS pa rin ang nagbabantay: Officer/Adviser lang ang
   nakakabasa ng buong listahan at ng attendance ng org nila,
   at profile lang ng ka-org ang nababasa nila. Kung hindi
   mabasa ang profile (hal. lumipat ng org), blangko lang ang
   Student ID / Program / Year Level.
   ============================================================ */

const METHOD_LABEL = { qr: 'QR', manual: 'Manual' }

/* Isang cell ng CSV.
   - May kuwit, quote o bagong linya → nakapaloob sa "…"
   - Nagsisimula sa = + - @ → may ' sa unahan, para hindi
     ituring ng Excel na formula (CSV injection) */
function cell(value) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

/* Student ID na puro numero (hal. 02000123456): isinusulat na
   ="02000123456" para hindi alisin ng Excel ang 0 sa unahan */
function idCell(value) {
  if (!value) return ''
  const text = String(value)
  return /^\d+$/.test(text) ? `="${text}"` : cell(text)
}

function row(values) {
  return values.join(',')
}

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
  if (record?.time_in && record?.time_out) return 'Kumpleto'
  if (record?.time_in) return phase === PHASE_CLOSED ? 'Walang Time Out' : 'Naka-Time In'
  if (phase === PHASE_BEFORE || phase === PHASE_IN) return 'Hindi pa nakaka-Time In'
  return 'Hindi dumalo'
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

/* "attendance-general-assembly-2026-10-18.csv" */
function fileNameFor(event) {
  const slug =
    String(event.title ?? 'event')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'event'
  return `attendance-${slug}-${event.event_date}.csv`
}

function download(text, fileName) {
  /* ﻿ (BOM) — para mabasa ng Excel nang tama ang ñ at
     iba pang letra */
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* Kinukuha ang data, gumagawa ng CSV, at dina-download.
   Ibinabalik ang bilang ng taong naisama. */
export async function exportEventAttendance(event) {
  const [participants, attendance] = await Promise.all([
    fetchParticipants(event.id),
    fetchEventAttendance(event.id),
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

  const timedIn = people.filter((p) => p.hasIn).length
  const complete = people.filter((p) => p.hasOut).length

  const lines = [
    row([cell('Event'), cell(event.title)]),
    row([cell('Petsa'), cell(formatEventDate(event.event_date))]),
    row([cell('Oras'), cell(`${formatTime(event.start_time)} – ${formatTime(event.end_time)}`)]),
    row([cell('Lugar'), cell(event.location)]),
    row([
      cell('Buod'),
      cell(`Sumali: ${people.length}`),
      cell(`Naka-Time In: ${timedIn}`),
      cell(`Kumpleto (may Time Out): ${complete}`),
    ]),
    row([cell('Na-export noong'), cell(formatDateTimeShort(new Date().toISOString()))]),
    '',
    row(
      [
        'Blg.',
        'Student ID',
        'Pangalan',
        'Role',
        'Program',
        'Year Level',
        'Sumali noong',
        'Time In',
        'Paraan (In)',
        'Time Out',
        'Paraan (Out)',
        'Status',
      ].map(cell),
    ),
    ...people.map((p, i) =>
      row([
        cell(i + 1),
        idCell(p.studentId),
        cell(p.name),
        cell(p.role),
        cell(p.program),
        cell(p.yearLevel),
        cell(p.joinedAt),
        cell(p.timeIn),
        cell(p.timeInMethod),
        cell(p.timeOut),
        cell(p.timeOutMethod),
        cell(p.status),
      ]),
    ),
  ]

  download(lines.join('\r\n'), fileNameFor(event))
  return people.length
}
