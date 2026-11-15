import { useEffect, useRef, useState } from 'react'
import { CalendarDays, FileText, Info, Paperclip, Upload } from 'lucide-react'
import {
  APPROVER_STAGES,
  DESCRIPTION_MAX,
  OG_REWARD_MAX,
  TITLE_MAX,
  VENUE_MAX,
  approverStages,
  fetchApproverOptions,
  isFutureSchedule,
  stageLabel,
  toOgReward,
  todayKey,
} from '../lib/proposals.js'
import { addDaysKey, formatSchedule } from '../lib/events.js'
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  ProposalFileError,
  checkProposalFile,
  formatFileSize,
} from '../lib/proposalFiles.js'
import ApproverPicker from './ApproverPicker.jsx'
/* Sariling itsura ng Proposal form. HINDI na ang ProposalForm.module.css —
   shared iyon ng EventForm, ReviewDialog, ShopItemForm, atbp., kaya
   hindi sila naaapektuhan ng disenyong ito. */
import styles from './ProposalFormUI.module.css'

/* ============================================================
   PROPOSAL FORM — modal para sa paggawa ng BAGONG proposal

     <ProposalForm onSubmit ... onCancel ... />

   Wala nang pag-edit ng proposal. Kapag may mali, burahin ito
   habang wala pang umaaksyon, at gumawa ng bago.

   Tinatype: Title, Description, Venue, Start Date, End Date,
   Start Time at End Time (kailangan lahat).

   START DATE AT END DATE (PROPOSAL_START_END_DATE.sql):
     Tuloy-tuloy ang activity mula (Start Date + Start Time)
     hanggang (End Date + End Time). Kapag iisang araw lang,
     pareho ang Start Date at End Date.
     - Pagpili ng Start Date, kusang sumusunod ang End Date kapag
       blangko pa ito o mas maaga sa Start Date.
     - Hindi pwedeng mas maaga ang End Date sa Start Date.
     - Kapag iisang araw, ang End Time ay dapat lampas sa Start Time.
     Sinusuri ulit ito ng database (proposals_check_schedule).

   FILES (PROPOSAL_MULTIPLE_FILES.sql): KAILANGAN may kahit ISANG
   file, hanggang MAX_FILES (10). Pwedeng pumili ng marami nang
   sabay-sabay. Hal. ang pirmadong proposal, budget, program flow.

   May checkbox na "This proposal has a budget" (has_budget).
   Kapag naka-check, dadaan pa ito sa School Administrator
   pagkatapos ng School Head (ADD_SCHOOL_ADMINISTRATOR.sql).

   APPROVERS (PROPOSAL_APPROVER_PICKER.sql, components/ApproverPicker.jsx):
   pipili ang Officer kung SINO ang approver sa bawat stage — ISANG
   Adviser (ng org niya), ISA O HIGIT PANG SAO at School Head, at
   ISANG School Administrator (kapag may budget). Kailangang may
   napili sa lahat. Kapag iisa lang ang pagpipilian, kusa na itong napipili.

   OG REWARD (OG_REWARD_FROM_PROPOSAL.sql): ilang OG ang makukuha
   ng bawat Member at Officer na may Time In AT Time Out. Blangko
   o 0 = walang reward. Kusang nare-release pagsara ng attendance
   ng event — wala nang kailangang pindutin.
   Ang Organization Name, Logo at Proposed by ay kusang
   nilalagay — galing sila sa org at sa account mo.

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { files }) — ang page ang
   mag-a-upload at tatawag sa database.
     values.eventDate → Start Date · values.endDate → End Date
     values.approvers → { adviser: [id], sao: [id, ...], school_head: [...],
                          school_admin: [...] (may budget lang) }
     files            → mga file na pinili (File[])
   ============================================================ */

