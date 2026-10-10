import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
} from '../lib/proposals.js'
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_LABEL,
  ProposalFileError,
  checkProposalFile,
  formatFileSize,
} from '../lib/proposalFiles.js'
import styles from './ProposalForm.module.css'

/* ============================================================
   PROPOSAL FORM — modal para sa GUMAWA at MAG-EDIT

   Tinatype: Title at Description. May opsyonal na File
   (isa lang) — hal. ang pirmadong proposal o budget.
   Ang Organization Name, Logo at Proposed by ay kusang
   nilalagay — galing sila sa org at sa account mo.

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { file, removeFile }) — ang page ang
   mag-a-upload at tatawag sa database.
   ============================================================ */
function ProposalForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* Bagong file na pinili (wala pang na-upload) */
  const [file, setFile] = useState(null)
  /* Sa pag-edit: inalis ang dating file */
  const [removeFile, setRemoveFile] = useState(false)
  const [fileError, setFileError] = useState('')

  const titleRef = useRef(null)
  const fileInputRef = useRef(null)

  /* Ang dating file — lalabas lang kapag ine-edit, may file,
     at hindi pa inaalis o pinapalitan */
  const currentFile =
    isEdit && initial.attachment_path && !removeFile && !file ? initial : null

  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = '' // para mapili ulit ang parehong file
    if (!picked) return

    try {
      checkProposalFile(picked)
      setFile(picked)
      setFileError('')
    } catch (err) {
      setFileError(err.message)
    }
  }

  function clearFile() {
    if (file) {
      setFile(null)
    } else {
      setRemoveFile(true)
    }
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
      await onSubmit(clean, { file, removeFile })
    } catch (err) {
      console.error('Hindi na-save ang proposal:', err)
      setError(
        err instanceof ProposalFileError
          ? err.message
          : err?.message === 'not-allowed'
            ? 'Wala kang pahintulot na baguhin ang proposal na ito.'
            : 'Hindi na-save. Subukan ulit.',
      )
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
          {isEdit ? 'I-edit ang proposal' : 'Bagong proposal'}
        </h2>

        <p className={styles.note}>
          Ang logo at pangalan ng organisasyon, at ang pangalan mo bilang
          nagpasa, ay kusang ilalagay sa sulat.
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

          {file || currentFile ? (
            <div className={styles.fileBox}>
              <span className={styles.fileIcon} aria-hidden="true">
                📎
              </span>
              <span className={styles.fileInfo}>
                <span className={styles.fileName}>
                  {file ? file.name : currentFile.attachment_name}
                </span>
                <span className={styles.fileSize}>
                  {formatFileSize(file ? file.size : currentFile.attachment_size)}
                  {file && isEdit && initial.attachment_path && ' · papalitan ang dating file'}
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

          {removeFile && !file && (
            <span className={styles.hint}>
              Aalisin ang dating file kapag na-save.{' '}
              <button
                type="button"
                className={styles.undoButton}
                onClick={() => setRemoveFile(false)}
              >
                Ibalik
              </button>
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
            {saving ? 'Sine-save…' : isEdit ? 'I-save ang pagbabago' : 'Ipasa'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProposalForm
