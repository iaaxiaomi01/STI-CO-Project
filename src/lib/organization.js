import { supabase } from './supabaseClient.js'
import { checkImageFile, extensionFor, resizeToSquare } from './image.js'

/* ============================================================
   ORGANIZATION — Org Profile ng Adviser

   Name, Description at Logo lang ang nababago. Ang Department
   at status ay hawak ng IT Admin.

   Ang database ang totoong bantay:
     - RLS "orgs_adviser_update_own": sariling org lang
     - trigger guard_organization_columns: anong column lang
     - storage policies: org-logos/<org id>/ lang ang folder

   Logo: org-logos/<org id>/<timestamp>.webp
   Bagong pangalan tuwing palit para hindi lumang logo ang
   makita dahil sa cache (gaya ng avatar).
   ============================================================ */

const BUCKET = 'org-logos'
const LOGO_SIZE = 512

export const NAME_MIN = 2
export const NAME_MAX = 100
export const DESCRIPTION_MAX = 2000

const COLUMNS = 'id, name, department, description, logo_url, is_active, updated_at'

/* Isinasalin ang error ng database sa mensaheng maiintindihan */
export function orgErrorMessage(err) {
  if (err?.code === '23505') return 'May ibang organisasyon na ganito ang pangalan.'
  if (err?.message === 'not-allowed') return 'Wala kang pahintulot na baguhin ang organisasyong ito.'
  /* Galing sa "raise exception" ng guard — nakasulat na sa Tagalog */
  if (err?.code === 'P0001' && err.message) return err.message
  return 'Hindi na-save. Subukan ulit.'
}

export async function fetchOrganization(orgId) {
  const { data, error } = await supabase
    .from('organizations')
    .select(COLUMNS)
    .eq('id', orgId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function updateOrg(orgId, values) {
  const { data, error } = await supabase
    .from('organizations')
    .update(values)
    .eq('id', orgId)
    .select(COLUMNS)

  if (error) throw error
  /* Walang row na bumalik = hinarang ng RLS */
  if (!data || data.length === 0) throw new Error('not-allowed')
  return data[0]
}

export function updateOrganizationDetails(orgId, { name, description }) {
  return updateOrg(orgId, {
    name: name.trim(),
    description: description.trim() || null,
  })
}

async function cleanupOldLogos(orgId, keep) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(orgId)
    if (error) throw error
    const paths = (data ?? [])
      .map((f) => `${orgId}/${f.name}`)
      .filter((p) => p !== keep)
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths)
    }
  } catch (err) {
    console.warn('Hindi nabura ang lumang logo:', err)
  }
}

export async function uploadOrgLogo(orgId, file) {
  checkImageFile(file)

  const blob = await resizeToSquare(file, LOGO_SIZE, 'contain')
  const path = `${orgId}/${Date.now()}.${extensionFor(blob)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000',
      upsert: false,
    })
  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  let updated
  try {
    updated = await updateOrg(orgId, { logo_url: publicUrl })
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([path])
    throw err
  }

  await cleanupOldLogos(orgId, path)
  return updated
}

export async function removeOrgLogo(orgId) {
  const updated = await updateOrg(orgId, { logo_url: null })
  await cleanupOldLogos(orgId, null)
  return updated
}
