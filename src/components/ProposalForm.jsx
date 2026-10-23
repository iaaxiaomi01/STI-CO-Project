import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  VENUE_MAX,
  formatDateTime,
  isFutureSchedule,
  latestRevision,
  stageLabel,
  todayKey,
} from '../lib/proposals.js'
import { toTimeInput } from '../lib/events.js'
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

   Sa pag-revise, nakalagay na ang dating Title, Description,
   Venue, Date, oras at file, at nasa itaas ang komento ng nag-pa-revise. Pwedeng
   panatilihin, palitan, o alisin ang file.

   Tinatype: Title, Description, Venue, Date, Start Time at
   End Time (kailangan lahat). May opsyonal na File
   (isa lang) — hal. ang pirmadong proposal o budget.

   May checkbox na "This proposal has a budget" (has_budget).
   Kapag naka-check, dadaan pa ito sa School Administrator
   pagkatapos ng School Head (ADD_SCHOOL_ADMINISTRATOR.sql).
   Pwede itong baguhin habang nire-revise.
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
  const [venue, setVenue] = useState(proposal?.venue ?? '')
  const [eventDate, setEventDate] = useState(proposal?.event_date ?? '')
  const [startTime, setStartTime] = useState(toTimeInput(proposal?.start_time))
  const [endTime, setEndTime] = useState(toTimeInput(proposal?.end_time))
  const [hasBudget, setHasBudget] = useState(Boolean(proposal?.has_budget))
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
      venue: venue.trim(),
      eventDate,
      startTime,
      endTime,
      hasBudget,
    }

    if (
      !clean.title ||
      !clean.description ||
      !clean.venue ||
      !clean.eventDate ||
      !clean.startTime ||
      !clean.endTime
    ) {
      setError('All fields except File are required.')
      return
    }

    if (clean.endTime <= clean.startTime) {
      setError('End Time must be later than Start Time.')
      return
    }

    if (!isFutureSchedule(clean.eventDate, clean.startTime)) {
      setError('The date and time of the activity must be in the future.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean, { file, keepExisting: !file && keepExisting })
    } catch (err) {
      console.error('Hindi na-save ang proposal:', err)
      let message = 'Could not save. Please try again.'
      if (err instanceof ProposalFileError) {
        message = err.message
      } else if (err?.message === 'not-allowed') {
        message = "You don't have permission to revise this proposal."
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
          {editing ? 'Revise proposal' : 'New proposal'}
        </h2>

        {revision && (
          <div className={styles.revisionBox}>
            <p className={styles.revisionHead}>
              Revision requested by {stageLabel(revision.stage)}
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
              Make the needed changes, then press &quot;Resubmit&quot;. It will go back
              to <strong>{stageLabel(proposal.revision_from)}</strong> for another review.
            </>
          ) : (
            "The organization's logo and name, and your name as the submitter, will be added to the letter automatically."
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
            required
          />
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
            required
          />
        </label>

        {/* ---------- VENUE ---------- */}
        <label className={styles.field}>
          <span className={styles.label}>Venue</span>
          <input
            className={styles.input}
            value={venue}
            maxLength={VENUE_MAX}
            onChange={(e) => setVenue(e.target.value)}
            required
          />
        </label>

        {/* ---------- DATE AT ORAS ---------- */}
        <div className={styles.grid3}>
          <label className={styles.field}>
            <span className={styles.label}>Date</span>
            <input
              type="date"
              className={styles.input}
              value={eventDate}
              min={todayKey()}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Start Time</span>
            <input
              type="time"
              className={styles.input}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>End Time</span>
            <input
              type="time"
              className={styles.input}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </label>
        </div>

        {/* ---------- MAY BUDGET? ---------- */}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={hasBudget}
            onChange={(e) => setHasBudget(e.target.checked)}
            disabled={saving}
          />
          <span>
            <strong>This proposal has a budget</strong>
            <span className={styles.hint}>
              {hasBudget
                ? 'Review: Adviser → SAO → School Head → School Administrator'
                : 'Review: Adviser → SAO → School Head'}
            </span>
          </span>
        </label>

        {/* ---------- FILE (opsyonal) ---------- */}
        <div className={styles.field}>
          <span className={styles.label}>
            File <span className={styles.optional}>(optional)</span>
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
                    : `${formatFileSize(proposal.attachment_size)} · current file`}
                </span>
              </span>
              <button
                type="button"
                className={styles.fileAction}
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                Change
              </button>
              <button
                type="button"
                className={`${styles.fileAction} ${styles.fileRemove}`}
                onClick={clearFile}
                disabled={saving}
              >
                Remove
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
              {ACCEPTED_LABEL} · up to 10 MB.
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
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Resubmit' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProposalForm