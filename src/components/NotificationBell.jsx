import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  BadgeCheck,
  Bell,
  CalendarDays,
  Gem,
  Mail,
  Megaphone,
  Pencil,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import {
  NOTIFICATION_LIMIT,
  countUnreadNotifications,
  deleteAllNotifications,
  deleteNotification,
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
 
   MGA URI:
     event_new       → may bagong event (Member, Officer at
                       Adviser — ADVISER_EVENT_NOTIFICATIONS.sql)
     certificate_ready → available na (o napalitan) ang
                       certificate mo — CERTIFICATE_NOTIFICATIONS.sql.
                       Ang link ay /events?event=<id>, kaya dadalhin
                       ka sa mismong event card.
     proposal_update → nasaan na ang proposal mo (Officer na
                       nagpasa): approved, rejected, noted, o
                       ipina-revise — PROPOSAL_NOTIFICATIONS.sql
     proposal_review → may proposal na dumating sa stage mo
                       (Adviser, SAO, School Head) —
                       PROPOSAL_REVIEW_NOTIFICATIONS.sql
     og_update       → nakatanggap ka ng OG mula sa event, o
                       na-cancel ang redemption mo
                       — OG_REWARDS_SHOP.sql
 
   REALTIME: nakikinig ang bell sa Supabase Realtime. Kapag may
   bagong notification:
     - tataas agad ang bilang sa pulang badge
     - kakalembang sandali ang bell
     - lalabas sandali ang maliit na paalala sa ilalim nito
   Walang refresh na kailangan.
 
   Kapag pinindot ang isang notification: mamarkahang nabasa,
   at dadalhin ka sa link nito (hal. /events).
 
   PAGBURA (DELETE_NOTIFICATIONS.sql):
     - ang × sa kanan ng bawat notification → buburahin iyon lang
     - "Clear all" sa itaas → may "Sigurado ka?" muna, tapos
       buburahin lahat ng notification mo
   Nawawala agad sa listahan; kapag pumalya sa database, kukunin
   ulit ang listahan para bumalik ang tamang laman.
 
   DISENYO: light yellow na panel, puting card bawat notification,
   at light blue / navy na accent. Itsura lang ang nasa CSS —
   pareho ang laman at gawa.
   ============================================================ */
 
/* Ilang segundo bago kusang mawala ang maliit na paalala */
const TOAST_SECONDS = 6
 
/* Icon ng bawat uri (dating mga simbolo: ◆ ✉ ✎ ⤓ ★ ❖ ✦) */
const TYPE_ICON = {
  event_new: CalendarDays,
  proposal_update: Mail,
  proposal_review: Pencil,
  certificate_ready: Award,
  position_update: BadgeCheck,
  og_update: Gem,
  announcement_new: Megaphone,
}
 
function TypeIcon({ type }) {
  const Icon = TYPE_ICON[type] ?? Bell
  return <Icon size={17} strokeWidth={2.2} />
}
 
/* Kulay ng icon ayon sa "tone" ng notification (PROPOSAL_NOTIFICATIONS.sql):
   success = approved · danger = rejected · warning = ipina-revise */
function toneClass(n) {
  return styles[`tone_${n.tone}`] ?? ''
}
 
/* variant="onDark" — para sa madilim na background (hal. ang navy
   na pagbati sa bento Dashboard ng Member). Itsura lang ang iba. */
function NotificationBell({ variant } = {}) {
  const { profile } = useAuth()
  const profileId = profile?.id
  const navigate = useNavigate()
 
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
 
  /* "Clear all" — naghihintay ng kumpirmasyon */
  const [confirmClear, setConfirmClear] = useState(false)
 
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
      setError('Could not load notifications. Please try again.')
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
    setConfirmClear(false)
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
 
  /* Burahin ang isa: alisin agad sa listahan, tapos sa database */
  async function handleDelete(n) {
    const wasFull = items.length >= NOTIFICATION_LIMIT
    setItems((list) => list.filter((x) => x.id !== n.id))
    if (!n.read_at) setUnreadCount((c) => Math.max(0, c - 1))
    if (toast?.id === n.id) setToast(null)
 
    try {
      await deleteNotification(n.id)
      /* Puno ang panel kanina — kunin ulit para may pumalit
         mula sa mas lumang notifications */
      if (wasFull) reload()
    } catch (err) {
      console.error('Hindi nabura ang notification:', err)
      reload()
    }
  }
 
  /* Burahin lahat (pagkatapos ng "Sigurado ka?") */
  async function handleClearAll() {
    setConfirmClear(false)
    setItems([])
    setUnreadCount(0)
    setToast(null)
    try {
      await deleteAllNotifications()
    } catch (err) {
      console.error('Hindi nabura lahat ng notification:', err)
      reload()
    }
  }
 
  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.bell} ${variant === 'onDark' ? styles.onDark : ''} ${
          open ? styles.bellActive : ''
        } ${ringing ? styles.ring : ''}`}
        onClick={togglePanel}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
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
          className={`${styles.toast} ${toneClass(toast)}`}
          onClick={() => openNotification(toast)}
          role="status"
        >
          <span className={styles.toastLabel}>New notification</span>
          <span className={styles.toastTitle}>{toast.title}</span>
          {toast.body && <span className={styles.toastBody}>{toast.body}</span>}
        </button>
      )}
 
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>Notifications</p>
            {confirmClear ? (
              <div className={styles.headerActions}>
                <span className={styles.confirmText}>Delete all?</span>
                <button
                  type="button"
                  className={`${styles.markAll} ${styles.danger}`}
                  onClick={handleClearAll}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={styles.markAll}
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className={styles.headerActions}>
                {unreadCount > 0 && (
                  <button type="button" className={styles.markAll} onClick={handleMarkAll}>
                    Mark all as read
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    className={`${styles.markAll} ${styles.danger}`}
                    onClick={() => setConfirmClear(true)}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
 
          {loading && items.length === 0 ? (
            <p className={styles.status}>Loading notifications…</p>
          ) : error && items.length === 0 ? (
            <p className={`${styles.status} ${styles.statusError}`}>{error}</p>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Bell size={22} strokeWidth={2.2} />
              </span>
              <p className={styles.emptyTitle}>No notifications yet</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {items.map((n) => (
                <li key={n.id} className={styles.row}>
                  <button
                    type="button"
                    className={`${styles.item} ${n.read_at ? '' : styles.unread}`}
                    onClick={() => openNotification(n)}
                  >
                    <span className={`${styles.itemIcon} ${toneClass(n)}`} aria-hidden="true">
                      <TypeIcon type={n.type} />
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      {n.body && <span className={styles.itemBody}>{n.body}</span>}
                      <span className={styles.itemTime}>{timeAgo(n.created_at, now)}</span>
                    </span>
                    {!n.read_at && <span className={styles.dot} aria-label="Unread" />}
                  </button>
 
                  {/* Hiwalay na button (hindi puwedeng button sa loob ng button) */}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(n)}
                    aria-label={`Delete notification: ${n.title}`}
                    title="Delete"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
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