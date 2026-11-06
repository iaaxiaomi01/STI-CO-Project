import { Workbook } from './xlsx.js'

/* ============================================================
   DESIGN NG ATTENDANCE EXCEL (bawat event)

   Purong layout lang ito: walang Supabase, walang fetch.
   Ang lib/attendanceExport.js ang kumukuha ng data at tumatawag
   dito, kaya madaling baguhin ang itsura nang hindi
   ginagalaw ang pagkuha ng data.

   ITSURA (kulay ng STI, gaya ng sa sidebar at dashboard):
     ┌───────────────────────────────────────────────┐
     │ [logo]  STI COLLEGE SAN PABLO                 │  navy
     │         EVENT ATTENDANCE REPORT               │  dilaw na letra
     │         Pangalan ng Org                       │
     ├───────────────────────────────────────────────┤  dilaw na guhit
     │ Event / Date / Time / Location │ Org / Dept / Exported on
     │ [Joined] [Timed In] [Completed] [Attendance Rate]   ← cards
     │ ┌ header na navy ──────────────────────────┐  │
     │ │ zebra rows, may kulay ang Status         │  │
     │ └──────────────────────────────────────────┘  │
     └───────────────────────────────────────────────┘

   Para palitan ang kulay: baguhin ang COLORS sa ibaba.
   ============================================================ */

const COLORS = {
  navy: '06358C',
  navyDeep: '031B4B',
  yellow: 'FFD200',
  ink: '0E1A36',
  muted: '5A6782',
  soft: 'F5F7FB',
  softBlue: 'EAF0FE',
  border: 'D9E0EC',
  white: 'FFFFFF',
}

/* Kulay ng bawat Status: [background, letra] */
const STATUS_COLORS = {
  Complete: ['E3F5E9', '1E7B3A'],
  'Timed In': ['EAF0FE', '1E4FD8'],
  'No Time Out': ['FFF4D6', '8A5A00'],
  'Did not attend': ['FDECEC', 'B42318'],
  'Not yet timed in': ['EEF1F6', '5A6782'],
}

/* Mga column ng talaan: [header, lapad, alignment] */
const COLUMNS = [
  ['No.', 6, 'center'],
  ['Student ID', 15, 'center'],
  ['Name', 30, 'left'],
  ['Role', 11, 'center'],
  ['Program', 12, 'center'],
  ['Year Level', 11, 'center'],
  ['Joined on', 19, 'center'],
  ['Time In', 11, 'center'],
  ['Method (In)', 11, 'center'],
  ['Time Out', 11, 'center'],
  ['Method (Out)', 12, 'center'],
  ['Status', 17, 'center'],
]
const LAST_COL = COLUMNS.length // L

const thin = (color = COLORS.border) => ({ style: 'thin', color })

/**
 * Binubuo ang workbook.
 *
 * @param {object} info
 *   school      — "STI COLLEGE SAN PABLO"
 *   orgName     — pangalan ng org (pwedeng blangko)
 *   department  — department ng org (pwedeng blangko)
 *   title, date, time, location, exportedOn, exportedBy — naka-format na teksto
 *   people      — [{ name, studentId, role, program, yearLevel, joinedAt,
 *                    timeIn, timeInMethod, timeOut, timeOutMethod, status,
 *                    hasIn, hasOut }]
 *   logo        — { data: Uint8Array (PNG), width, height } o null
 * @returns {Workbook}
 */
