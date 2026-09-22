import { supabase } from './supabaseClient.js'
import { checkImageFile, extensionFor, resizeToSquare } from './image.js'

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

/* Ang pagpapaliit ay nasa lib/image.js na (kasama ng org logo).
   Ini-export ulit dito para hindi magbago ang import sa Profile.jsx. */
export { ACCEPTED_TYPES, MAX_INPUT_BYTES, ImageError as AvatarError } from './image.js'

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
  checkImageFile(file)

  const blob = await resizeToSquare(file, OUTPUT_SIZE, 'cover')
  const ext = extensionFor(blob)
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
