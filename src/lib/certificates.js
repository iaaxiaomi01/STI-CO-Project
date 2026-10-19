import { supabase } from './supabaseClient.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'

/* ============================================================
   EVENT CERTIFICATES — ang "drop box" ng certificate

   PARA KANINO:
     Sa mga NAKAKUMPLETO ng event: nag-Join, may Time In AT
     Time Out. Tig-isang file bawat tao.

   SINO ANG NAG-A-UPLOAD:
     Lahat ng Officer at ang Adviser ng org. Hindi pwedeng
     i-upload ng Officer ang SARILI niyang certificate (pareho
     ng patakaran sa attendance), kaya ibang Officer o ang
     Adviser ang gagawa.

   SINO ANG NAKAKAKITA:
     May-ari ng certificate → sarili lang (sa Events page)
     Officer at Adviser     → buong listahan (Certificates dialog)

   SAAN NAKATIRA:
     Storage bucket 'event-certificates' (PRIVATE)
       → <org id>/<event id>/<profile id>/<timestamp>.<ext>
     public.event_certificates (isang row bawat tao bawat event)

   PRIVATE ang bucket, kaya walang public URL. Sa pag-download,
   humihingi tayo ng signed URL na 60 segundo lang ang buhay.

   Ang database ang totoong bantay (tingnan ang
   EVENT_CERTIFICATES.sql). Ang mga check dito ay para lang
   itago ang mga button at magbigay ng malinaw na mensahe.
   ============================================================ */

const BUCKET = 'event-certificates'
const DOWNLOAD_SECONDS = 60

export const MAX_CERT_BYTES = 10 * 1024 * 1024 // 10 MB

/* extension → content type. KAPAREHO ng allowed_mime_types ng
   bucket sa EVENT_CERTIFICATES.sql. */
const FILE_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/* Para sa <input type="file" accept=...> */
export const CERT_ACCEPT = Object.keys(FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')

export const CERT_ACCEPTED_LABEL = 'PDF, JPG or PNG'

/* Mensaheng maiintindihan ng user */
export class CertificateError extends Error {}

const CERT_COLUMNS = 'event_id, profile_id, file_path, file_name, file_size, uploaded_by_name, uploaded_at'

function extensionOf(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(name ?? '')
  return match ? match[1].toLowerCase() : ''
}

export function checkCertificateFile(file) {
  if (!file) throw new CertificateError('No file selected.')
  if (!FILE_TYPES[extensionOf(file.name)]) {
    throw new CertificateError(`Only ${CERT_ACCEPTED_LABEL} files are accepted.`)
  }
  if (file.size > MAX_CERT_BYTES) {
    throw new CertificateError('The file is too large (10 MB max).')
  }
  if (file.size === 0) {
    throw new CertificateError('The file is empty.')
  }
}

/* ---------- SINO ANG PWEDE (para sa mga button lang) ---------- */

/* Officer at Adviser ng org ng event */
export function canManageCertificates(event, profile) {
  return Boolean(
    profile?.is_active &&
      (profile.role_id === 2 || profile.role_id === 3) &&
      event.organization_id === profile.organization_id,
  )
}

/* Hindi pwedeng i-upload ang sariling certificate */
export function canUploadCertificateFor(profileId, profile) {
  return profileId !== profile?.id
}

/* ---------- PAGKUHA ---------- */

/* Mga nakakumpleto ng event (may Time In at Time Out).
   Officer/Adviser lang ang makakakuha ng buong listahan (RLS). */
export async function fetchCompleters(eventId) {
  const { data, error } = await supabase
    .from('event_attendance')
    .select('profile_id, attendee_name, attendee_role_id, time_in, time_out')
    .eq('event_id', eventId)
    .not('time_out', 'is', null)
    .order('attendee_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

/* Mga certificate ng isang event → { [profile_id]: row } */
export async function fetchEventCertificates(eventId) {
  const { data, error } = await supabase
    .from('event_certificates')
    .select(CERT_COLUMNS)
    .eq('event_id', eventId)

  if (error) throw error
  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.profile_id] = r
  })
  return map
}

