import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { fullNameOf } from '../lib/profile.js'
import {
  POSITION_LIMIT,
  POSITION_NAME_MAX,
  POSITION_NAME_MIN,
  addCommonPositions,
  createPosition,
  deletePosition,
  fetchPositionHolders,
  fetchPositions,
  positionErrorMessage,
  renamePosition,
  reorderPositions,
  setAllowMultiple,
} from '../lib/officerPositions.js'
import Avatar from './Avatar.jsx'
import styles from './OfficerPositions.module.css'

/* ============================================================
   OFFICER POSITIONS — nasa ilalim ng Org Profile (Adviser)

   Dito ginagawa ng Adviser ang listahan ng position ng org niya:
   magdagdag, magpalit ng pangalan, ayusin ang pagkakasunod-sunod
   (↑ ↓), at magbura.

   HINDI dito nag-a-assign ng tao. Sa Members page iyon ("Set
   position"), dahil doon nakikita ang lahat ng member. Dito ay
   ipinapakita lang kung sino ang may hawak ng bawat position.

   Hindi mabubura ang position habang may may hawak pa — kaya
   naka-disable ang "Delete" (hinaharang din ito ng database).
   ============================================================ */
function OfficerPositions({ orgId }) {
  const [positions, setPositions] = useState([])
  const [holders, setHolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(null) // null | 'add' | 'common' | <position id>

  /* Bagong position */
  const [newName, setNewName] = useState('')
  const [newMultiple, setNewMultiple] = useState(false)

  /* Pag-edit ng isang position */
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editMultiple, setEditMultiple] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, people] = await Promise.all([fetchPositions(orgId), fetchPositionHolders(orgId)])
      setPositions(list)
      setHolders(people)
      setLoadError(false)
    } catch (err) {
      console.error('Hindi makuha ang officer positions:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  /* position id → [mga may hawak] */
  const holdersByPosition = useMemo(() => {
    const map = new Map()
    holders.forEach((h) => {
      map.set(h.position_id, [...(map.get(h.position_id) ?? []), h])
    })
    return map
  }, [holders])

  const atLimit = positions.length >= POSITION_LIMIT

  function clearMessages() {
    setError('')
    setNotice('')
  }

  async function run(key, action, successMessage) {
    clearMessages()
    setBusy(key)
    try {
      await action()
      if (successMessage) setNotice(successMessage)
      return true
    } catch (err) {
      console.error('Hindi na-save ang officer position:', err)
      setError(positionErrorMessage(err))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (name.length < POSITION_NAME_MIN) {
      clearMessages()
      setError(`The position name must be ${POSITION_NAME_MIN} to ${POSITION_NAME_MAX} characters.`)
      return
    }

    const nextOrder = positions.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1
    const ok = await run(
      'add',
      async () => {
        const created = await createPosition(orgId, { name, allowMultiple: newMultiple }, nextOrder)
        setPositions((list) => [...list, created])
      },
      `"${name}" added.`,
    )
    if (ok) {
      setNewName('')
      setNewMultiple(false)
    }
  }

  function handleAddCommon() {
    return run(
      'common',
      async () => {
        const added = await addCommonPositions(orgId, positions)
        setPositions((list) => [...list, ...added])
      },
      'Common positions added. Rename or remove any you don’t need.',
    )
  }

  function startEdit(position) {
    clearMessages()
    setEditingId(position.id)
    setEditName(position.name)
    setEditMultiple(position.allow_multiple)
  }

  async function handleSaveEdit(e, position) {
    e.preventDefault()
    const name = editName.trim()
    if (name.length < POSITION_NAME_MIN) {
      clearMessages()
      setError(`The position name must be ${POSITION_NAME_MIN} to ${POSITION_NAME_MAX} characters.`)
      return
    }

    const ok = await run(position.id, async () => {
      let updated = position
      if (name !== position.name) updated = await renamePosition(position.id, name)
      if (editMultiple !== position.allow_multiple) {
        updated = await setAllowMultiple(position.id, editMultiple)
      }
      setPositions((list) => list.map((p) => (p.id === updated.id ? updated : p)))
    })
    if (ok) setEditingId(null)
  }

  function handleMove(index, direction) {
    const target = index + direction
    if (target < 0 || target >= positions.length) return

    const ordered = [...positions]
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]

    /* Ipakita agad; ibalik kapag pumalya */
    const before = positions
    setPositions(ordered)
    run(positions[index].id, async () => {
      try {
        setPositions(await reorderPositions(ordered))
      } catch (err) {
        setPositions(before)
        throw err
      }
    })
  }

  function handleDelete(position) {
    if (!window.confirm(`Delete the position "${position.name}"?`)) return
    run(
      position.id,
      async () => {
        await deletePosition(position.id)
        setPositions((list) => list.filter((p) => p.id !== position.id))
      },
      `"${position.name}" deleted.`,
    )
  }

  /* ---------- laman ---------- */

  return (
    <section className={styles.section} aria-labelledby="officer-positions-title">
      <div className={styles.header}>
        <div>
          <h2 id="officer-positions-title" className={styles.title}>
            Officer Positions
          </h2>
          <p className={styles.subtitle}>
            The positions in your organization, from highest to lowest. To give a member a
            position, go to <Link to="/members">Members</Link> and choose{' '}
            <strong>Set position</strong>.
          </p>
        </div>
        {!loading && !loadError && (
          <span className={styles.count}>
            {positions.length} / {POSITION_LIMIT}
          </span>
        )}
      </div>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading && <p className={styles.status}>Loading positions…</p>}

      {!loading && loadError && (
        <p className={styles.status}>
          Could not load the positions.{' '}
          <button type="button" className={styles.linkButton} onClick={load}>
            Try again
          </button>
        </p>
      )}

      {!loading && !loadError && (
        <>
          {positions.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No positions yet</p>
              <p className={styles.emptyText}>
                Start with the usual list (President, Vice Presidents, Secretary, Treasurer,
                Auditor, PRO, and more), or add your own below.
              </p>
              <button
                type="button"
                className={styles.primary}
                onClick={handleAddCommon}
                disabled={Boolean(busy)}
              >
                <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />
                {busy === 'common' ? 'Adding…' : 'Add common positions'}
              </button>
            </div>
          ) : (
            <ol className={styles.list}>
              {positions.map((position, index) => {
                const people = holdersByPosition.get(position.id) ?? []
                const rowBusy = busy === position.id
                const disabled = Boolean(busy)

                if (editingId === position.id) {
                  return (
                    <li key={position.id} className={`${styles.item} ${styles.editing}`}>
                      <form className={styles.editForm} onSubmit={(e) => handleSaveEdit(e, position)}>
                        <input
                          className={styles.input}
                          value={editName}
                          maxLength={POSITION_NAME_MAX}
                          onChange={(e) => setEditName(e.target.value)}
                          aria-label="Position name"
                          autoFocus
                          required
                        />
                        <label className={styles.check}>
                          <input
                            type="checkbox"
                            checked={editMultiple}
                            onChange={(e) => setEditMultiple(e.target.checked)}
                          />
                          More than one person can hold this
                        </label>
                        <div className={styles.editActions}>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => setEditingId(null)}
                            disabled={rowBusy}
                          >
                            Cancel
                          </button>
                          <button type="submit" className={styles.primary} disabled={rowBusy}>
                            {rowBusy ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </form>
                    </li>
                  )
                }

                return (
                  <li key={position.id} className={styles.item}>
                    <span className={styles.rank} aria-hidden="true">
                      {index + 1}
                    </span>

                    <div className={styles.info}>
                      <p className={styles.name}>
                        {position.name}
                        {position.allow_multiple && (
                          <span className={styles.badge}>Multiple</span>
                        )}
                      </p>
                      {people.length > 0 ? (
                        <ul className={styles.holders}>
                          {people.map((h) => (
                            <li key={h.id} className={styles.holder}>
                              <Avatar src={h.avatar_url} name={fullNameOf(h)} size="sm" />
                              {fullNameOf(h)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.vacant}>Vacant</p>
                      )}
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => handleMove(index, -1)}
                        disabled={disabled || index === 0}
                        aria-label={`Move ${position.name} up`}
                        title="Move up"
                      >
                        <ArrowUp size={16} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => handleMove(index, 1)}
                        disabled={disabled || index === positions.length - 1}
                        aria-label={`Move ${position.name} down`}
                        title="Move down"
                      >
                        <ArrowDown size={16} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => startEdit(position)}
                        disabled={disabled}
                      >
                        <Pencil size={14} strokeWidth={2.4} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.smallButton} ${styles.danger}`}
                        onClick={() => handleDelete(position)}
                        disabled={disabled || people.length > 0}
                        title={
                          people.length > 0
                            ? 'Remove the officer from this position on the Members page first.'
                            : undefined
                        }
                      >
                        <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                        {rowBusy ? '…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {/* ---------- Bagong position ---------- */}
          {!atLimit ? (
            <form className={styles.addForm} onSubmit={handleAdd}>
              <input
                className={styles.input}
                value={newName}
                maxLength={POSITION_NAME_MAX}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New position, e.g. Treasurer"
                aria-label="New position name"
              />
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={newMultiple}
                  onChange={(e) => setNewMultiple(e.target.checked)}
                />
                More than one person can hold this
              </label>
              <button
                type="submit"
                className={styles.primary}
                disabled={Boolean(busy) || newName.trim() === ''}
              >
                <Plus size={16} strokeWidth={2.6} aria-hidden="true" />
                {busy === 'add' ? 'Adding…' : 'Add position'}
              </button>
            </form>
          ) : (
            <p className={styles.hint}>
              You have reached the limit of {POSITION_LIMIT} positions.
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default OfficerPositions
