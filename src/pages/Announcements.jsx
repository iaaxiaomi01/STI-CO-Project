import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  authorLabel,
  canManageAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  formatDate,
  typeLabel,
  updateAnnouncement,
  wasEdited,
} from '../lib/announcements.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AnnouncementForm from '../components/AnnouncementForm.jsx'
import styles from './Announcements.module.css'

/* ============================================================
   ANNOUNCEMENTS — TOTOONG DATA mula sa public.announcements

   Member  → nakikita ang announcements ng org niya
   Officer → nakikita lahat sa org niya, nagpapaskil,
             nag-e-edit/nagde-delete ng gawa ng Officers
   Adviser → nakikita lahat sa org niya, nagpapaskil,
             nag-e-edit/nagde-delete ng sarili at ng Officers

   Ang RLS sa database ang totoong nagbabantay. Ang
   can.announce at canManageAnnouncement() dito ay para lang
   itago ang mga button na hindi mo magagamit.
   ============================================================ */
function Announcements() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  /* null = sarado ang form
     'new' = bagong announcement
     { ...announcement } = ine-edit */
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAnnouncements()
      setAnnouncements(data)
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang announcements:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const closeForm = useCallback(() => setEditing(null), [])

  async function handleSubmit(values) {
    if (editing === 'new') {
      const created = await createAnnouncement(values)
      setAnnouncements((list) => [created, ...list])
      setNotice('Nai-post ang announcement.')
    } else {
      const updated = await updateAnnouncement(editing.id, values)
      setAnnouncements((list) =>
        list.map((a) => (a.id === updated.id ? updated : a)),
      )
      setNotice('Na-save ang pagbabago.')
    }
    setEditing(null)
  }

  async function handleDelete(announcement) {
    const ok = window.confirm(
      `Burahin ang "${announcement.title}"? Hindi na ito maibabalik.`,
    )
    if (!ok) return

    setDeletingId(announcement.id)
    setNotice('')
    try {
      await deleteAnnouncement(announcement.id)
      setAnnouncements((list) => list.filter((a) => a.id !== announcement.id))
      setNotice('Nabura ang announcement.')
    } catch (err) {
      console.error('Hindi nabura ang announcement:', err)
      setNotice(
        err?.message === 'not-allowed'
          ? 'Wala kang pahintulot na burahin ang announcement na ito.'
          : 'Hindi nabura. Subukan ulit.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={
          can.announce
            ? 'Maglabas ng balita at paalala sa mga miyembro ng organisasyon.'
            : 'Pinakabagong balita at paalala mula sa organisasyon.'
        }
        action={
          can.announce && (
            <ActionButton
              onClick={() => {
                setNotice('')
                setEditing('new')
              }}
            >
              + Magpaskil
            </ActionButton>
          )
        }
      />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.status}>Kinukuha ang announcements…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang announcements"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && announcements.length === 0 && (
        <EmptyState
          icon="★"
          title="Wala pang announcement"
          message={
            can.announce
              ? 'Pindutin ang "+ Magpaskil" para gumawa ng unang announcement ng organisasyon.'
              : 'Dito lalabas ang mga bagong paskil ng Officers at Adviser ng organisasyon mo.'
          }
        />
      )}

      {!loading && !error && announcements.length > 0 && (
        <ul className={styles.list}>
          {announcements.map((a) => {
            const manageable = canManageAnnouncement(a, profile)
            const busy = deletingId === a.id

            return (
              <li key={a.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={`${styles.type} ${styles[`type_${a.type}`] ?? ''}`}>
                    {typeLabel(a.type)}
                  </span>
                  <time className={styles.date} dateTime={a.created_at}>
                    {formatDate(a.created_at)}
                    {wasEdited(a) && (
                      <span
                        className={styles.edited}
                        title={`Na-edit noong ${formatDate(a.updated_at)}`}
                      >
                        {' '}· na-edit
                      </span>
                    )}
                  </time>
                </div>

                <h2 className={styles.title}>{a.title}</h2>
                <p className={styles.message}>{a.message}</p>

                <div className={styles.cardBottom}>
                  <p className={styles.author}>{authorLabel(a)}</p>

                  {manageable && (
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => {
                          setNotice('')
                          setEditing(a)
                        }}
                        disabled={busy}
                      >
                        I-edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.linkButton} ${styles.danger}`}
                        onClick={() => handleDelete(a)}
                        disabled={busy}
                      >
                        {busy ? 'Binubura…' : 'Burahin'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <AnnouncementForm
          initial={editing === 'new' ? null : editing}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}
    </>
  )
}

export default Announcements
