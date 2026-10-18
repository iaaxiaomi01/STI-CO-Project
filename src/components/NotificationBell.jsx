import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import {
  NOTIFICATION_LIMIT,
  countUnreadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  timeAgo,
} from '../lib/notifications.js'
import styles from './NotificationBell.module.css'

/* ============================================================
   NOTIFICATION BELL — REALTIME

   Galing ang laman sa public.notifications (EVENT_NOTIFICATIONS.sql).
   Ang database ang gumagawa ng notification kapag may bagong
   event; dito ay ipinapakita lang at minamarkahang nabasa.

   REALTIME: nakikinig ang bell sa Supabase Realtime. Kapag may
   bagong notification:
     - tataas agad ang bilang sa pulang badge
     - kakalembang sandali ang bell
     - lalabas sandali ang maliit na paalala sa ilalim nito
   Walang refresh na kailangan.

   Kapag pinindot ang isang notification: mamarkahang nabasa,
   at dadalhin ka sa link nito (hal. /events).
   ============================================================ */

/* Ilang segundo bago kusang mawala ang maliit na paalala */
const TOAST_SECONDS = 6

const TYPE_ICON = {
  event_new: '◆',
}

function NotificationBell() {
  const { profile } = useAuth()
  const profileId = profile?.id
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* Kalembang ng bell at ang maliit na paalala */
  const [ringing, setRinging] = useState(false)
  const [toast, setToast] = useState(null)

  /* Para sa "5 minuto na" — nire-refresh bawat minuto */
  const [now, setNow] = useState(() => Date.now())

  const wrapRef = useRef(null)

  const reload = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([fetchNotifications(), countUnreadNotifications()])
      setItems(list)
      setUnreadCount(count)
      setError('')
    } catch (err) {
      console.error('Hindi makuha ang notifications:', err)
      setError('Hindi makuha ang notifications. Subukan ulit.')
    } finally {
      setLoading(false)
    }
  }, [])

  /* ---------- REALTIME ----------
     Ang unang pagkuha ng listahan ay sa onReconnect din — kaya
     kapag nawalan ng internet at bumalik, kukunin ulit ang
     listahan at walang makaligtaan. */
  useEffect(() => {
    if (!profileId) return undefined

    const unsubscribe = subscribeToNotifications(profileId, {
      onReconnect: reload,
      onInsert: (row) => {
        setItems((list) =>
          [row, ...list.filter((n) => n.id !== row.id)].slice(0, NOTIFICATION_LIMIT),
        )
        if (!row.read_at) setUnreadCount((c) => c + 1)
        setNow(Date.now())
        setRinging(true)
        setToast(row)
      },
    })

    return unsubscribe
  }, [profileId, reload])

  /* Ihinto ang kalembang pagkalipas ng animation */
  useEffect(() => {
    if (!ringing) return undefined
    const timer = setTimeout(() => setRinging(false), 1200)
    return () => clearTimeout(timer)
  }, [ringing])

  /* Kusang mawawala ang paalala */
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), TOAST_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  /* Sasara ang panel kapag pumindot sa labas o pinindot ang Esc */
  useEffect(() => {
    if (!open) return undefined

    function handleClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function togglePanel() {
    setToast(null)
    /* Pagbukas: kunin ulit para sariwa (hal. may nabura nang event) */
    if (!open) {
      setNow(Date.now())
      reload()
    }
    setOpen(!open)
  }

  /* Nabasa na: binabago agad ang itsura, tapos sinasabi sa database */
  function markLocal(id) {
    setItems((list) =>
      list.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  async function openNotification(n) {
    setOpen(false)
    setToast(null)
    if (!n.read_at) {
      markLocal(n.id)
      markNotificationRead(n.id).catch((err) => {
        console.error('Hindi namarkahang nabasa:', err)
      })
    }
    if (n.link) navigate(n.link)
  }

  async function handleMarkAll() {
    const stamp = new Date().toISOString()
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: stamp })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch (err) {
      console.error('Hindi namarkahang nabasa lahat:', err)
      reload()
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.bell} ${open ? styles.bellActive : ''} ${ringing ? styles.ring : ''}`}
        onClick={togglePanel}
        aria-label={
          unreadCount > 0 ? `Mga notification, ${unreadCount} ang hindi pa nababasa` : 'Mga notification'
        }
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* ---------- MALIIT NA PAALALA (bagong notification) ---------- */}
      {toast && !open && (
        <button
          type="button"
          className={styles.toast}
          onClick={() => openNotification(toast)}
          role="status"
        >
          <span className={styles.toastLabel}>Bagong notification</span>
          <span className={styles.toastTitle}>{toast.title}</span>
          {toast.body && <span className={styles.toastBody}>{toast.body}</span>}
        </button>
      )}

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Mga notification">
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>Mga Notification</p>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAll} onClick={handleMarkAll}>
                Markahang nabasa lahat
              </button>
            )}
          </div>

          {loading && items.length === 0 ? (
            <p className={styles.status}>Kinukuha ang notifications…</p>
          ) : error && items.length === 0 ? (
            <p className={`${styles.status} ${styles.statusError}`}>{error}</p>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                🔔
              </span>
              <p className={styles.emptyTitle}>Wala pang notification</p>
              <p className={styles.emptyText}>Dito lalabas ang mga bagong event.</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${n.read_at ? '' : styles.unread}`}
                    onClick={() => openNotification(n)}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      {TYPE_ICON[n.type] ?? '•'}
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      {n.body && <span className={styles.itemBody}>{n.body}</span>}
                      <span className={styles.itemTime}>{timeAgo(n.created_at, now)}</span>
                    </span>
                    {!n.read_at && <span className={styles.dot} aria-label="Hindi pa nababasa" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
