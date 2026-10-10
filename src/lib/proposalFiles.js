import { supabase } from './supabaseClient.js'

/* ============================================================
   PROPOSAL FILES — ang file na naka-attach sa proposal

   SAAN NAKATIRA:
     Storage bucket 'proposal-files' (PRIVATE)
       → <org id>/<officer id>/<timestamp>.<ext>
     proposals.attachment_path / attachment_name / attachment_size

   PRIVATE ang bucket, kaya walang public URL. Sa pag-download,
   humihingi tayo ng signed URL na 60 segundo lang ang buhay.

   Ang database ang totoong bantay (tingnan ang
   PROPOSAL_ATTACHMENT.sql):
     - Officer lang ang nakaka-upload, sa sarili niyang folder
     - Officer at Adviser ng parehong org ang nakaka-download
     - 10 MB at mga uri ng file sa ibaba lang ang tinatanggap
   Ang mga check dito ay para lang sa malinaw na error message.
   ============================================================ */

const BUCKET = 'proposal-files'
const DOWNLOAD_SECONDS = 60

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

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

export const ACCEPTED_LABEL = 'PDF, Word, Excel, PowerPoint, JPG o PNG'

/* Mensaheng maiintindihan ng user */
export class ProposalFileError extends Error {}

function extensionOf(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(name ?? '')
  return match ? match[1].toLowerCase() : ''
}

export function checkProposalFile(file) {
  if (!FILE_TYPES[extensionOf(file.name)]) {
    throw new ProposalFileError(`${ACCEPTED_LABEL} lang ang tinatanggap.`)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ProposalFileError('Masyadong malaki ang file (hanggang 10 MB lang).')
  }
  if (file.size === 0) {
    throw new ProposalFileError('Walang laman ang file.')
  }
}

/* Ina-upload ang file. Ibinabalik ang { path, name, size }
   na ise-save sa proposal. */
export async function uploadProposalFile(profile, file) {
  checkProposalFile(file)

  const ext = extensionOf(file.name)
  const path = `${profile.organization_id}/${profile.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: FILE_TYPES[ext],
    upsert: false,
  })

  if (error) {
    console.error('Hindi na-upload ang file:', error)
    throw new ProposalFileError('Hindi na-upload ang file. Subukan ulit.')
  }

  return { path, name: file.name.trim().slice(0, 255), size: file.size }
}

/* Binubura ang file. Hindi kritikal kapag pumalya —
   lumang file lang ang maiiwan sa storage. */
export async function deleteProposalFile(path) {
  if (!path) return
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) throw error
  } catch (err) {
    console.warn('Hindi nabura ang file ng proposal:', err)
  }
}

/* Dina-download ang file gamit ang orihinal nitong pangalan */
export async function downloadProposalFile(proposal) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(proposal.attachment_path, DOWNLOAD_SECONDS, {
      download: proposal.attachment_name,
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
