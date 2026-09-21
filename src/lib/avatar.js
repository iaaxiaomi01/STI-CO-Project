import { supabase } from './supabaseClient.js'

/* ============================================================
   AVATAR — pag-upload at pag-alis ng profile picture

   SAAN NAKATIRA:
     Storage bucket 'avatars' → <user id>/<timestamp>.webp
     profiles.avatar_url      → public URL ng file na iyon

   BAKIT LIBAN-LIBANG PANGALAN (timestamp) at hindi laging
   "avatar.webp": naka-cache ang public URL sa browser at sa
   CDN ng Supabase. Kung pareho ang pangalan, lumang larawan
   pa rin ang makikita ng iba nang ilang oras.

   BAKIT PINALILIIT MUNA: 5 MB ang karaniwang litrato mula sa
   cellphone, pero 256×256 lang ang kailangan. Pagkatapos
   paliitin, mga 15–40 KB na lang — mabilis i-load sa sidebar.

   Ang tunay na bantay ay nasa Supabase (storage policies,
   2 MB limit ng bucket, at guard sa profiles.avatar_url).
   Ang mga check dito ay para lang sa malinaw na error message.
   ============================================================ */

const BUCKET = 'avatars'
const OUTPUT_SIZE = 256

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_INPUT_BYTES = 10 * 1024 * 1024 // 10 MB bago paliitin

/* Mensaheng maiintindihan ng user */
export class AvatarError extends Error {}

/* Hinihiwa sa gitna para maging parisukat, tapos pinaliliit.
   Ang createImageBitmap ay sumusunod sa EXIF orientation,
   kaya hindi babaligtad ang litrato mula sa cellphone. */
async function resizeToSquare(file, size) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new AvatarError('Hindi mabasa ang larawan. Subukan ang ibang file.')
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close?.()

  const toBlob = (type, quality) =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality))

  /* WEBP kung kaya ng browser; JPEG kung hindi (lumang Safari) */
  let blob = await toBlob('image/webp', 0.85)
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob('image/jpeg', 0.88)
  }
  if (!blob) throw new AvatarError('Hindi maproseso ang larawan.')
  return blob
}

async function listOwnFiles(userId) {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId)
  if (error) throw error
  return (data ?? []).map((f) => `${userId}/${f.name}`)
}

/* Binubura ang lahat ng file sa folder mo, maliban sa `keep`.
   Hindi kritikal kapag pumalya — lumang file lang ang maiiwan. */
async function cleanupOldFiles(userId, keep) {
  try {
    const paths = (await listOwnFiles(userId)).filter((p) => p !== keep)
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths)
    }
  } catch (err) {
    console.warn('Hindi nabura ang lumang avatar:', err)
  }
}

export async function uploadAvatar(userId, file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new AvatarError('JPG, PNG o WEBP lang ang tinatanggap.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarError('Masyadong malaki ang file (hanggang 10 MB lang).')
  }

  const blob = await resizeToSquare(file, OUTPUT_SIZE)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  /* 1. I-upload ang file */
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000', // bagong pangalan tuwing palit, kaya pwedeng i-cache nang matagal
      upsert: false,
    })
  if (uploadError) throw uploadError

  /* 2. Kunin ang public URL at i-save sa profiles */
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateError) {
    /* Hindi na-save sa profile → burahin ang na-upload para
       walang maiwang file na walang gumagamit. */
    await supabase.storage.from(BUCKET).remove([path])
    throw updateError
  }

  /* 3. Burahin ang mga lumang larawan */
  await cleanupOldFiles(userId, path)

  return publicUrl
}

export async function removeAvatar(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)
  if (error) throw error

  await cleanupOldFiles(userId, null)
}
