import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fullNameOf } from '../lib/profile.js'
import { positionErrorMessage } from '../lib/officerPositions.js'
import Avatar from './Avatar.jsx'
import base from './ProposalForm.module.css'
import styles from './PositionDialog.module.css'

/* ============================================================
   POSITION DIALOG — "Set position" sa Members page (Adviser)

   Pipili ang Adviser ng position para sa isang member.
     May position     → magiging Officer (automatic)
     Remove position  → babalik sa pagiging Member

   Naka-disable ang position na hawak na ng iba (maliban kung
   "More than one person can hold this"). Hinaharang din ito ng
   database, kaya ligtas kahit sabay na nag-assign ang dalawa.

   Hindi dito nagse-save. Tinatawag lang ang onSave(positionId)
   (null = tanggalin); kapag nag-throw, dito lalabas ang error
   at mananatiling bukas ang dialog.
   ============================================================ */
function PositionDialog({ member, positions, holdersByPosition, canManagePositions, onSave, onCancel }) {
  const [selected, setSelected] = useState(member.position_id ?? null)
  const [saving, setSaving] = useState(null) // null | 'save' | 'remove'
  const [error, setError] = useState('')

  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  const name = fullNameOf(member)
  const isOfficer = member.role_id === 2
  const current = member.officer_positions?.name ?? (isOfficer ? 'Officer (no position)' : 'Member')
  const unchanged = selected === (member.position_id ?? null)

  async function submit(positionId, kind) {
    setError('')
    setSaving(kind)
    try {
      await onSave(positionId)
    } catch (err) {
      console.error('Hindi na-save ang position:', err)
      setError(positionErrorMessage(err))
      setSaving(null)
    }
  }

  function handleRemove() {
    const what = member.officer_positions?.name ?? 'Officer'
    if (!window.confirm(`Remove ${name} as ${what}? They will become a Member.`)) return
    submit(null, 'remove')
  }

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-dialog-title"
      >
        <h2 id="position-dialog-title" className={base.heading}>
          Set officer position
        </h2>

        <div className={styles.person}>
          <Avatar src={member.avatar_url} name={name} size="sm" />
          <div>
            <p className={styles.name}>{name}</p>
            <p className={styles.current}>Currently: {current}</p>
          </div>
        </div>

        {positions.length === 0 ? (
          <p className={styles.none}>
            This organization has no officer positions yet.{' '}
            {canManagePositions ? (
              <>
                Add them first in <Link to="/org-profile">Org Profile</Link>.
              </>
            ) : (
              'The adviser can add them in Org Profile.'
            )}
          </p>
        ) : (
          <fieldset className={styles.options} disabled={Boolean(saving)}>
            <legend className={styles.legend}>Choose a position</legend>
            {positions.map((p) => {
              const others = (holdersByPosition.get(p.id) ?? []).filter((h) => h.id !== member.id)
              const taken = !p.allow_multiple && others.length > 0

              return (
                <label
                  key={p.id}
                  className={`${styles.option} ${selected === p.id ? styles.selected : ''} ${
                    taken ? styles.taken : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="position"
                    value={p.id}
                    checked={selected === p.id}
                    disabled={taken}
                    onChange={() => setSelected(p.id)}
                  />
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{p.name}</span>
                    {others.length > 0 && (
                      <span className={styles.optionHolder}>
                        {taken ? 'Held by ' : 'Also held by '}
                        {others.map(fullNameOf).join(', ')}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        <p className={styles.hint}>
          Giving a position makes them an <strong>Officer</strong>. Removing it makes them a{' '}
          <strong>Member</strong> again. They will get a notification either way.
        </p>

        {error && <p className={base.error}>{error}</p>}

        <div className={`${base.actions} ${styles.actions}`}>
          {isOfficer && (
            <button
              type="button"
              className={`${base.secondary} ${styles.remove}`}
              onClick={handleRemove}
              disabled={Boolean(saving)}
            >
              {saving === 'remove' ? 'Removing…' : 'Remove position'}
            </button>
          )}
          <button
            ref={cancelRef}
            type="button"
            className={base.secondary}
            onClick={onCancel}
            disabled={Boolean(saving)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={base.primary}
            onClick={() => submit(selected, 'save')}
            disabled={Boolean(saving) || !selected || unchanged}
          >
            {saving === 'save' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PositionDialog
