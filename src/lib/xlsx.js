/* ============================================================
   MALIIT NA XLSX WRITER — walang dagdag na package

   Gumagawa ng totoong .xlsx (Excel) file sa browser, may:
     - kulay ng background at letra, bold, laki ng font
     - border, alignment, wrap text
     - merged cells, lapad ng column, taas ng row
     - number format (hal. 0% para sa porsiyento)
     - larawan (logo), auto-filter, at print setup

   Bakit hindi CSV: plain text lang ang CSV — walang kulay,
   walang bold, walang logo. Ang .xlsx ay zip ng mga XML file,
   kaya kaya natin itong buuin dito nang walang library.

   Paggamit:
     const wb = new Workbook()
     const ws = wb.addSheet('Attendance')
     ws.setColumnWidths([6, 15, 30])
     ws.set(1, 1, 'Hello', { font: { bold: true }, fill: '06358C' })
     const bytes = wb.toBytes()          // Uint8Array
     const blob = wb.toBlob()            // para i-download

   Row at column ay nagsisimula sa 1 (gaya ng sa Excel).

   Lahat ng teksto ay isinusulat bilang teksto (inline string),
   hindi formula — kaya walang "formula injection" at hindi
   nawawala ang 0 sa unahan ng Student ID.
   ============================================================ */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/* ---------- maliliit na helper ---------- */

/* 1 → A, 27 → AA */
export function colLetter(col) {
  let s = ''
  let n = col
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function ref(row, col) {
  return `${colLetter(col)}${row}`
}

/* Ligtas na teksto para sa XML. Inaalis din ang mga control
   character na bawal sa XML (sisirain nila ang file). */
function esc(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* "06358c" / "#06358C" → "FF06358C" (ARGB na hinihingi ng Excel) */
function argb(color) {
  const hex = String(color).replace('#', '').toUpperCase()
  return hex.length === 8 ? hex : `FF${hex}`
}

const EMU_PER_PX = 9525

/* ---------- STYLES ----------
   Ang style ng cell ay simpleng object:
   {
     font:   { bold, italic, size, color, name, underline },
     fill:   '06358C',                       // kulay ng background
     border: { color, style }                // lahat ng gilid
             o { top: {color, style}, bottom: …, left: …, right: … },
     align:  { h: 'left'|'center'|'right', v: 'top'|'center'|'bottom',
               wrap: true, indent: 1 },
     numFmt: '0%'
   }
   Pinagsasama ang magkakaparehong style para maliit ang file. */

const DEFAULT_FONT = { name: 'Calibri', size: 11 }

class StyleBook {
  constructor() {
    this.fonts = [this.#fontXml({})]
    this.fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
    ]
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>']
    this.numFmts = []
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
    this.xfIndex = new Map()
  }

  #indexOf(list, xml) {
    const at = list.indexOf(xml)
    if (at !== -1) return at
    list.push(xml)
    return list.length - 1
  }

  #fontXml(font) {
    const f = { ...DEFAULT_FONT, ...font }
    return (
      '<font>' +
      (f.bold ? '<b/>' : '') +
      (f.italic ? '<i/>' : '') +
      (f.underline ? '<u/>' : '') +
      `<sz val="${f.size}"/>` +
      (f.color ? `<color rgb="${argb(f.color)}"/>` : '<color theme="1"/>') +
      `<name val="${esc(f.name)}"/>` +
      '<family val="2"/>' +
      '</font>'
    )
  }

  #fillXml(color) {
    return (
      '<fill><patternFill patternType="solid">' +
      `<fgColor rgb="${argb(color)}"/><bgColor indexed="64"/>` +
      '</patternFill></fill>'
    )
  }

  #borderXml(border) {
    const side = (name) => {
      const b = border[name] ?? (border.style || border.color ? border : null)
      if (!b) return `<${name}/>`
      return (
        `<${name} style="${b.style ?? 'thin'}">` +
        `<color rgb="${argb(b.color ?? '000000')}"/>` +
        `</${name}>`
      )
    }
    return `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`
  }

  #numFmtId(code) {
    const builtIn = { General: 0, '0': 1, '0.00': 2, '0%': 9, '0.00%': 10 }
    if (code in builtIn) return builtIn[code]
    const found = this.numFmts.find((n) => n.code === code)
    if (found) return found.id
    const id = 164 + this.numFmts.length
    this.numFmts.push({ id, code })
    return id
  }

  /* style object → index ng xf (ang "s" ng cell) */
  idFor(style) {
    if (!style) return 0
    const key = JSON.stringify(style)
    if (this.xfIndex.has(key)) return this.xfIndex.get(key)

    const fontId = style.font ? this.#indexOf(this.fonts, this.#fontXml(style.font)) : 0
    const fillId = style.fill ? this.#indexOf(this.fills, this.#fillXml(style.fill)) : 0
    const borderId = style.border ? this.#indexOf(this.borders, this.#borderXml(style.border)) : 0
    const numFmtId = style.numFmt ? this.#numFmtId(style.numFmt) : 0

    const a = style.align
    const alignment = a
      ? '<alignment' +
        (a.h ? ` horizontal="${a.h}"` : '') +
        (a.v ? ` vertical="${a.v}"` : '') +
        (a.wrap ? ' wrapText="1"' : '') +
        (a.indent ? ` indent="${a.indent}"` : '') +
        '/>'
      : ''

    const xml =
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      (numFmtId ? ' applyNumberFormat="1"' : '') +
      (fontId ? ' applyFont="1"' : '') +
      (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') +
      (alignment ? ' applyAlignment="1">' + alignment + '</xf>' : '/>')

    const id = this.#indexOf(this.xfs, xml)
    this.xfIndex.set(key, id)
    return id
  }

  toXml() {
    const numFmts = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">` +
        this.numFmts.map((n) => `<numFmt numFmtId="${n.id}" formatCode="${esc(n.code)}"/>`).join('') +
        '</numFmts>'
      : ''
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      numFmts +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    )
  }
}

