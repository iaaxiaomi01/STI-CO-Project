import { supabase } from './supabaseClient.js'

/* ============================================================
   PROPOSAL FILES — ang mga file na naka-attach sa proposal

   KAILANGAN may kahit ISANG file, at hanggang MAX_FILES (10)
   ang pwede (PROPOSAL_MULTIPLE_FILES.sql).

   SAAN NAKATIRA (per org pa rin):
     Storage bucket 'proposal-files' (PRIVATE)
       → <org id>/<officer id>/<timestamp>-<random>.<ext>
     proposals.attachments → [{ path, name, size }, ...]

   Ang lumang attachment_path / attachment_name / attachment_size
   ay hindi na ginagamit. Nailipat na sila sa attachments, pero
   binabasa pa rin ng attachmentsOf() kung sakali.

   PRIVATE ang bucket, kaya walang public URL. Sa pag-download,
   humihingi tayo ng signed URL na 60 segundo lang ang buhay.

   Ang database ang totoong bantay:
     - Officer lang ang nakaka-upload, sa sarili niyang folder
       (sa loob ng folder ng org niya)
     - Officer at Adviser ng parehong org ang nakaka-download
       (pati SAO, School Head, at SA kapag may budget)
     - 10 MB bawat file, at mga uri ng file sa ibaba lang
     - 1 hanggang 10 file bawat proposal
   Ang mga check dito ay para lang sa malinaw na error message.
   ============================================================ */

const BUCKET = 'proposal-files'
const DOWNLOAD_SECONDS = 60

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB bawat file
export const MAX_FILES = 10

/* extension → content type. Dito rin kinukuha ang content type
   dahil minsan blangko ang file.type ng .docx sa ibang browser. */
const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/* Para sa <input type="file" accept=...> */
export const ACCEPT_ATTRIBUTE = Object.keys(FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')

export const ACCEPTED_LABEL = 'PDF, Word, Excel, PowerPoint, JPG or PNG'

/* Mensaheng maiintindihan ng user */
export class ProposalFileError extends Error {}

function extensionOf(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(name ?? '')
  return match ? match[1].toLowerCase() : ''
}

export function checkProposalFile(file) {
  if (!FILE_TYPES[extensionOf(file.name)]) {
    throw new ProposalFileError(`"${file.name}": only ${ACCEPTED_LABEL} files are accepted.`)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ProposalFileError(`"${file.name}" is too large (10 MB max).`)
  }
  if (file.size === 0) {
    throw new ProposalFileError(`"${file.name}" is empty.`)
  }
}

/* Ang mga file ng proposal: [{ path, name, size }]
   Galing sa attachments; kapag wala, sa lumang iisang file. */
export function attachmentsOf(proposal) {
  const list = Array.isArray(proposal?.attachments)
    ? proposal.attachments.filter((f) => f?.path)
    : []
  if (list.length > 0) return list

  return proposal?.attachment_path
    ? [
        {
          path: proposal.attachment_path,
          name: proposal.attachment_name,
          size: proposal.attachment_size,
        },
      ]
    : []
}

/* Natatanging pangalan sa storage: "1731234567890-k3j9x2ab.pdf"
   (letra, numero at gitling lang — tugma sa check ng database) */
function storageName(ext) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${Date.now()}-${random}.${ext}`
}

/* Ina-upload ang isang file. Ibinabalik ang { path, name, size }. */
export async function uploadProposalFile(profile, file) {
  checkProposalFile(file)

  const ext = extensionOf(file.name)
  const path = `${profile.organization_id}/${profile.id}/${storageName(ext)}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: FILE_TYPES[ext],
    upsert: false,
  })

  if (error) {
    console.error('Hindi na-upload ang file:', error)
    throw new ProposalFileError(`"${file.name}" could not be uploaded. Please try again.`)
  }

  return { path, name: file.name.trim().slice(0, 255), size: file.size }
}

/* Ina-upload ang LAHAT ng file, isa-isa. Kapag may pumalya,
   binubura ang mga na-upload na para walang maiwan. */
export async function uploadProposalFiles(profile, files) {
  const uploaded = []
  try {
    for (const file of files) {
      uploaded.push(await uploadProposalFile(profile, file))
    }
  } catch (err) {
    await deleteProposalFiles(uploaded.map((f) => f.path))
    throw err
  }
  return uploaded
}

/* Binubura ang mga file. Hindi kritikal kapag pumalya —
   lumang file lang ang maiiwan sa storage. */
export async function deleteProposalFiles(paths) {
  const list = (paths ?? []).filter(Boolean)
  if (list.length === 0) return
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(list)
    if (error) throw error
  } catch (err) {
    console.warn('Hindi nabura ang file ng proposal:', err)
  }
}

export async function deleteProposalFile(path) {
  return deleteProposalFiles([path])
}

/* Dina-download ang isang file ({ path, name }) gamit ang
   orihinal nitong pangalan */
export async function downloadProposalFile(file) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.path, DOWNLOAD_SECONDS, {
      download: file.name || true,
    })

  if (error) throw error

  const link = document.createElement('a')
  link.href = data.signedUrl
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/* "1.2 MB" */
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}