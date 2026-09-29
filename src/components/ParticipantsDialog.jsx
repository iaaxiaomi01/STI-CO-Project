import { useEffect, useState } from 'react'
import { fetchParticipants, participantLabel } from '../lib/events.js'
import base from './ProposalForm.module.css'
import styles from './ParticipantsDialog.module.css'

/* ============================================================
   PARTICIPANTS DIALOG — listahan ng sasali sa isang event

   Para sa Officer at Adviser lang (hinaharang din ng RLS ang
   Member — sariling join lang ang makikita niya).
   ============================================================ */
function ParticipantsDialog({ event, onClose }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchParticipants(event.id)
      .then((data) => {
        if (active) setList(data)
      })
      .catch((err) => {
        console.error('Hindi makuha ang listahan ng sasali:', err)
        if (active) setError('Hindi makuha ang listahan. Subukan ulit.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [event.id])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={base.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="participants-title"
      >
        <h2 id="participants-title" className={base.heading}>
          Mga sasali
        </h2>
        <p className={base.note}>
          <strong>{event.title}</strong>
          {!loading && !error && ` · ${list.length} ang sasali`}
        </p>

        {loading && <p className={styles.muted}>Kinukuha ang listahan…</p>}
        {error && <p className={base.error}>{error}</p>}

        {!loading && !error && list.length === 0 && (
          <p className={styles.muted}>Wala pang sumasali sa event na ito.</p>
        )}

        {!loading && !error && list.length > 0 && (
          <ol className={styles.list}>
            {list.map((p, i) => {
              const { name, role } = participantLabel(p)
              return (
                <li key={p.profile_id} className={styles.row}>
                  <span className={styles.num}>{i + 1}</span>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.role}>{role}</span>
                </li>
              )
            })}
          </ol>
        )}

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onClose}>
            Isara
          </button>
        </div>
      </div>
    </div>
  )
}

export default ParticipantsDialog
