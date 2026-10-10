import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './DashboardCalendar.module.css'

/* ============================================================
   DASHBOARD CALENDAR — Event Calendar sa Dashboard
   (Member, Officer, Adviser — calendar: true sa config/roles.js)

   UI LANG MUNA: walang data at walang logic sa events.
   Gumagana na ang paglipat ng buwan at naka-highlight ang
   araw ngayon, pero walang event na lumalabas.

   KAPAG IKOKONEKTA NA SA DATA:
     1. Kunin ang events ng buwang ito (hal. sa lib/events.js)
     2. Ipasa bilang prop: <DashboardCalendar events={events} />
     3. Sa bawat araw (cell), ipakita ang mga event na tugma
        ang petsa — may nakahanda nang lugar: .dayEvents
   ============================================================ */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* Laging 6 na linggo (42 araw) para hindi gumagalaw ang taas
   ng calendar kada buwan. */
const TOTAL_CELLS = 42

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/* Bumubuo ng 42 na araw: dulo ng nakaraang buwan, buong
   kasalukuyang buwan, at simula ng susunod na buwan. */
function buildCalendarDays(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const start = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: TOTAL_CELLS }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date, inMonth: date.getMonth() === month, key: date.toDateString() }
  })
}

function DashboardCalendar() {
  const today = new Date()

  // Laging unang araw ng buwan ang naka-save — sapat na iyon
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const days = buildCalendarDays(year, month)

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  function changeMonth(offset) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function goToToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  return (
    <div className={styles.calendar}>
      {/* ---------- HEADER: buwan + navigation ---------- */}
      <div className={styles.header}>
        <h3 className={styles.monthTitle} aria-live="polite">
          {MONTHS[month]} <span>{year}</span>
        </h3>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={goToToday}
            disabled={isCurrentMonth}
          >
            Ngayon
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => changeMonth(-1)}
            aria-label="Nakaraang buwan"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => changeMonth(1)}
            aria-label="Susunod na buwan"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* ---------- MGA ARAW NG LINGGO ---------- */}
      <div className={styles.weekdays}>
        {WEEK_DAYS.map((day) => (
          <div key={day} className={styles.weekday}>
            {day}
          </div>
        ))}
      </div>

      {/* ---------- MGA ARAW ---------- */}
      <div className={styles.grid}>
        {days.map(({ date, inMonth, key }) => {
          const isToday = sameDay(date, today)
          return (
            <div
              key={key}
              className={[
                styles.day,
                inMonth ? '' : styles.outsideMonth,
                isToday ? styles.today : '',
              ].join(' ')}
            >
              <span className={styles.dayNumber}>{date.getDate()}</span>
              {/* Dito ilalagay ang mga event ng araw na ito */}
              <div className={styles.dayEvents} />
            </div>
          )
        })}
      </div>

      <p className={styles.note}>Wala pang events na nakalagay sa calendar.</p>
    </div>
  )
}

export default DashboardCalendar
