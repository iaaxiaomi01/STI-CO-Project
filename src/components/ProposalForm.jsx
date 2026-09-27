import { useEffect, useRef, useState } from 'react'
import {
  DESCRIPTION_MAX,
  PROPOSED_TO_MAX,
  TITLE_MAX,
} from '../lib/proposals.js'
import styles from './ProposalForm.module.css'

/* ============================================================
   PROPOSAL FORM — modal para sa GUMAWA at MAG-EDIT

   Tatlo lang ang tinatype: Title, Proposed to, Description.
   Ang Organization Name, Logo at Proposed by ay kusang
   nilalagay — galing sila sa org at sa account mo.

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values) — ang page ang tatawag sa database.
   ============================================================ */
function ProposalForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [proposedTo, setProposedTo] = useState(initial?.proposed_to ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)

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
      proposedTo: proposedTo.trim(),
      description: description.trim(),
    }

    if (!clean.title || !clean.proposedTo || !clean.description) {
      setError('Kailangan ang Title, Proposed to at Description.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean)
    } catch (err) {
      console.error('Hindi na-save ang proposal:', err)
      setError(
        err?.message === 'not-allowed'
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
          <span className={styles.label}>Proposed to</span>
          <input
            className={styles.input}
            value={proposedTo}
            maxLength={PROPOSED_TO_MAX}
            onChange={(e) => setProposedTo(e.target.value)}
            placeholder="hal. Ms. Maria Santos, SAO Coordinator"
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
            placeholder="Ano ang aktibidad, layunin, kailan, saan, at sino ang sasali."
            required
          />
        </label>

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
