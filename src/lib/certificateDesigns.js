import { jpegToPdf } from './pdf.js'

/* ============================================================
   CERTIFICATE DESIGNS — ginuguhit ang certificate sa <canvas>

   Dalawang uri:
     HANDANG DISENYO  → BUILT_IN_DESIGNS (classic, modern, elegant,
                        minimal). Kusang may logo at pangalan ng org.
     SARILING DISENYO → blangkong certificate ng org (larawan). Dito
                        isinusulat ang pangalan, detalye at pirma
                        ayon sa settings ng template (nameY, nameColor,
                        showDetails, showSignatories).

   Laki: A4 landscape (297 × 210 mm) — 1754 × 1240 px (~150 dpi).
   Ang PDF ay ginagawa ng lib/pdf.js.

     drawCertificate(canvas, data)    → iguguhit (para sa preview)
     certificatePdf(data)             → Blob (application/pdf)

   data = {
     design: 'classic' | 'modern' | 'elegant' | 'minimal' | 'custom',
     background,        // larawan ng sariling disenyo (design 'custom')
     layout,            // { nameY, nameColor, showDetails, showSignatories }
     logo,              // larawan ng logo ng org (o null)
     orgName, title, recipient, eventTitle, dateText, location,
     signatories,       // [{ name, position }] — hanggang 3
   }
   ============================================================ */

export const CERT_WIDTH = 1754
export const CERT_HEIGHT = 1240

export const BUILT_IN_DESIGNS = [
  { key: 'classic', label: 'Classic', swatch: ['#fbf7ec', '#0b2a6b', '#c9a227'] },
  { key: 'modern', label: 'Modern', swatch: ['#ffffff', '#06358c', '#ffd400'] },
  { key: 'elegant', label: 'Elegant', swatch: ['#0f1f45', '#d4af37', '#ffffff'] },
  { key: 'minimal', label: 'Minimal', swatch: ['#ffffff', '#1f2a44', '#9aa3b5'] },
]

export const CERT_TITLES = [
  'Certificate of Participation',
  'Certificate of Attendance',
  'Certificate of Appreciation',
  'Certificate of Completion',
  'Certificate of Recognition',
]

export const DEFAULT_LAYOUT = {
  nameY: 0.5,
  nameColor: '#1f2a44',
  showDetails: true,
  showSignatories: true,
}

const SERIF = 'Georgia, "Times New Roman", serif'
const SANS = '"Segoe UI", Roboto, Arial, sans-serif'

/* ---------- MGA HELPER ---------- */

/* Pinakamalaking laki ng font (hanggang `size`) na kasya sa maxWidth */
function fitFont(ctx, text, maxWidth, size, build, min = 18) {
  let s = size
  ctx.font = build(s)
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 2
    ctx.font = build(s)
  }
  return s
}

/* Hinahati ang teksto sa mga linyang kasya sa maxWidth */
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