/* Para hindi madoble ang parehong file na napili ulit */
function fileKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`
}

/* Ilang araw mula Start Date hanggang End Date (kasama pareho) */
function dayCount(start, end) {
  if (!start || !end || end < start) return 0
  let count = 1
  for (let key = start; key < end && count <= 366; key = addDaysKey(key, 1)) count += 1
  return count
}

function ProposalForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue] = useState('')
  /* eventDate = START DATE (event_date sa database) */
  const [eventDate, setEventDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hasBudget, setHasBudget] = useState(false)
  const [ogReward, setOgReward] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* Pagpili ng Start Date: sumusunod ang End Date kapag blangko pa
     ito o naging mas maaga sa bagong Start Date */
  function handleStartDateChange(value) {
    setEventDate(value)
    if (value && (!endDate || endDate < value)) setEndDate(value)
  }

  /* Ilang araw ang activity — para sa maliit na paalala sa ilalim */
  const days = dayCount(eventDate, endDate)
  const schedulePreview =
    eventDate && endDate && startTime && endTime && days > 0
      ? formatSchedule({
          event_date: eventDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
        })
      : ''

  /* ---------- APPROVERS ----------
     approvers → { adviser: ['id'], sao: ['id', 'id'], school_head: [...], school_admin: [...] }
     options   → null habang kinukuha, o { adviser: [{ id, name }], ... } */
  const [approvers, setApprovers] = useState(() =>
    Object.fromEntries(APPROVER_STAGES.map((stage) => [stage, []])),
  )
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')

  useEffect(() => {
    let active = true

    fetchApproverOptions()
      .then((list) => {
        if (!active) return
        setOptions(list)
        setApprovers((current) => {
          const next = {}
          for (const stage of APPROVER_STAGES) {
            const choices = list[stage] ?? []
            /* Alisin ang napiling wala sa listahan */
            next[stage] = current[stage].filter((id) => choices.some((o) => o.id === id))
            /* Iisa lang ang pagpipilian → kusa nang napipili */
            if (next[stage].length === 0 && choices.length === 1) next[stage] = [choices[0].id]
          }
          return next
        })
      })
      .catch((err) => {
        console.error('Hindi makuha ang listahan ng approvers:', err)
        if (active) setOptionsError('Could not load the list of approvers. Please close this form and try again.')
      })

    return () => {
      active = false
    }
    /* Isang beses lang pagbukas ng form */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setApprover(stage, ids) {
    setApprovers((current) => ({ ...current, [stage]: ids }))
  }

  /* ---------- FILES ----------
     newFiles → mga pinili (wala pang na-upload): [{ key, file }] */
  const [newFiles, setNewFiles] = useState([])
  const [fileError, setFileError] = useState('')

  const fileCount = newFiles.length
  const canAddMore = fileCount < MAX_FILES

  const titleRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // para mapili ulit ang parehong file
    if (picked.length === 0) return

    const problems = []
    const accepted = []
    const existing = new Set(newFiles.map((f) => f.key))
    let room = MAX_FILES - fileCount

    for (const file of picked) {
      const key = fileKey(file)
      if (existing.has(key)) continue // napili na

      try {
        checkProposalFile(file)
      } catch (err) {
        problems.push(err.message)
        continue
      }

      if (room <= 0) {
        problems.push(`You can attach up to ${MAX_FILES} files only.`)
        break
      }

      existing.add(key)
      accepted.push({ key, file })
      room -= 1
    }

    if (accepted.length > 0) setNewFiles((list) => [...list, ...accepted])
    setFileError(problems.join(' '))
  }

  function removeNew(key) {
    setNewFiles((list) => list.filter((f) => f.key !== key))
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

    const neededStages = approverStages(hasBudget)

    const clean = {
      title: title.trim(),
      description: description.trim(),
      venue: venue.trim(),
      eventDate,
      endDate,
      startTime,
      endTime,
      hasBudget,
      ogReward: toOgReward(ogReward),
      approvers: Object.fromEntries(neededStages.map((stage) => [stage, approvers[stage]])),
    }

    if (
      !clean.title ||
      !clean.description ||
      !clean.venue ||
      !clean.eventDate ||
      !clean.endDate ||
      !clean.startTime ||
      !clean.endTime
    ) {
      setError('All fields except OG reward are required.')
      return
    }

    if (fileCount === 0) {
      setError('Please upload at least one file.')
      return
    }

    if (fileCount > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files only.`)
      return
    }

    if (
      !/^\d*$/.test(ogReward.trim()) ||
      !(clean.ogReward >= 0 && clean.ogReward <= OG_REWARD_MAX)
    ) {
      setError(`OG reward must be a whole number from 0 to ${OG_REWARD_MAX}.`)
      return
    }

    if (clean.endDate < clean.eventDate) {
      setError('End Date cannot be earlier than Start Date.')
      return
    }

    /* Iisang araw: ang End Time ay dapat lampas sa Start Time.
       Maraming araw: laging lampas na ang katapusan. */
    if (clean.endDate === clean.eventDate && clean.endTime <= clean.startTime) {
      setError('End Time must be later than Start Time.')
      return
    }

    if (!isFutureSchedule(clean.eventDate, clean.startTime)) {
      setError('The start date and time of the activity must be in the future.')
      return
    }

    if (!options) {
      setError(optionsError || 'The list of approvers is still loading. Please wait a moment.')
      return
    }

    const missing = neededStages.find((stage) => clean.approvers[stage].length === 0)
    if (missing) {
      setError(`Please choose the ${stageLabel(missing)}.`)
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean, { files: newFiles.map((f) => f.file) })
    } catch (err) {
      console.error('Hindi na-save ang proposal:', err)
      let message = 'Could not save. Please try again.'
      if (err instanceof ProposalFileError) {
        message = err.message
      } else if (err?.message === 'not-allowed') {
        message = "You don't have permission to submit this proposal."
      } else if (err?.code === 'P0001' && err.message) {
        /* Mensahe galing sa database: ang
           pagsusuri ng approvers (hal. "Please choose the SAO."),
           ng mga file (hal. "Please upload at least one file."),
           o ng petsa (hal. "End Date cannot be earlier than Start Date.") */
        message = err.message
      } else if (err?.code === '23514' && err.message?.includes('proposals_schedule_order')) {
        message = 'The end (End Date and End Time) must be later than the start.'
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
        {/* ---------- HEADER (nakadikit sa itaas habang nag-i-scroll) ---------- */}
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <FileText size={22} strokeWidth={2.2} />
          </span>
          <h2 id="proposal-form-title" className={styles.heading}>
            New proposal
          </h2>
        </div>

        <div className={styles.body}>
          <p className={styles.note}>
            <Info size={16} strokeWidth={2.4} className={styles.noteIcon} aria-hidden="true" />
            <span>
              The organization’s name, logo, and submitter’s name are automatically included in the letter.
            </span>
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

          {/* ---------- SCHEDULE (Start/End Date, Start/End Time, silip) ---------- */}
          <div className={styles.scheduleCard}>
            {/* ---------- START DATE · END DATE ---------- */}
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span className={styles.label}>Start Date</span>
                <input
                  type="date"
                  className={styles.input}
                  value={eventDate}
                  min={todayKey()}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  required
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>End Date</span>
                <input
                  type="date"
                  className={styles.input}
                  value={endDate}
                  min={eventDate || todayKey()}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </label>
            </div>

            {/* ---------- START TIME · END TIME ---------- */}
            <div className={styles.grid2}>
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

            {/* Silip ng buong schedule — lalo na kapag maraming araw */}
            {schedulePreview && (
              <p className={styles.schedulePreview}>
                <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
                <span>
                  {days > 1 ? `${days} days · ` : 'One day · '}
                  {schedulePreview}
                </span>
              </p>
            )}
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

          {/* ---------- APPROVERS (Adviser, SA: isa · SAO, School Head: isa o higit pa) ---------- */}
          <ApproverPicker
            stages={approverStages(hasBudget)}
            options={options}
            value={approvers}
            onChange={setApprover}
            disabled={saving}
            error={optionsError}
          />

          {/* ---------- OG REWARD (opsyonal) ---------- */}
          <label className={styles.field}>
            <span className={styles.label}>
              OG reward per attendee
            </span>
            <input
              className={styles.input}
              inputMode="numeric"
              value={ogReward}
              onChange={(e) => setOgReward(e.target.value)}
              placeholder="0"
              disabled={saving}
            />
            <span className={styles.hint}>
              Automatically awarded to participants with complete Time In and Time Out records after attendance closes. 
              Max {OG_REWARD_MAX}.
            </span>
          </label>

          {/* ---------- FILES (kailangan, 1 hanggang MAX_FILES) ---------- */}
          <div className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.label}>
                Files <span className={styles.required}>(Required)</span>
              </span>
              <span className={styles.counter}>
                {fileCount} / {MAX_FILES}
              </span>
            </span>

            {fileCount > 0 && (
              <ul className={styles.fileList}>
                {newFiles.map(({ key, file }) => (
                  <li key={key} className={styles.fileBox}>
                    <span className={styles.fileIcon} aria-hidden="true">
                      <Paperclip size={16} strokeWidth={2.4} />
                    </span>
                    <span className={styles.fileInfo}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                    </span>
                    <button
                      type="button"
                      className={`${styles.fileAction} ${styles.fileRemove}`}
                      onClick={() => removeNew(key)}
                      disabled={saving}
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {canAddMore && (
              <button
                type="button"
                className={styles.uploadButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                <span className={styles.uploadIcon} aria-hidden="true">
                  <Upload size={16} strokeWidth={2.6} />
                </span>
                {fileCount === 0 ? 'Upload files' : 'Add more files'}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              multiple
              onChange={handleFileChange}
              className={styles.hiddenInput}
              tabIndex={-1}
              aria-hidden="true"
            />

            {fileError && <span className={styles.fileError}>{fileError}</span>}
            <span className={styles.hint}>
              Max 10 MB per file. Multiple files allowed.
            </span>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {/* ---------- MGA BUTTON (nakadikit sa ibaba habang nag-i-scroll) ---------- */}
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
            {saving ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProposalForm