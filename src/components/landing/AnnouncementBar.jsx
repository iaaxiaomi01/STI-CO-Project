import { Bell } from 'lucide-react'
import styles from './AnnouncementBar.module.css'

/* PALITAN: ang pinakabagong announcement.
   Kapag may announcements table ka na para sa public, dito
   mo ito kukunin (hal. mula sa lib/announcements.js). */
const LATEST_ANNOUNCEMENT = 'General Assembly this coming May 10, 2026 at 1:00 PM.'

function AnnouncementBar() {
  return (
    <section id="announcements" className={styles.section}>
      <div className={styles.bar}>
        <div className={styles.icon}>
          <Bell size={22} className={styles.bell} />
        </div>

        <div className={styles.title}>LATEST ANNOUNCEMENT</div>

        <span className={styles.badge}>NEW</span>

        {/* Tumatakbong teksto (marquee) */}
        <div className={styles.message}>
          <span>{LATEST_ANNOUNCEMENT}</span>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.note}>Don&apos;t miss out!</div>
      </div>
    </section>
  )
}

export default AnnouncementBar