/* Teksto na may agwat ng letra (para sa maliliit na uppercase) */
function spacedText(ctx, text, x, y, spacing) {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`
    ctx.fillText(text, x, y)
    ctx.letterSpacing = '0px'
  } else {
    ctx.fillText(text.split('').join(' '), x, y)
  }
}

/* Logo sa loob ng parisukat na size × size, nakagitna sa (cx, top) */
function drawLogo(ctx, logo, cx, top, size) {
  if (!logo) return false
  const w = logo.width || logo.naturalWidth
  const h = logo.height || logo.naturalHeight
  if (!w || !h) return false
  const scale = Math.min(size / w, size / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(logo, cx - dw / 2, top + (size - dh) / 2, dw, dh)
  return true
}

/* Ang "cover" na pagkakalagay ng larawan sa buong canvas */
function drawCover(ctx, img, W, H) {
  const w = img.width || img.naturalWidth
  const h = img.height || img.naturalHeight
  const scale = Math.max(W / w, H / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

/* "for participating in “Leadership Summit” held on Friday, November 20, 2026 at the Gym" */
function detailsText(d) {
  const verb = /attendance/i.test(d.title)
    ? 'for attending'
    : /appreciation/i.test(d.title)
      ? 'in appreciation of their participation in'
      : /completion/i.test(d.title)
        ? 'for successfully completing'
        : /recognition/i.test(d.title)
          ? 'in recognition of their participation in'
          : 'for participating in'
  let text = `${verb} “${d.eventTitle}”`
  if (d.dateText) text += ` held on ${d.dateText}`
  if (d.location) text += ` at ${d.location}`
  return `${text}.`
}

/* Mga pirma: linya, pangalan sa ilalim, posisyon sa ilalim noon.
   Pantay ang pagitan sa loob ng [left, right]. */
function drawSignatories(ctx, list, { left, right, y, color, muted, font = SANS }) {
  const people = (list ?? []).filter((s) => s?.name?.trim()).slice(0, 3)
  if (people.length === 0) return
  const span = right - left
  const slot = span / people.length
  const lineWidth = Math.min(380, slot - 60)

  people.forEach((p, i) => {
    const cx = left + slot * i + slot / 2
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - lineWidth / 2, y)
    ctx.lineTo(cx + lineWidth / 2, y)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.textAlign = 'center'
    fitFont(ctx, p.name.trim().toUpperCase(), lineWidth + 40, 26, (s) => `700 ${s}px ${font}`, 16)
    ctx.fillText(p.name.trim().toUpperCase(), cx, y + 38)
    if (p.position?.trim()) {
      ctx.fillStyle = muted
      fitFont(ctx, p.position.trim(), lineWidth + 40, 22, (s) => `400 ${s}px ${font}`, 14)
      ctx.fillText(p.position.trim(), cx, y + 70)
    }
  })
}

/* Pangalan ng tatanggap, kasya sa lapad */
function drawRecipient(ctx, name, cx, y, maxWidth, color, size = 96) {
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  fitFont(ctx, name, maxWidth, size, (s) => `italic 700 ${s}px ${SERIF}`, 40)
  ctx.fillText(name, cx, y)
}

/* ---------- HANDANG DISENYO ---------- */

function drawClassic(ctx, d, W, H) {
  const navy = '#0b2a6b'
  const gold = '#c9a227'
  ctx.fillStyle = '#fbf7ec'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = navy
  ctx.lineWidth = 16
  ctx.strokeRect(40, 40, W - 80, H - 80)
  ctx.strokeStyle = gold
  ctx.lineWidth = 4
  ctx.strokeRect(74, 74, W - 148, H - 148)

  /* Palamuti sa mga sulok */
  ctx.fillStyle = gold
  ;[
    [74, 74],
    [W - 74, 74],
    [74, H - 74],
    [W - 74, H - 74],
  ].forEach(([x, y]) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-14, -14, 28, 28)
    ctx.restore()
  })

  const cx = W / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const hasLogo = drawLogo(ctx, d.logo, cx, 120, 150)
  let y = hasLogo ? 320 : 200

  ctx.fillStyle = navy
  ctx.font = `700 28px ${SANS}`
  fitFont(ctx, d.orgName.toUpperCase(), W - 360, 28, (s) => `700 ${s}px ${SANS}`)
  spacedText(ctx, d.orgName.toUpperCase(), cx, y, 4)

  y += 90
  fitFont(ctx, d.title.toUpperCase(), W - 360, 70, (s) => `700 ${s}px ${SERIF}`)
  ctx.fillText(d.title.toUpperCase(), cx, y)

  y += 70
  ctx.fillStyle = '#5b6170'
  ctx.font = `italic 32px ${SERIF}`
  ctx.fillText('This certificate is proudly presented to', cx, y)

  y += 125
  drawRecipient(ctx, d.recipient, cx, y, W - 420, navy)
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx - 480, y + 28)
  ctx.lineTo(cx + 480, y + 28)
  ctx.stroke()

  y += 95
  ctx.fillStyle = '#3b4252'
  ctx.font = `400 30px ${SERIF}`
  drawLines(ctx, wrapLines(ctx, detailsText(d), W - 520).slice(0, 3), cx, y, 42)

  drawSignatories(ctx, d.signatories, {
    left: 160,
    right: W - 160,
    y: H - 230,
    color: navy,
    muted: '#5b6170',
  })
}

function drawModern(ctx, d, W, H) {
  const navy = '#06358c'
  const yellow = '#ffd400'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  /* Kaliwang banda */
  const band = 300
  ctx.fillStyle = navy
  ctx.fillRect(0, 0, band, H)
  ctx.fillStyle = yellow
  ctx.fillRect(band, 0, 18, H)

  /* Dilaw na tatsulok sa kanang-ibaba */
  ctx.beginPath()
  ctx.moveTo(W, H - 260)
  ctx.lineTo(W, H)
  ctx.lineTo(W - 260, H)
  ctx.closePath()
  ctx.fill()

  /* Logo sa banda (puting bilog sa likod) */
  if (d.logo) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(band / 2, 220, 100, 0, Math.PI * 2)
    ctx.fill()
    drawLogo(ctx, d.logo, band / 2, 145, 150)
  }

  ctx.save()
  ctx.translate(band / 2, H - 120)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = yellow
  ctx.textAlign = 'left'
  fitFont(ctx, d.orgName.toUpperCase(), H - 520, 30, (s) => `800 ${s}px ${SANS}`)
  spacedText(ctx, d.orgName.toUpperCase(), 0, 10, 3)
  ctx.restore()

  const left = band + 120
  const maxW = W - left - 140
  ctx.textAlign = 'left'

  let y = 250
  ctx.fillStyle = yellow
  ctx.fillRect(left, y - 70, 120, 12)

  ctx.fillStyle = navy
  fitFont(ctx, d.title.toUpperCase(), maxW, 72, (s) => `800 ${s}px ${SANS}`)
  ctx.fillText(d.title.toUpperCase(), left, y + 20)

  y += 110
  ctx.fillStyle = '#5b6170'
  ctx.font = `400 32px ${SANS}`
  ctx.fillText('This is to certify that', left, y)

  y += 130
  ctx.fillStyle = '#16203a'
  fitFont(ctx, d.recipient, maxW, 100, (s) => `800 ${s}px ${SANS}`, 40)
  ctx.fillText(d.recipient, left, y)

  y += 90
  ctx.fillStyle = '#3b4252'
  ctx.font = `400 32px ${SANS}`
  drawLines(ctx, wrapLines(ctx, detailsText(d), maxW).slice(0, 3), left, y, 46)

  drawSignatories(ctx, d.signatories, {
    left,
    right: W - 200,
    y: H - 220,
    color: '#16203a',
    muted: '#5b6170',
  })
}

function drawElegant(ctx, d, W, H) {
  const gold = '#d4af37'
  const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7)
  bg.addColorStop(0, '#1a2f63')
  bg.addColorStop(1, '#0b1733')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.strokeRect(50, 50, W - 100, H - 100)
  ctx.lineWidth = 1.5
  ctx.strokeRect(66, 66, W - 132, H - 132)

  const cx = W / 2
  ctx.textAlign = 'center'

  const hasLogo = drawLogo(ctx, d.logo, cx, 110, 140)
  let y = hasLogo ? 310 : 200

  ctx.fillStyle = gold
  fitFont(ctx, d.orgName.toUpperCase(), W - 360, 26, (s) => `600 ${s}px ${SANS}`)
  spacedText(ctx, d.orgName.toUpperCase(), cx, y, 6)

  y += 100
  fitFont(ctx, d.title, W - 360, 80, (s) => `italic 700 ${s}px ${SERIF}`)
  ctx.fillText(d.title, cx, y)

  /* Gintong guhit na may diamante sa gitna */
  y += 45
  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - 260, y)
  ctx.lineTo(cx - 24, y)
  ctx.moveTo(cx + 24, y)
  ctx.lineTo(cx + 260, y)
  ctx.stroke()
  ctx.save()
  ctx.translate(cx, y)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = gold
  ctx.fillRect(-9, -9, 18, 18)
  ctx.restore()

  y += 70
  ctx.fillStyle = '#c9d2e6'
  ctx.font = `400 30px ${SERIF}`
  ctx.fillText('Proudly presented to', cx, y)

  y += 125
  drawRecipient(ctx, d.recipient, cx, y, W - 420, '#ffffff')

  y += 90
  ctx.fillStyle = '#c9d2e6'
  ctx.font = `400 30px ${SERIF}`
  drawLines(ctx, wrapLines(ctx, detailsText(d), W - 520).slice(0, 3), cx, y, 42)

  drawSignatories(ctx, d.signatories, {
    left: 160,
    right: W - 160,
    y: H - 230,
    color: gold,
    muted: '#c9d2e6',
  })
}

function drawMinimal(ctx, d, W, H) {
  const ink = '#1f2a44'
  const muted = '#6b7385'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#d5dae4'
  ctx.lineWidth = 2
  ctx.strokeRect(60, 60, W - 120, H - 120)

  const cx = W / 2
  ctx.textAlign = 'center'

  const hasLogo = drawLogo(ctx, d.logo, cx, 130, 110)
  let y = hasLogo ? 300 : 210

  ctx.fillStyle = muted
  fitFont(ctx, d.orgName.toUpperCase(), W - 360, 24, (s) => `600 ${s}px ${SANS}`)
  spacedText(ctx, d.orgName.toUpperCase(), cx, y, 5)

  y += 90
  ctx.fillStyle = ink
  fitFont(ctx, d.title, W - 360, 64, (s) => `300 ${s}px ${SANS}`)
  ctx.fillText(d.title, cx, y)

  y += 40
  ctx.fillStyle = ink
  ctx.fillRect(cx - 40, y, 80, 4)

  y += 160
  ctx.fillStyle = ink
  fitFont(ctx, d.recipient, W - 420, 92, (s) => `600 ${s}px ${SANS}`, 40)
  ctx.fillText(d.recipient, cx, y)

  y += 90
  ctx.fillStyle = muted
  ctx.font = `400 30px ${SANS}`
  drawLines(ctx, wrapLines(ctx, detailsText(d), W - 520).slice(0, 3), cx, y, 44)

  drawSignatories(ctx, d.signatories, {
    left: 160,
    right: W - 160,
    y: H - 220,
    color: ink,
    muted,
  })
}

/* ---------- SARILING DISENYO ---------- */

function drawCustom(ctx, d, W, H) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  if (d.background) drawCover(ctx, d.background, W, H)

  const layout = { ...DEFAULT_LAYOUT, ...(d.layout ?? {}) }
  const color = layout.nameColor
  const cx = W / 2
  const y = H * layout.nameY

  drawRecipient(ctx, d.recipient, cx, y, W - 360, color)

  if (layout.showDetails) {
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.font = `400 30px ${SERIF}`
    drawLines(ctx, wrapLines(ctx, detailsText(d), W - 480).slice(0, 3), cx, y + 80, 42)
  }

  if (layout.showSignatories) {
    drawSignatories(ctx, d.signatories, {
      left: 160,
      right: W - 160,
      y: H - 210,
      color,
      muted: color,
      font: SERIF,
    })
  }
}

const DRAWERS = {
  classic: drawClassic,
  modern: drawModern,
  elegant: drawElegant,
  minimal: drawMinimal,
  custom: drawCustom,
}

/* ---------- PUBLIC ---------- */

export function drawCertificate(canvas, data) {
  canvas.width = CERT_WIDTH
  canvas.height = CERT_HEIGHT
  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.textBaseline = 'alphabetic'
  const d = {
    orgName: '',
    title: CERT_TITLES[0],
    recipient: '',
    eventTitle: '',
    dateText: '',
    location: '',
    signatories: [],
    ...data,
  }
  const draw = DRAWERS[d.design] ?? drawClassic
  draw(ctx, d, CERT_WIDTH, CERT_HEIGHT)
}

function canvasToJpeg(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the certificate.'))),
      'image/jpeg',
      quality,
    )
  })
}

/* Isang certificate → PDF (Blob) */
export async function certificatePdf(data, canvas = document.createElement('canvas')) {
  drawCertificate(canvas, data)
  const jpeg = new Uint8Array(await (await canvasToJpeg(canvas)).arrayBuffer())
  return jpegToPdf(jpeg, CERT_WIDTH, CERT_HEIGHT, {
    pageWidth: 842,
    pageHeight: 595,
    title: `${data.title} - ${data.recipient}`,
  })
}

/* Blob ng larawan → larawang maiguguhit sa canvas */
export async function imageFromBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob)
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* Logo ng org mula sa public URL. null kapag pumalya — iguguhit
   ang certificate nang walang logo. */
export async function loadLogo(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    return await imageFromBlob(await res.blob())
  } catch (err) {
    console.warn('Hindi ma-load ang logo para sa certificate:', err)
    return null
  }
}
