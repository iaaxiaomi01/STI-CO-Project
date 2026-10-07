import { useEffect, useRef, useState } from 'react'
import styles from './NotificationBell.module.css'

/* ============================================================
   NOTIFICATION BELL — UI LANG (wala pang function)

   Ngayon: bumubukas at sumasara lang ang panel, at laging
   "Wala pang notification" ang laman.

   KAPAG GAGAWIN NA ANG TOTOONG FUNCTION:
     1. Gumawa ng notifications table sa Supabase (+ RLS).
     2. Gumawa ng lib/notifications.js na kukuha ng listahan.
     3. Palitan ang NOTIFICATIONS sa ibaba ng totoong data,
        at ang unreadCount ng bilang ng hindi pa nababasa.
   ============================================================ */
const NOTIFICATIONS = []

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const unreadCount = 0 // placeholder — papalitan kapag may data na

  /* Sasara ang panel kapag pumindot sa labas o pinindot ang Esc */
  useEffect(() => {
    if (!open) return

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

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.bell} ${open ? styles.bellActive : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Mga notification"
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
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Mga notification">
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>Mga Notification</p>
          </div>

          {NOTIFICATIONS.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                🔔
              </span>
              <p className={styles.emptyTitle}>Wala pang notification</p>
              <p className={styles.emptyText}>
                Dito lalabas ang mga bagong event, announcement, at proposal.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
