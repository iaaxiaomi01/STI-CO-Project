import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  formatDateTime,
  latestRevision,
  stageLabel,
} from '../lib/proposals.js'
import { toTitleCase } from '../lib/profile.js'
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_LABEL,
  ProposalFileError,
  checkProposalFile,
  formatFileSize,
} from '../lib/proposalFiles.js'
import styles from './ProposalForm.module.css'

/* ============================================================
   PROPOSAL FORM — modal para sa paggawa ng BAGONG proposal,
   at para sa pag-REVISE ng proposal na ibinalik ng Adviser o SAO

     <ProposalForm onSubmit ... />                 → bago
     <ProposalForm proposal={p} onSubmit ... />    → i-revise

   Sa pag-revise, nakalagay na ang dating Title, Description at
   file, at nasa itaas ang komento ng nag-pa-revise. Pwedeng
   panatilihin, palitan, o alisin ang file.

   Tinatype: Title at Description. May opsyonal na File
   (isa lang) — hal. ang pirmadong proposal o budget.
   Ang Organization Name, Logo at Proposed by ay kusang
   nilalagay — galing sila sa org at sa account mo.

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { file, keepExisting }) — ang page ang
   mag-a-upload at tatawag sa database.
     file         → bagong file na pinili (o null)
     keepExisting → true kapag pinanatili ang dating file
   ============================================================ */
function ProposalForm({ proposal = null, onSubmit, onCancel }) {
  const editing = Boolean(proposal)
  const revision = editing ? latestRevision(proposal) : null

  const [title, setTitle] = useState(proposal?.title ?? '')
  const [description, setDescription] = useState(proposal?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* File na pinili (wala pang na-upload) */
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')

  /* Ang dating file ng proposal (sa pag-revise lang).
     Nagiging false kapag inalis o pinalitan. */
  const [keepExisting, setKeepExisting] = useState(Boolean(proposal?.attachment_path))

  const titleRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = '' // para mapili ulit ang parehong file
    if (!picked) return

    try {
      checkProposalFile(picked)
      setFile(picked)
      setKeepExisting(false)
      setFileError('')
    } catch (err) {
      setFileError(err.message)
    }
  }

  function clearFile() {
    setFile(null)
    setKeepExisting(false)
    setFileError('')
  }

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  /* Esc para isara — pero hindi habang nagse-save */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const clean = {
      title: title.trim(),
      description: description.trim(),
    }

    if (!clean.title || !clean.description) {
      setError('Kailangan ang Title at Description.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean, { file, keepExisting: !file && keepExisting })
    } catch (err) {
      console.error('Hindi na-save ang proposal:', err)
      let message = 'Hindi na-save. Subukan ulit.'
      if (err instanceof ProposalFileError) {
        message = err.message
      } else if (err?.message === 'not-allowed') {
        message = 'Wala kang pahintulot na i-revise ang proposal na ito.'
      } else if (err?.code === 'P0001' && err.message) {
        /* Mensahe galing sa resubmit_proposal() sa database */
        message = err.message
      }
      setError(message)
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={styles.modal}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proposal-form-title"
      >
        <h2 id="proposal-form-title" className={styles.heading}>
          {editing ? 'I-revise ang proposal' : 'Bagong proposal'}
        </h2>

        {revision && (
          <div className={styles.revisionBox}>
            <p className={styles.revisionHead}>
              Ipina-revise ng {stageLabel(revision.stage)}
            </p>
            <p className={styles.revisionBy}>
              {toTitleCase(revision.requester_name ?? '')} ·{' '}
              {formatDateTime(revision.requested_at)}
            </p>
            <p className={styles.revisionComment}>{revision.comment}</p>
          </div>
        )}

        <p className={styles.note}>
          {editing ? (
            <>
              Baguhin ang kailangan, tapos pindutin ang &quot;Ipasa ulit&quot;. Babalik ito
              sa <strong>{stageLabel(proposal.revision_from)}</strong> para suriin muli.
            </>
          ) : (
            'Ang logo at pangalan ng organisasyon, at ang pangalan mo bilang nagpasa, ay kusang ilalagay sa sulat.'
          )}
        </p>

        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input
            ref={titleRef}
            className={styles.input}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="hal. Tech Summit 2026"
            required
          />
          <span className={styles.hint}>Ito ang magiging SUBJECT ng sulat.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>Description</span>
            <span className={styles.counter}>
              {description.length} / {DESCRIPTION_MAX}
            </span>
          </span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            rows={10}
            placeholder="Ano ang aktibidad, layunin, kailan, saan, at sino ang sasali."
            required
          />
        </label>

        {/* ---------- FILE (opsyonal) ---------- */}
        <div className={styles.field}>
          <span className={styles.label}>
            File <span className={styles.optional}>(opsyonal)</span>
          </span>

          {file || keepExisting ? (
            <div className={styles.fileBox}>
              <span className={styles.fileIcon} aria-hidden="true">
                📎
              </span>
              <span className={styles.fileInfo}>
                <span className={styles.fileName}>
                  {file ? file.name : proposal.attachment_name}
                </span>
                <span className={styles.fileSize}>
                  {file
                    ? formatFileSize(file.size)
                    : `${formatFileSize(proposal.attachment_size)} · dating file`}
                </span>
              </span>
              <button
                type="button"
                className={styles.fileAction}
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                Palitan
              </button>
              <button
                type="button"
                className={`${styles.fileAction} ${styles.fileRemove}`}
                onClick={clearFile}
                disabled={saving}
              >
                Alisin
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <span aria-hidden="true">⬆</span> Upload a file
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            onChange={handleFileChange}
            className={styles.hiddenInput}
            tabIndex={-1}
            aria-hidden="true"
          />

          {fileError ? (
            <span className={styles.fileError}>{fileError}</span>
          ) : (
            <span className={styles.hint}>
              {ACCEPTED_LABEL} · hanggang 10 MB. Makikita at mada-download ito ng
              Adviser.
            </span>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Kanselahin
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? 'Sine-save…' : editing ? 'Ipasa ulit' : 'Ipasa'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProposalForm