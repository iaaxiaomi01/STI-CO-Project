import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Siren,
  Bell,
  Building2,
  Clock,
  Globe,
  Megaphone,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  authorLabel,
  canManageAnnouncement,
  audienceOf,
  canPostToAllOrgs,
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  formatDate,
  selectedOrgsLabel,
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
             nagde-delete ng gawa ng Officers
   Adviser → nakikita lahat sa org niya, nagpapaskil,
             nagde-delete ng sarili at ng Officers
   (Wala nang Edit button sa page na ito.)

   LAHAT NG ORG: nakikita rin ng lahat ang mga global post
   (is_global) at ang mga post na pinili ang org mo
   (announcement_orgs). Ang Officer/Adviser ng org na may
   can_announce_all ay pwedeng mag-post para sa sariling org,
   sa lahat, o sa mga piniling org lang.

   Ang RLS sa database ang totoong nagbabantay. Ang
   can.announce at canManageAnnouncement() dito ay para lang
   itago ang mga button na hindi mo magagamit.

   ITSURA (UI lang — walang binago sa data o mga aksyon):
     - POP-UP ng pinakabagong announcement pagbukas ng page,
       parang emergency alert ng iPhone (LatestAlert sa ibaba).
       Ang pinakabago ay ang una sa listahan, dahil naka-order
       na sa created_at (pinakabago una) ang fetchAnnouncements().
     - Ang pinakabago ay malaking navy na card sa itaas
       ("Latest"); ang iba ay nasa "Earlier".
   ============================================================ */

/* Icon ng bawat type ng announcement (ANNOUNCEMENT_TYPES) */
const TYPE_ICONS = {
  meeting: Users,
  reminder: Bell,
  urgent: Siren,
}

function TypeIcon({ type, size = 20 }) {
  const Icon = TYPE_ICONS[type] ?? Megaphone
  return <Icon size={size} strokeWidth={2.2} aria-hidden="true" />
}

/* ============================================================
   LATEST ALERT — pop-up na parang iPhone emergency alert

   Lumalabas sa gitna ng screen, may blur sa likod. Wala nang
   "Close" na button; sarado kapag pinindot ang labas ng alert,
   o ang Esc.
   "View" → isasara at dadalhin ka sa "Latest" na card.
   Itsura lang: walang binabago sa database.
   ============================================================ */
function LatestAlert({ announcement: a, onClose, onView }) {
  const viewRef = useRef(null)

  useEffect(() => {
    viewRef.current?.focus()
    function handleKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className={styles.alertBackdrop} onClick={onClose}>
      <div
        className={`${styles.alert} ${styles[`alert_${a.type}`] ?? ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="latest-alert-title"
        aria-describedby="latest-alert-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.alertHead}>
          <span className={styles.alertIcon}>
            <TypeIcon type={a.type} size={26} />
          </span>
          <p className={styles.alertEyebrow}>
            Latest announcement · {typeLabel(a.type)}
          </p>
        </div>

        <div className={styles.alertBody}>
          <h2 id="latest-alert-title" className={styles.alertTitle}>
            {a.title}
          </h2>
          <p id="latest-alert-message" className={styles.alertMessage}>
            {a.message}
          </p>
          <p className={styles.alertMeta}>
            {authorLabel(a)}
            <br />
            {formatDate(a.created_at)}
          </p>
        </div>

        <div className={styles.alertButtons}>
          <button
            type="button"
            ref={viewRef}
            className={`${styles.alertButton} ${styles.alertPrimary}`}
            onClick={onView}
          >
            View
          </button>
        </div>
      </div>
    </div>
  )
}

function Announcements() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  /* May "Post to" na pagpipilian (sariling org / lahat / pinili) */
  const audience = canPostToAllOrgs(profile, can) ? 'choose' : 'own'

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

  /* ---------- POP-UP NG PINAKABAGO (itsura lang) ----------
     Isang beses lumalabas bawat pagbukas ng page, pagkatapos
     makuha ang listahan. Wala nang "Show alert" na button
     para ipakita ulit. */
  const latest = announcements[0] ?? null
  const [alertOpen, setAlertOpen] = useState(false)
  const alertShown = useRef(false)
  const latestRef = useRef(null)
  const [latestFlash, setLatestFlash] = useState(false)

  useEffect(() => {
    if (loading || alertShown.current || !latest) return
    alertShown.current = true
    setAlertOpen(true)
  }, [loading, latest])

  const closeAlert = useCallback(() => setAlertOpen(false), [])

  const viewLatest = useCallback(() => {
    setAlertOpen(false)
    latestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setLatestFlash(true)
  }, [])

  /* Patayin ang highlight ng Latest card pagkatapos ng animation */
  useEffect(() => {
    if (!latestFlash) return undefined
    const timer = setTimeout(() => setLatestFlash(false), 1600)
    return () => clearTimeout(timer)
  }, [latestFlash])

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

  /* Isang announcement — pareho ang laman ng Latest at ng nasa
     "Earlier"; ibang itsura lang (featured = navy na card). */
  function renderCard(a, { featured = false } = {}) {
    const manageable = canManageAnnouncement(a, profile)
    const busy = deletingId === a.id
    const audienceKind = audienceOf(a)

    return (
      <article
        ref={featured ? latestRef : undefined}
        className={[
          styles.card,
          styles[`card_${a.type}`] ?? '',
          featured ? styles.featured : '',
          featured && latestFlash ? styles.flash : '',
        ].join(' ')}
      >
        <div className={styles.cardTop}>
          <span className={styles.typeIcon}>
            <TypeIcon type={a.type} size={featured ? 22 : 20} />
          </span>

          <span className={styles.badges}>
            {featured && <span className={`${styles.type} ${styles.latestPill}`}>Latest</span>}
            <span className={`${styles.type} ${styles[`type_${a.type}`] ?? ''}`}>
              {typeLabel(a.type)}
            </span>
            {audienceKind === 'all' && (
              <span className={`${styles.type} ${styles.global}`}>
                <Globe size={12} strokeWidth={2.6} aria-hidden="true" />
                All organizations
              </span>
            )}
            {audienceKind === 'selected' && (
              <span className={`${styles.type} ${styles.global}`}>
                <Building2 size={12} strokeWidth={2.6} aria-hidden="true" />
                Selected organizations
              </span>
            )}
          </span>

          <time className={styles.date} dateTime={a.created_at}>
            <Clock size={13} strokeWidth={2.4} aria-hidden="true" />
            <span>
              {formatDate(a.created_at)}
              {wasEdited(a) && (
                <span className={styles.edited} title={`Edited on ${formatDate(a.updated_at)}`}>
                  {' '}· edited
                </span>
              )}
            </span>
          </time>
        </div>

        <h2 className={styles.title}>{a.title}</h2>
        {audienceKind === 'selected' && (
          <p className={styles.audience}>To: {selectedOrgsLabel(a)}</p>
        )}
        <p className={styles.message}>{a.message}</p>

        <div className={styles.cardBottom}>
          <p className={styles.author}>
            <span className={styles.authorAvatar} aria-hidden="true">
              {(a.author_name ?? '?').trim().charAt(0).toUpperCase() || '?'}
            </span>
            {authorLabel(a)}
          </p>

          {manageable && (
            <div className={styles.cardActions}>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.danger}`}
                onClick={() => handleDelete(a)}
                disabled={busy}
              >
                <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </article>
    )
  }

  const earlier = announcements.slice(1)

  return (
    <div className={styles.page}>
      <PageHeader
        title="Announcements"
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
        />
      )}

      {!loading && !error && announcements.length > 0 && (
        <div className={styles.feed}>
          {/* ---------- PINAKABAGO ---------- */}
          {renderCard(latest, { featured: true })}

          {/* ---------- ANG IBA ---------- */}
          {earlier.length > 0 && (
            <section className={styles.earlier} aria-labelledby="earlier-heading">
              <h2 id="earlier-heading" className={styles.sectionTitle}>
                Earlier
                <span className={styles.sectionCount}>{earlier.length}</span>
              </h2>

              <ul className={styles.list}>
                {earlier.map((a) => (
                  <li key={a.id}>{renderCard(a)}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Pop-up ng pinakabago — hindi kasabay ng form */}
      {alertOpen && latest && !editing && (
        <LatestAlert announcement={latest} onClose={closeAlert} onView={viewLatest} />
      )}

      {editing && (
        <AnnouncementForm
          initial={editing === 'new' ? null : editing}
          audience={audience}
          ownOrgId={profile?.organization_id}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}
    </div>
  )
}

export default Announcements