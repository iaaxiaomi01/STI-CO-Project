/* ============================================================
   MALIIT NA PDF WRITER — walang dagdag na package

   Gumagawa ng PDF na may ISANG pahina na buong larawan (JPEG).
   Ginagamit ng mga certificate (lib/certificateDesigns.js):
   ginuguhit ang certificate sa <canvas>, ginagawang JPEG, tapos
   isinisilid dito.

   Ang JPEG ay inilalagay nang buo (DCTDecode) — hindi na
   kailangang i-decode o i-compress ulit.

     const blob = jpegToPdf(jpegBytes, widthPx, heightPx, {
       pageWidth: 842, pageHeight: 595,   // A4 landscape, sa points
       title: 'Certificate',
     })
   ============================================================ */

const encoder = new TextEncoder()

/* Para sa teksto sa loob ng (...) ng PDF */
function pdfString(text) {
  return String(text ?? '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/([\\()])/g, '\\$1')
}

export function jpegToPdf(jpeg, widthPx, heightPx, options = {}) {
  const pageWidth = options.pageWidth ?? 842
  const pageHeight = options.pageHeight ?? 595
  const title = pdfString(options.title ?? '')

  const parts = []
  const offsets = []
  let length = 0

  function push(chunk) {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }

  function object(num, body) {
    offsets[num] = length
    push(`${num} 0 obj\n`)
    if (typeof body === 'function') body()
    else push(body)
    push('\nendobj\n')
  }

  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`

  push('%PDF-1.4\n')
  /* Paalala sa mga programa na may binary sa loob ng file */
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
  )
  object(4, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    )
    push(jpeg)
    push('\nendstream')
  })
  object(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`)
  object(6, `<< /Title (${title}) /Producer (STI Org Portal) >>`)

  const xrefAt = length
  let xref = `xref\n0 7\n0000000000 65535 f \n`
  for (let i = 1; i <= 6; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  return new Blob(parts, { type: 'application/pdf' })
}
