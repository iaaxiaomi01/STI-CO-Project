/* ============================================================
   IMAGE — pagpapaliit ng larawan bago i-upload

   Ginagamit ng avatar (lib/avatar.js) at ng org logo
   (lib/organization.js), para iisa lang ang aayusin.

   Dalawang paraan ng pagkasya sa parisukat:
     'cover'   — hinihiwa sa gitna, punô ang parisukat
                 (avatar: bilog naman ang labas)
     'contain' — buong larawan, may transparent na gilid
                 (logo: hindi dapat maputol ang pahabang logo)

   Ang createImageBitmap ay sumusunod sa EXIF orientation,
   kaya hindi babaligtad ang litrato mula sa cellphone.
   ============================================================ */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_INPUT_BYTES = 10 * 1024 * 1024 // 10 MB bago paliitin

/* Mensaheng maiintindihan ng user */
export class ImageError extends Error {}

export function checkImageFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageError('JPG, PNG o WEBP lang ang tinatanggap.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError('Masyadong malaki ang file (hanggang 10 MB lang).')
  }
}

export async function resizeToSquare(file, size, mode = 'cover') {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageError('Hindi mabasa ang larawan. Subukan ang ibang file.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  const { width: w, height: h } = bitmap

  if (mode === 'contain') {
    const scale = Math.min(size / w, size / h)
    const dw = Math.round(w * scale)
    const dh = Math.round(h * scale)
    ctx.drawImage(bitmap, 0, 0, w, h, (size - dw) / 2, (size - dh) / 2, dw, dh)
  } else {
    const side = Math.min(w, h)
    ctx.drawImage(bitmap, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
  }
  bitmap.close?.()

  const toBlob = (type, quality) =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality))

  /* WEBP kung kaya ng browser (may transparency pa). Kung hindi
     (lumang Safari): PNG para sa 'contain' para manatili ang
     transparent na gilid, JPEG para sa 'cover'. */
  let blob = await toBlob('image/webp', 0.88)
  if (!blob || blob.type !== 'image/webp') {
    blob = mode === 'contain'
      ? await toBlob('image/png')
      : await toBlob('image/jpeg', 0.88)
  }
  if (!blob) throw new ImageError('Hindi maproseso ang larawan.')
  return blob
}

export function extensionFor(blob) {
  if (blob.type === 'image/webp') return 'webp'
  if (blob.type === 'image/png') return 'png'
  return 'jpg'
}
