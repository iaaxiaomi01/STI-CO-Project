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
      setNotice('Announcement posted.')
    } else {
      const updated = await updateAnnouncement(editing.id, values)
      setAnnouncements((list) =>
        list.map((a) => (a.id === updated.id ? updated : a)),
      )
      setNotice('Changes saved.')
    }
    setEditing(null)
  }

  async function handleDelete(announcement) {
    const ok = window.confirm(
      `Delete "${announcement.title}"? This cannot be undone.`,
    )
    if (!ok) return

    setDeletingId(announcement.id)
    setNotice('')
    try {
      await deleteAnnouncement(announcement.id)
      setAnnouncements((list) => list.filter((a) => a.id !== announcement.id))
      setNotice('Announcement deleted.')
    } catch (err) {
      console.error('Hindi nabura ang announcement:', err)
      setNotice(
        err?.message === 'not-allowed'
          ? "You don't have permission to delete this announcement."
          : 'Could not delete. Please try again.',
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
            ? 'Share news and reminders with your organization members.'
            : 'The latest news and reminders from your organization.'
        }
        action={
          can.announce && (
            <ActionButton
              onClick={() => {
                setNotice('')
                setEditing('new')
              }}
            >
              + Post
            </ActionButton>
          )
        }
      />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.status}>Loading announcements…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load announcements"
          message="There was a problem connecting to the database. Please try again later."
        />
      )}

      {!loading && !error && announcements.length === 0 && (
        <EmptyState
          icon="★"
          title="No announcements yet"
          message={
            can.announce
              ? 'Press "+ Post" to create your organization\'s first announcement.'
              : 'New posts from your organization\'s Officers and Adviser will appear here.'
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
                        title={`Edited on ${formatDate(a.updated_at)}`}
                      >
                        {' '}· edited
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
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.linkButton} ${styles.danger}`}
                        onClick={() => handleDelete(a)}
                        disabled={busy}
                      >
                        {busy ? 'Deleting…' : 'Delete'}
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
