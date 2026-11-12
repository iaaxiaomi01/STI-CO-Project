import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { adminErrorMessage } from '../lib/schoolAdmin.js'
import styles from './NewOrganization.module.css'

/* ============================================================
   NEW ORGANIZATION — button at form (School Administrator)

   Hiwalay sa Edit dialog ng pages/Organizations.jsx para may
   sariling itsura ang paggawa ng bagong org. Pareho pa rin ang
   laman at logic ng dating form:
     Name, Department, Program, Description, Active,
     Can post to all organizations → saveOrganization()

   Wala pang logo at officer positions dito (wala pang id ang
   org); sa "Edit" na iyon idinadagdag.
   ============================================================ */

export function NewOrganizationButton({ onClick }) {
  return (
    <button type="button" className={styles.newButton} onClick={onClick}>
      <span className={styles.newIcon} aria-hidden="true">
        <Plus size={18} strokeWidth={2.6} />
      </span>
      New organization
    </button>
  )
}

function NewOrganizationDialog({ specialOrg, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [program, setProgram] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [canAnnounceAll, setCanAnnounceAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const errorRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  /* Nasa ilalim ng form ang error; i-scroll para makita agad */
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [error])

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
    if (name.trim().length < 2) {
      setError('The name must be at least 2 characters.')
      nameRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      await onSave({ name, department, program, description, isActive, canAnnounceAll })
    } catch (err) {
      console.error('Hindi na-save ang org:', err)
      setError(adminErrorMessage(err))
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
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-org-title"
        aria-describedby="new-org-hint"
      >
        <header className={styles.head}>
          <h2 id="new-org-title" className={styles.title}>
            New organization
          </h2>
          <p id="new-org-hint" className={styles.hint}>
            After creating it, open “Edit” to add the logo and officer positions.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.body}>
          <fieldset className={styles.fields} disabled={saving}>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                ref={nameRef}
                className={`${styles.input} ${styles.nameInput}`}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                required
                aria-invalid={Boolean(error) && name.trim().length < 2}
              />
            </label>

            <div className={styles.pair}>
              <label className={styles.field}>
                <span className={styles.label}>
                  Department <span className={styles.optional}>(optional)</span>
                </span>
                <input
                  className={styles.input}
                  value={department}
                  maxLength={100}
                  placeholder="e.g. CCS, SHS, Tertiary"
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  Program <span className={styles.optional}>(optional)</span>
                </span>
                <input
                  className={styles.input}
                  value={program}
                  maxLength={100}
                  placeholder="e.g. BSIT, BSHM, BSTM"
                  onChange={(e) => setProgram(e.target.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span className={styles.label}>
                  Description <span className={styles.optional}>(optional)</span>
                </span>
                <span className={styles.counter}>{description.length}/2000</span>
              </span>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={description}
                maxLength={2000}
                placeholder="What the organization is, its purpose, and who it is for."
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className={styles.settings}>
              <label className={styles.setting}>
                <span className={styles.settingText}>
                  <span className={styles.settingTitle}>Active</span>
                  <span className={styles.settingNote}>
                    Inactive organizations are hidden from the landing page and cannot be chosen
                    for new members.
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className={styles.switch}
                  checked={isActive}
                  onChange={(e) => {
                    setIsActive(e.target.checked)
                    /* Hindi pwedeng special ang inactive */
                    if (!e.target.checked) setCanAnnounceAll(false)
                  }}
                />
              </label>

              <label
                className={`${styles.setting} ${canAnnounceAll ? styles.settingSpecial : ''}`}
              >
                <span className={styles.settingText}>
                  <span className={styles.settingTitle}>Can post to all organizations</span>
                  <span className={styles.settingNote}>
                    Its officers and adviser can post announcements for every organization. Only
                    one organization can have this
                    {specialOrg ? ` — turning it on removes it from ${specialOrg.name}.` : '.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className={styles.switch}
                  checked={canAnnounceAll}
                  disabled={!isActive}
                  onChange={(e) => setCanAnnounceAll(e.target.checked)}
                />
              </label>
            </div>

            {error && (
              <p ref={errorRef} className={styles.error} role="alert">
                {error}
              </p>
            )}
          </fieldset>
          </div>

          <footer className={styles.foot}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={styles.create} disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default NewOrganizationDialog
