import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './EventCalendar.module.css'

/* ============================================================
   EVENT CALENDAR (dating landing/Calendar.jsx)
   Pinalitan ang pangalan para hindi malito sa pages/Events.jsx.
   ============================================================ */

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/* PALITAN: mga kategorya at kulay nila */
const CATEGORIES = [
  { key: 'shs', label: 'SHS (Senior High School)', color: '#ff536b' },
  { key: 'hospitality', label: 'Hospitality Management', color: '#43b84a' },
  { key: 'it', label: 'Information Technology', color: '#216ce4' },
  { key: 'accounting', label: 'Accountancy, Business and Management', color: '#9a70e8' },
  { key: 'education', label: 'Education', color: '#ff9417' },
  { key: 'general', label: 'General / Others', color: '#b8bec8' },
]

/* Ang buong calendar ay para sa naka-login (Events page),
   kaya sa Login dinadala ang button. */
const FULL_CALENDAR_LINK = '/login'

/* Laging 6 na linggo (42 araw) para hindi gumagalaw ang taas
   ng calendar kada buwan. */
const TOTAL_CELLS = 42

function buildCalendarDays(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPreviousMonth = new Date(year, month, 0).getDate()

  const days = []

  // Huling araw ng nakaraang buwan
  for (let i = firstWeekday - 1; i >= 0; i--) {
    days.push({ day: daysInPreviousMonth - i, inMonth: false, key: `p${i}` })
  }

  // Kasalukuyang buwan
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({ day, inMonth: true, key: `c${day}` })
  }

  // Unang araw ng susunod na buwan
  for (let day = 1; days.length < TOTAL_CELLS; day++) {
    days.push({ day, inMonth: false, key: `n${day}` })
  }

  return days
}

function EventCalendar() {
  // Laging unang araw ng buwan ang naka-save — sapat na iyon
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const changeMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const calendarDays = buildCalendarDays(year, month)

  return (
    <section id="calendar" className={styles.section}>
      <div className={styles.inner}>
        {/* ---------- LEFT INFORMATION PANEL ---------- */}
        <aside className={styles.info}>
          <div className={styles.heading}>
            <div className={styles.headingIcon}>
              <CalendarDays size={38} />
            </div>

            <div className={styles.headingText}>
              <span>EVENT</span>
              <h2>CALENDAR</h2>
            </div>
          </div>

          <p className={styles.description}>
            Stay updated with upcoming events and activities.
          </p>

          {/* Illustration (CSS lang, walang larawan) */}
          <div className={styles.illustration} aria-hidden="true">
            <div className={styles.illustrationCalendar}>
              <div className={styles.illustrationTop} />
              <div className={styles.illustrationGrid}>
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>

            <div className={styles.illustrationClock}>
              <span />
            </div>
          </div>

          <div className={styles.categories}>
            <h3>EVENT CATEGORIES</h3>
            <div className={styles.categoryLine} />

            {CATEGORIES.map((category) => (
              <div key={category.key} className={styles.category}>
                <span
                  className={styles.categoryDot}
                  style={{ backgroundColor: category.color }}
                />
                <span>{category.label}</span>
              </div>
            ))}
          </div>

          <Link to={FULL_CALENDAR_LINK} className={styles.fullCalendarBtn}>
            <CalendarDays size={24} />
            <span>VIEW FULL CALENDAR</span>
            <ChevronRight size={22} />
          </Link>
        </aside>

        {/* ---------- CALENDAR PANEL ---------- */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={32} />
            </button>

            <h2 aria-live="polite">
              {MONTHS[month]} <span>{year}</span>
            </h2>

            <button
              type="button"
              className={styles.navBtn}
              onClick={() => changeMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={32} />
            </button>
          </div>

          <div className={styles.weekdays}>
            {WEEK_DAYS.map((day) => (
              <div key={day} className={styles.weekday}>
                {day}
              </div>
            ))}
          </div>

          <div className={styles.grid}>
            {calendarDays.map((date) => (
              <div
                key={date.key}
                className={`${styles.day} ${date.inMonth ? '' : styles.outsideMonth}`}
              >
                <span className={styles.dayNumber}>{date.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default EventCalendar