/* ---------- WORKSHEET ---------- */

class Worksheet {
  constructor(name, styles) {
    this.name = String(name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1'
    this.styles = styles
    this.rows = new Map() // row → Map(col → { v, s })
    this.heights = new Map()
    this.widths = []
    this.merges = []
    this.images = []
    this.filter = null
    this.showGridLines = true
    this.print = null
  }

  #cell(row, col) {
    if (!this.rows.has(row)) this.rows.set(row, new Map())
    const r = this.rows.get(row)
    if (!r.has(col)) r.set(col, { v: null, s: 0 })
    return r.get(col)
  }

  /* Isang cell: value (teksto o numero) at style */
  set(row, col, value, style) {
    const c = this.#cell(row, col)
    c.v = value === undefined ? null : value
    if (style) c.s = this.styles.idFor(style)
    return this
  }

  /* Parehong style sa buong range (kailangan ito para buo ang
     border at kulay ng merged cells) */
  styleRange(r1, c1, r2, c2, style) {
    const s = this.styles.idFor(style)
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) this.#cell(r, c).s = s
    }
    return this
  }

  /* Pagsamahin ang mga cell; ang value ay nasa unang cell */
  merge(r1, c1, r2, c2, value, style) {
    if (style) this.styleRange(r1, c1, r2, c2, style)
    if (value !== undefined) this.set(r1, c1, value)
    if (r1 !== r2 || c1 !== c2) this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`)
    return this
  }

  setColumnWidths(widths) {
    this.widths = widths
    return this
  }

  setRowHeight(row, points) {
    this.heights.set(row, points)
    return this
  }

  setAutoFilter(r1, c1, r2, c2) {
    this.filter = { r1, c1, r2, c2 }
    return this
  }

  /* Larawan (PNG). Nakaangkla sa isang cell, may offset at
     sukat na pixels. */
  addImage({ data, row, col, offsetX = 0, offsetY = 0, width, height, name = 'Picture' }) {
    if (!data || !width || !height) return this
    this.images.push({ data, row, col, offsetX, offsetY, width, height, name })
    return this
  }

  /* Print: { landscape, fitToWidth, repeatRows: [from, to], footer } */
  setPrint(options) {
    this.print = options
    return this
  }

  sheetXml(drawingRelId) {
    const out = []
    const p = this.print

    out.push(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    )
    if (p?.fitToWidth) out.push('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>')

    out.push(
      '<sheetViews><sheetView workbookViewId="0"' +
        (this.showGridLines ? '' : ' showGridLines="0"') +
        ' zoomScale="100"/></sheetViews>',
    )
    out.push('<sheetFormatPr defaultRowHeight="15"/>')

    if (this.widths.length) {
      out.push('<cols>')
      this.widths.forEach((w, i) => {
        if (w) out.push(`<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
      })
      out.push('</cols>')
    }

    out.push('<sheetData>')
    const rowNums = new Set([...this.rows.keys(), ...this.heights.keys()])
    ;[...rowNums]
      .sort((a, b) => a - b)
      .forEach((r) => {
        const h = this.heights.get(r)
        out.push(`<row r="${r}"` + (h ? ` ht="${h}" customHeight="1"` : '') + '>')
        const cells = this.rows.get(r)
        if (cells) {
          ;[...cells.keys()]
            .sort((a, b) => a - b)
            .forEach((c) => {
              const { v, s } = cells.get(c)
              const at = ref(r, c)
              const sAttr = s ? ` s="${s}"` : ''
              if (v === null || v === '') {
                out.push(`<c r="${at}"${sAttr}/>`)
              } else if (typeof v === 'number' && Number.isFinite(v)) {
                out.push(`<c r="${at}"${sAttr}><v>${v}</v></c>`)
              } else {
                out.push(
                  `<c r="${at}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`,
                )
              }
            })
        }
        out.push('</row>')
      })
    out.push('</sheetData>')

    if (this.filter) {
      const f = this.filter
      out.push(`<autoFilter ref="${ref(f.r1, f.c1)}:${ref(f.r2, f.c2)}"/>`)
    }
    if (this.merges.length) {
      out.push(`<mergeCells count="${this.merges.length}">`)
      this.merges.forEach((m) => out.push(`<mergeCell ref="${m}"/>`))
      out.push('</mergeCells>')
    }

    if (p) out.push('<printOptions horizontalCentered="1"/>')
    out.push(
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>',
    )
    if (p) {
      out.push(
        '<pageSetup' +
          (p.landscape ? ' orientation="landscape"' : ' orientation="portrait"') +
          (p.fitToWidth ? ' fitToWidth="1" fitToHeight="0"' : '') +
          '/>',
      )
      if (p.footer) out.push(`<headerFooter><oddFooter>${esc(p.footer)}</oddFooter></headerFooter>`)
    }
    if (drawingRelId) out.push(`<drawing r:id="${drawingRelId}"/>`)

    out.push('</worksheet>')
    return out.join('')
  }

  drawingXml(firstImageNumber) {
    const pics = this.images.map((img, i) => {
      const cx = Math.round(img.width * EMU_PER_PX)
      const cy = Math.round(img.height * EMU_PER_PX)
      return (
        '<xdr:oneCellAnchor>' +
        '<xdr:from>' +
        `<xdr:col>${img.col - 1}</xdr:col><xdr:colOff>${Math.round(img.offsetX * EMU_PER_PX)}</xdr:colOff>` +
        `<xdr:row>${img.row - 1}</xdr:row><xdr:rowOff>${Math.round(img.offsetY * EMU_PER_PX)}</xdr:rowOff>` +
        '</xdr:from>' +
        `<xdr:ext cx="${cx}" cy="${cy}"/>` +
        '<xdr:pic>' +
        `<xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="${esc(img.name)}"/>` +
        '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
        `<xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>' +
        '</xdr:pic>' +
        '<xdr:clientData/>' +
        '</xdr:oneCellAnchor>'
      )
    })
    const rels = this.images.map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" ` +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ' +
        `Target="../media/image${firstImageNumber + i}.png"/>`,
    )
    return {
      xml:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        pics.join('') +
        '</xdr:wsDr>',
      rels: relsXml(rels),
    }
  }
}

function relsXml(items) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    items.join('') +
    '</Relationships>'
  )
}