/* Sariling certificate sa lahat ng event → { [event_id]: row } */
export async function fetchMyCertificates(profileId) {
  const { data, error } = await supabase
    .from('event_certificates')
    .select(CERT_COLUMNS)
    .eq('profile_id', profileId)

  if (error) throw error
  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.event_id] = r
  })
  return map
}

/* ---------- MAG-UPLOAD / MAGPALIT / MAGBURA ---------- */

async function removeFiles(paths) {
  const list = paths.filter(Boolean)
  if (list.length === 0) return
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(list)
    if (error) throw error
  } catch (err) {
    console.warn('Hindi nabura ang certificate file:', err)
  }
}

/* Ina-upload ang certificate ni profileId para sa event.
   Kapag may dati na, papalitan ito (at buburahin ang lumang file).
   Ibinabalik ang bagong row. */
export async function uploadCertificate(event, profileId, file, existing = null) {
  checkCertificateFile(file)

  const ext = extensionOf(file.name)
  const path = `${event.organization_id}/${event.id}/${profileId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: FILE_TYPES[ext],
    upsert: false,
  })
  if (uploadError) {
    console.error('Hindi na-upload ang certificate:', uploadError)
    throw new CertificateError('The file could not be uploaded. Please try again.')
  }

  /* Ang org, nag-upload at oras ay itinatakda ng trigger */
  const { data, error } = await supabase
    .from('event_certificates')
    .upsert(
      {
        event_id: event.id,
        profile_id: profileId,
        organization_id: event.organization_id,
        file_path: path,
        file_name: file.name.trim().slice(0, 255),
        file_size: file.size,
      },
      { onConflict: 'event_id,profile_id' },
    )
    .select(CERT_COLUMNS)
    .single()

  if (error) {
    /* Hindi na-save → burahin ang na-upload para walang maiwang file */
    await removeFiles([path])
    throw error
  }

  if (existing?.file_path && existing.file_path !== path) {
    await removeFiles([existing.file_path])
  }
  return data
}

export async function deleteCertificate(cert) {
  const { data, error } = await supabase
    .from('event_certificates')
    .delete()
    .eq('event_id', cert.event_id)
    .eq('profile_id', cert.profile_id)
    .select('profile_id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')

  await removeFiles([cert.file_path])
}

/* Para sa pagbura ng event: kunin muna ang mga file path (habang
   umiiral pa ang mga row), burahin ang event, tapos ito. */
export async function fetchCertificatePaths(eventId) {
  const { data, error } = await supabase
    .from('event_certificates')
    .select('file_path')
    .eq('event_id', eventId)

  if (error) throw error
  return (data ?? []).map((r) => r.file_path)
}

export async function removeCertificateFiles(paths) {
  await removeFiles(paths)
}

/* ---------- PAG-DOWNLOAD ---------- */

export async function downloadCertificate(cert) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(cert.file_path, DOWNLOAD_SECONDS, {
      download: cert.file_name,
    })

  if (error) throw error

  const link = document.createElement('a')
  link.href = data.signedUrl
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/* ---------- PAG-FORMAT ---------- */

export function completerLabel(row) {
  return {
    name: toTitleCase(row.attendee_name),
    role: getRoleConfig(roleKeyFromId(row.attendee_role_id)).label,
  }
}

export function certificateErrorMessage(err) {
  if (err instanceof CertificateError) return err.message
  /* Galing sa trigger — nakasulat na sa Tagalog */
  if (err?.code === 'P0001' && err.message) return err.message
  /* Walang attendance row (FK) */
  if (err?.code === '23503') {
    return 'Certificates are only for attendees with complete attendance (Time In and Time Out).'
  }
  if (err?.code === '42501' || err?.message === 'not-allowed') {
    return "You don't have permission to do this."
  }
  return 'There was a connection problem. Please try again.'
}