export function buildAttendanceWorkbook(info) {
  const people = info.people ?? []
  const joined = people.length
  const timedIn = people.filter((p) => p.hasIn).length
  const completed = people.filter((p) => p.hasOut).length
  const rate = joined ? timedIn / joined : 0

  const wb = new Workbook()
  const ws = wb.addSheet('Attendance')
  ws.showGridLines = false
  ws.setColumnWidths(COLUMNS.map((c) => c[1]))

  /* ---------- 1–3: BANNER ---------- */
  const banner = { fill: COLORS.navy, align: { v: 'center' } }
  ws.styleRange(1, 1, 3, LAST_COL, banner)
  ws.setRowHeight(1, 26)
  ws.setRowHeight(2, 19)
  ws.setRowHeight(3, 19)

  /* May logo → magsisimula ang teksto sa column C; wala → sa A */
  const textCol = info.logo ? 3 : 1
  ws.merge(1, textCol, 1, LAST_COL, info.school || 'STI COLLEGE SAN PABLO', {
    ...banner,
    font: { bold: true, size: 17, color: COLORS.white },
    align: { v: 'bottom', indent: info.logo ? 0 : 1 },
  })
  ws.merge(2, textCol, 2, LAST_COL, 'EVENT ATTENDANCE REPORT', {
    ...banner,
    font: { bold: true, size: 11, color: COLORS.yellow },
    align: { v: 'center', indent: info.logo ? 0 : 1 },
  })
  ws.merge(3, textCol, 3, LAST_COL, info.orgName || '', {
    ...banner,
    font: { size: 10, color: 'C9D6F2' },
    align: { v: 'top', indent: info.logo ? 0 : 1 },
  })

  if (info.logo) {
    /* Kasya sa taas ng banner (mga 85px), hindi nababanat */
    const h = 70
    const w = Math.round((info.logo.width / info.logo.height) * h)
    ws.addImage({
      data: info.logo.data,
      row: 1,
      col: 1,
      offsetX: 10,
      offsetY: 8,
      width: w,
      height: h,
      name: 'STI Logo',
    })
  }

  /* 4: dilaw na guhit */
  ws.styleRange(4, 1, 4, LAST_COL, { fill: COLORS.yellow })
  ws.setRowHeight(4, 4)
  ws.setRowHeight(5, 10)

  /* ---------- 6–9: DETALYE NG EVENT ---------- */
  const label = {
    font: { bold: true, size: 10, color: COLORS.navy },
    fill: COLORS.softBlue,
    border: thin(),
    align: { v: 'center', indent: 1 },
  }
  const value = {
    font: { size: 10, color: COLORS.ink },
    border: thin(),
    align: { v: 'center', indent: 1, wrap: true },
  }
  const titleValue = { ...value, font: { bold: true, size: 11, color: COLORS.ink } }

  const left = [
    ['Event', info.title, titleValue],
    ['Date', info.date, value],
    ['Time', info.time, value],
    ['Location', info.location, value],
  ]
  const right = [
    ['Organization', info.orgName, value],
    ['Department', info.department, value],
    ['Exported on', info.exportedOn, value],
    ['Exported by', info.exportedBy, value],
  ]
  left.forEach(([l, v, style], i) => {
    const r = 6 + i
    ws.setRowHeight(r, 20)
    ws.merge(r, 1, r, 2, l, label) // A:B
    ws.merge(r, 3, r, 6, v || '—', style) // C:F
  })
  right.forEach(([l, v, style], i) => {
    const r = 6 + i
    ws.merge(r, 7, r, 7, l, label) // G
    ws.merge(r, 8, r, LAST_COL, v || '—', style) // H:L
  })

  ws.setRowHeight(10, 12)

  /* ---------- 11–12: SUMMARY CARDS ---------- */
  const cards = [
    { from: 1, to: 3, title: 'JOINED', value: joined, fill: COLORS.softBlue, color: COLORS.navy },
    { from: 4, to: 6, title: 'TIMED IN', value: timedIn, fill: 'E8F4FD', color: '1E4FD8' },
    {
      from: 7,
      to: 9,
      title: 'COMPLETED (WITH TIME OUT)',
      value: completed,
      fill: 'E3F5E9',
      color: '1E7B3A',
    },
    {
      from: 10,
      to: 12,
      title: 'ATTENDANCE RATE',
      value: rate,
      fill: 'FFF6CC',
      color: '7A5B00',
      numFmt: '0%',
    },
  ]
  ws.setRowHeight(11, 18)
  ws.setRowHeight(12, 30)
  cards.forEach((c) => {
    const edge = thin('C3CEE3')
    ws.merge(11, c.from, 11, c.to, c.title, {
      fill: c.fill,
      font: { bold: true, size: 8, color: COLORS.muted },
      align: { h: 'center', v: 'bottom' },
      border: { top: edge, left: edge, right: edge },
    })
    ws.merge(12, c.from, 12, c.to, c.value, {
      fill: c.fill,
      font: { bold: true, size: 20, color: c.color },
      align: { h: 'center', v: 'center' },
      border: { bottom: edge, left: edge, right: edge },
      ...(c.numFmt ? { numFmt: c.numFmt } : {}),
    })
  })

  ws.setRowHeight(13, 14)

  /* ---------- 14: HEADER NG TALAAN ---------- */
  const HEADER_ROW = 14
  ws.setRowHeight(HEADER_ROW, 28)
  COLUMNS.forEach(([text], i) => {
    ws.set(HEADER_ROW, i + 1, text, {
      fill: COLORS.navy,
      font: { bold: true, size: 10, color: COLORS.white },
      align: { h: 'center', v: 'center', wrap: true },
      border: { ...thin('0A2B6E'), bottom: { style: 'medium', color: COLORS.yellow } },
    })
  })

  /* ---------- 15…: MGA TAO ---------- */
  let r = HEADER_ROW + 1
  if (people.length === 0) {
    ws.merge(r, 1, r, LAST_COL, 'No participants yet.', {
      font: { italic: true, size: 10, color: COLORS.muted },
      align: { h: 'center', v: 'center' },
      border: thin(),
    })
    ws.setRowHeight(r, 24)
    r++
  }

  people.forEach((p, i) => {
    const zebra = i % 2 === 1 ? COLORS.soft : COLORS.white
    const values = [
      i + 1,
      p.studentId,
      p.name,
      p.role,
      p.program,
      p.yearLevel,
      p.joinedAt,
      p.timeIn,
      p.timeInMethod,
      p.timeOut,
      p.timeOutMethod,
      p.status,
    ]
    ws.setRowHeight(r, 20)
    values.forEach((v, c) => {
      const isStatus = c === LAST_COL - 1
      const isName = c === 2
      const [bg, fg] = isStatus ? (STATUS_COLORS[v] ?? [zebra, COLORS.ink]) : [zebra, COLORS.ink]
      ws.set(r, c + 1, v === '' || v == null ? '' : v, {
        fill: bg,
        font: {
          size: 10,
          color: c === 0 ? COLORS.muted : fg,
          bold: isStatus || isName,
        },
        align: { h: COLUMNS[c][2], v: 'center', indent: isName ? 1 : 0 },
        border: thin(),
      })
    })
    r++
  })

  const lastDataRow = r - 1
  if (people.length > 0) ws.setAutoFilter(HEADER_ROW, 1, lastDataRow, LAST_COL)

  /* ---------- PALIWANAG SA STATUS + PAANAN ---------- */
  r++
  ws.merge(r, 1, r, 2, 'Status legend:', {
    font: { bold: true, size: 9, color: COLORS.muted },
    align: { v: 'center' },
  })
  const legend = Object.entries(STATUS_COLORS)
  const legendCols = [
    [3, 3],
    [4, 5],
    [6, 7],
    [8, 9],
    [10, 11],
  ]
  legend.forEach(([name, [bg, fg]], i) => {
    const [from, to] = legendCols[i]
    ws.merge(r, from, r, to, name, {
      fill: bg,
      font: { bold: true, size: 9, color: fg },
      align: { h: 'center', v: 'center' },
      border: thin('FFFFFF'),
    })
  })
  ws.setRowHeight(r, 18)

  r += 2
  ws.merge(
    r,
    1,
    r,
    LAST_COL,
    'Generated by the STI-CO Student Organization System. Times are in Philippine Standard Time.',
    { font: { italic: true, size: 9, color: COLORS.muted }, align: { v: 'center' } },
  )

  /* ---------- PRINT ---------- */
  ws.setPrint({
    landscape: true,
    fitToWidth: true,
    repeatRows: [HEADER_ROW, HEADER_ROW],
    /* & ay espesyal sa footer ng Excel, kaya && */
    footer: `&L&8${String(info.title ?? '').slice(0, 80).replace(/&/g, '&&')} — Attendance&R&8Page &P of &N`,
  })

  return wb
}