/* ---------- WORKBOOK ---------- */

export class Workbook {
  constructor() {
    this.styles = new StyleBook()
    this.sheets = []
  }

  addSheet(name) {
    const ws = new Worksheet(name, this.styles)
    this.sheets.push(ws)
    return ws
  }

  /* Lahat ng file sa loob ng .xlsx → Uint8Array */
  toBytes() {
    const enc = new TextEncoder()
    const files = []
    const add = (path, content) =>
      files.push({ path, data: typeof content === 'string' ? enc.encode(content) : content })

    const overrides = []
    const wbRels = []
    const sheetEntries = []
    const definedNames = []
    let imageNumber = 1
    let drawingNumber = 1

    this.sheets.forEach((ws, i) => {
      const n = i + 1
      const quoted = `'${ws.name.replace(/'/g, "''")}'`
      let drawingRelId = null

      if (ws.images.length) {
        const d = drawingNumber++
        drawingRelId = 'rId1'
        const { xml, rels } = ws.drawingXml(imageNumber)
        ws.images.forEach((img) => add(`xl/media/image${imageNumber++}.png`, img.data))
        add(`xl/drawings/drawing${d}.xml`, xml)
        add(`xl/drawings/_rels/drawing${d}.xml.rels`, rels)
        add(
          `xl/worksheets/_rels/sheet${n}.xml.rels`,
          relsXml([
            '<Relationship Id="rId1" ' +
              'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" ' +
              `Target="../drawings/drawing${d}.xml"/>`,
          ]),
        )
        overrides.push(
          `<Override PartName="/xl/drawings/drawing${d}.xml" ` +
            'ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>',
        )
      }

      add(`xl/worksheets/sheet${n}.xml`, ws.sheetXml(drawingRelId))
      overrides.push(
        `<Override PartName="/xl/worksheets/sheet${n}.xml" ` +
          'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      )
      wbRels.push(
        `<Relationship Id="rId${n}" ` +
          'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
          `Target="worksheets/sheet${n}.xml"/>`,
      )
      sheetEntries.push(`<sheet name="${esc(ws.name)}" sheetId="${n}" r:id="rId${n}"/>`)

      if (ws.filter) {
        const f = ws.filter
        definedNames.push(
          `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">` +
            `${esc(quoted)}!$${colLetter(f.c1)}$${f.r1}:$${colLetter(f.c2)}$${f.r2}</definedName>`,
        )
      }
      const repeat = ws.print?.repeatRows
      if (repeat) {
        definedNames.push(
          `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">` +
            `${esc(quoted)}!$${repeat[0]}:$${repeat[1]}</definedName>`,
        )
      }
    })

    const stylesRelId = `rId${this.sheets.length + 1}`
    wbRels.push(
      `<Relationship Id="${stylesRelId}" ` +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ' +
        'Target="styles.xml"/>',
    )

    add(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView/></bookViews>' +
        `<sheets>${sheetEntries.join('')}</sheets>` +
        (definedNames.length ? `<definedNames>${definedNames.join('')}</definedNames>` : '') +
        '</workbook>',
    )
    add('xl/_rels/workbook.xml.rels', relsXml(wbRels))
    add('xl/styles.xml', this.styles.toXml())
    add(
      '_rels/.rels',
      relsXml([
        '<Relationship Id="rId1" ' +
          'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ' +
          'Target="xl/workbook.xml"/>',
      ]),
    )
    add(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/xl/workbook.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        overrides.join('') +
        '</Types>',
    )

    /* Mauna ang [Content_Types].xml sa zip */
    files.unshift(files.pop())
    return zipStore(files)
  }

  toBlob() {
    return new Blob([this.toBytes()], { type: XLSX_MIME })
  }
}

/* ---------- ZIP (walang compression — "stored") ----------
   Tanggap ito ng Excel, Google Sheets at LibreOffice. Maliit
   naman ang XML at PNG na ang logo, kaya ayos lang. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipStore(files) {
  const enc = new TextEncoder()
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const locals = []
  const centrals = []
  let offset = 0

  files.forEach(({ path, data }) => {
    const name = enc.encode(path)
    const crc = crc32(data)

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // UTF-8 na pangalan
    lv.setUint16(8, 0, true) // stored
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)

    locals.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  })

  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const parts = [...locals, ...centrals, end]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  parts.forEach((p) => {
    out.set(p, at)
    at += p.length
  })
  return out
}
