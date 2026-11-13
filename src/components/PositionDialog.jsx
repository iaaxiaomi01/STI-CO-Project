import { useEffect, useRef, useState } from 'react'
import { Check, Info, Lock, UserCheck, UserMinus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { ROLE_KEYS } from '../config/roles.js'
import { fullNameOf } from '../lib/profile.js'
import { positionErrorMessage } from '../lib/officerPositions.js'
import Avatar from './Avatar.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import adviserStyles from './PositionDialog.module.css'
import adminStyles from './PositionDialogAdmin.module.css'

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

   look="admin" → itsura para sa Users page ng School Administrator
   (PositionDialogAdmin.module.css). Pareho ang laman at gawain;
   ibang kulay at ayos lang. Walang look → itsura ng Adviser.

   Kapag wala pang position ang org:
     Adviser              → link sa Org Profile
     School Administrator → link sa Organizations (Edit → Officer
                            positions); wala na siyang Org Profile
   ============================================================ */
function PositionDialog({ member, positions, holdersByPosition, canManagePositions, look, onSave, onCancel }) {
  const styles = look === 'admin' ? adminStyles : adviserStyles
  const { role } = useAuth()
  const [selected, setSelected] = useState(member.position_id ?? null)
  const [saving, setSaving] = useState(null) // null | 'save' | 'remove'
  const [error, setError] = useState('')
  /* Bukas ang "Remove position?" na ConfirmDialog */
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      /* Kapag bukas ang ConfirmDialog, iyon lang ang isasara ng Esc */
      if (e.key === 'Escape' && !saving && !confirmingRemove) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, confirmingRemove, onCancel])

  const name = fullNameOf(member)
  const isOfficer = member.role_id === 2
  const current = member.officer_positions?.name ?? (isOfficer ? 'Officer (no position)' : 'Member')
  const unchanged = selected === (member.position_id ?? null)
  const isSchoolAdmin = role === ROLE_KEYS.SCHOOL_ADMIN

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

  /* "Remove position" → bubuksan muna ang ConfirmDialog (kapalit ng
     window.confirm() ng browser). Kapag nag-throw ang onSave, sa
     ConfirmDialog lalabas ang error at mananatili itong bukas. */
  const currentPositionName = member.officer_positions?.name ?? 'Officer'

  async function handleRemove() {
    setError('')
    setSaving('remove')
    try {
      await onSave(null)
    } catch (err) {
      console.error('Hindi natanggal ang position:', err)
      setSaving(null)
      throw new Error(positionErrorMessage(err))
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
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-dialog-title"
      >
        {/* ---------- HEADER ---------- */}
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <UserCheck size={22} strokeWidth={2.2} />
          </span>
          <div className={styles.headText}>
            <h2 id="position-dialog-title" className={styles.heading}>
              Set officer position
            </h2>
            <p className={styles.subtitle}>Choose the role this member will hold.</p>
          </div>
        </div>

        <div className={styles.body}>
          {/* ---------- ANG TAO ---------- */}
          <div className={styles.person}>
            <Avatar src={member.avatar_url} name={name} size="md" />
            <div className={styles.personText}>
              <p className={styles.name}>{name}</p>
              <p className={styles.current}>
                <span className={styles.currentLabel}>Currently</span>
                <span className={`${styles.currentBadge} ${isOfficer ? styles.isOfficer : ''}`}>
                  {current}
                </span>
              </p>
            </div>
          </div>

          {/* ---------- MGA POSITION ---------- */}
          {positions.length === 0 ? (
            <div className={styles.none}>
              <p className={styles.noneTitle}>No officer positions yet</p>
              <p className={styles.noneText}>
                {canManagePositions ? (
                  isSchoolAdmin ? (
                    <>
                      Add them first in <Link to="/organizations">Organizations</Link> (Edit →
                      Officer positions).
                    </>
                  ) : (
                    <>
                      Add them first in <Link to="/org-profile">Org Profile</Link>.
                    </>
                  )
                ) : (
                  'The adviser can add them in Org Profile.'
                )}
              </p>
            </div>
          ) : (
            <fieldset className={styles.options} disabled={Boolean(saving)}>
              <legend className={styles.legend}>Choose a position</legend>
              <div className={styles.optionList}>
                {positions.map((p) => {
                  const others = (holdersByPosition.get(p.id) ?? []).filter(
                    (h) => h.id !== member.id,
                  )
                  const taken = !p.allow_multiple && others.length > 0
                  const isCurrent = member.position_id === p.id

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
                      <span className={styles.radio} aria-hidden="true">
                        {taken ? (
                          <Lock size={11} strokeWidth={2.8} />
                        ) : (
                          <Check size={12} strokeWidth={3.4} />
                        )}
                      </span>
                      <span className={styles.optionText}>
                        <span className={styles.optionName}>{p.name}</span>
                        {others.length > 0 && (
                          <span className={styles.optionHolder}>
                            {taken ? 'Held by ' : 'Also held by '}
                            {others.map(fullNameOf).join(', ')}
                          </span>
                        )}
                      </span>
                      {isCurrent && <span className={styles.tag}>Current</span>}
                      {!isCurrent && taken && <span className={`${styles.tag} ${styles.tagTaken}`}>Taken</span>}
                      {!isCurrent && !taken && p.allow_multiple && (
                        <span className={`${styles.tag} ${styles.tagMulti}`}>Shared</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          <p className={styles.note}>
            <Info size={16} strokeWidth={2.4} className={styles.noteIcon} aria-hidden="true" />
            <span>
              Giving a position makes them an <strong>Officer</strong>. Removing it makes them a{' '}
              <strong>Member</strong> again. They will get a notification either way.
            </span>
          </p>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {/* ---------- MGA BUTTON ---------- */}
        <div className={styles.actions}>
          {isOfficer && (
            <button
              type="button"
              className={styles.remove}
              onClick={() => setConfirmingRemove(true)}
              disabled={Boolean(saving)}
            >
              <UserMinus size={16} strokeWidth={2.4} aria-hidden="true" />
              {saving === 'remove' ? 'Removing…' : 'Remove position'}
            </button>
          )}
          <span className={styles.spacer} />
          <button
            ref={cancelRef}
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={Boolean(saving)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => submit(selected, 'save')}
            disabled={Boolean(saving) || !selected || unchanged}
          >
            {saving === 'save' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* "Sigurado ka ba?" bago tanggalin ang position */}
      {confirmingRemove && (
        <ConfirmDialog
          tone="danger"
          icon={UserMinus}
          title="Remove position?"
          item={`${name} · ${currentPositionName}`}
          message="They will become a Member again and will get a notification."
          confirmLabel="Remove"
          busyLabel="Removing…"
          onConfirm={handleRemove}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  )
}

export default PositionDialog