import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import {
  computeStatus,
  eventStatusLabel,
  fetchPublicCalendarEvents,
  formatEventDate,
  formatTime,
  nowKey,
} from '../../lib/events.js'
import styles from './EventCalendar.module.css'

/* ============================================================
   EVENT CALENDAR (dating landing/Calendar.jsx)
   Pinalitan ang pangalan para hindi malito sa pages/Events.jsx.

   May laman na: events ng LAHAT ng aktibong organisasyon, tulad
   ng DashboardCalendar ng Member, Officer at Adviser. Galing sa
   public_calendar_events() sa Supabase
   (LANDING_CALENDAR_PUBLIC.sql) — pang-calendar na detalye lang:
   title, petsa, oras, lugar, at org. Walang description,
   picture, o author.

   Paano gumagana (pareho ng Dashboard):
     1. Kapag lumipat ng buwan, kinukuha ang events ng 42 araw
        na nakikita sa calendar.
     2. Sa bawat araw, hanggang 2 event ang ipinapakita; ang
        sobra ay "+N more". Sa phone: tuldok lang.
     3. I-click ang araw para makita sa ilalim ang buong listahan
        ng events nito.

   Kulay: bawat org ay may sariling kulay (ORG_COLORS), at ang
   "ORGANIZATIONS" sa kaliwa ang legend — mga org na may event
   sa buwang nakikita.
   ============================================================ */

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/* Ang buong calendar ay para sa naka-login (Events page),
   kaya sa Login dinadala ang button. */
const FULL_CALENDAR_LINK = '/login'

/* Laging 6 na linggo (42 araw) para hindi gumagalaw ang taas
   ng calendar kada buwan. */
const TOTAL_CELLS = 42

/* Ilang event ang kasya sa isang araw bago maging "+N more" */
const MAX_PER_DAY = 2

/* Kulay ng bawat org. Pareho ang kulay ng isang org kahit saang
   buwan (galing sa id niya). KAPAREHO ng ORG_COLORS sa
   components/DashboardCalendar.jsx, para iisa ang kulay ng org
   sa landing at sa Dashboard. */
const ORG_COLORS = [
  '#e8590c', '#2f9e44', '#9c36b5', '#d6336c',
  '#0c8599', '#f08c00', '#c92a2a', '#5f3dc4',
]

function orgColor(event) {
  let hash = 0
  for (const ch of event.organization_id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return ORG_COLORS[hash % ORG_COLORS.length]
}

/* Date → "2026-10-20" (lokal na petsa, para tugma sa event_date) */
function toYmd(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/* Bumubuo ng 42 na araw: dulo ng nakaraang buwan, buong
   kasalukuyang buwan, at simula ng susunod na buwan. */
function buildCalendarDays(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const start = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: TOTAL_CELLS }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date, inMonth: date.getMonth() === month, key: toYmd(date) }
  })
}

function EventCalendar() {
  const today = new Date()
  const todayKey = toYmd(today)

  // Laging unang araw ng buwan ang naka-save — sapat na iyon
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedKey, setSelectedKey] = useState(todayKey)

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const days = useMemo(() => buildCalendarDays(year, month), [year, month])

  const rangeFrom = days[0].key
  const rangeTo = days[TOTAL_CELLS - 1].key

  /* ---------- kunin ang events ng 42 araw na nakikita ---------- */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchPublicCalendarEvents(rangeFrom, rangeTo)
      .then((rows) => {
        if (active) setEvents(rows)
      })
      .catch((err) => {
        console.error('Hindi makuha ang events ng landing calendar:', err)
        if (active) {
          setEvents([])
          setError('Could not load events. Please try again later.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [rangeFrom, rangeTo])

  /* "2026-10-20" → [mga event ng araw na iyon] */
  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      const list = map.get(event.event_date) ?? []
      list.push(event)
      map.set(event.event_date, list)
    }
    return map
  }, [events])

  /* Mga org na may event sa BUWANG ito — para sa legend */
  const legend = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    const seen = new Map()
    for (const event of events) {
      if (!event.event_date.startsWith(monthPrefix)) continue
      if (!seen.has(event.organization_id)) seen.set(event.organization_id, event)
    }
    return [...seen.values()].sort((a, b) =>
      a.organization_name.localeCompare(b.organization_name),
    )
  }, [events, year, month])

  const now = nowKey()
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : []

  const changeMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    setSelectedKey(null)
  }

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

          {/* ---------- LEGEND: mga org na may event ngayong buwan ---------- */}
          <div className={styles.categories}>
            <h3>ORGANIZATIONS</h3>
            <div className={styles.categoryLine} />

            {legend.length > 0 ? (
              legend.map((event) => (
                <div key={event.organization_id} className={styles.category}>
                  <span
                    className={styles.categoryDot}
                    style={{ backgroundColor: orgColor(event) }}
                  />
                  <span>{event.organization_name}</span>
                </div>
              ))
            ) : (
              <p className={styles.legendEmpty}>
                {loading ? 'Loading…' : 'No events this month.'}
              </p>
            )}
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

          <div className={`${styles.grid} ${loading ? styles.gridLoading : ''}`}>
            {days.map(({ date, inMonth, key }) => {
              const dayEvents = eventsByDay.get(key) ?? []
              const shown = dayEvents.slice(0, MAX_PER_DAY)
              const extra = dayEvents.length - shown.length

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  aria-pressed={selectedKey === key}
                  aria-label={`${formatEventDate(key)}, ${dayEvents.length} event${
                    dayEvents.length === 1 ? '' : 's'
                  }`}
                  className={[
                    styles.day,
                    inMonth ? '' : styles.outsideMonth,
                    key === todayKey ? styles.today : '',
                    selectedKey === key ? styles.selected : '',
                  ].join(' ')}
                >
                  <span className={styles.dayNumber}>{date.getDate()}</span>

                  {dayEvents.length > 0 && (
                    <span className={styles.dayEvents}>
                      {shown.map((event) => (
                        <span
                          key={event.id}
                          className={[
                            styles.chip,
                            computeStatus(event, now) === 'completed' ? styles.past : '',
                          ].join(' ')}
                          style={{ '--org-color': orgColor(event) }}
                          title={`${event.title} — ${event.organization_name}`}
                        >
                          {event.title}
                        </span>
                      ))}
                      {extra > 0 && <span className={styles.more}>+{extra} more</span>}

                      {/* Sa phone: tuldok lang, dahil masikip */}
                      <span className={styles.dots} aria-hidden="true">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={styles.dot}
                            style={{ '--org-color': orgColor(event) }}
                          />
                        ))}
                      </span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ---------- MGA EVENT NG NAPILING ARAW ---------- */}
          <div className={styles.details}>
            {error ? (
              <p className={styles.detailsEmpty}>{error}</p>
            ) : selectedKey ? (
              <>
                <h3 className={styles.detailsTitle}>{formatEventDate(selectedKey)}</h3>

                {selectedEvents.length === 0 ? (
                  <p className={styles.detailsEmpty}>
                    {loading ? 'Loading events…' : 'No events on this day.'}
                  </p>
                ) : (
                  <ul className={styles.detailsList}>
                    {selectedEvents.map((event) => {
                      const status = computeStatus(event, now)
                      return (
                        <li
                          key={event.id}
                          className={styles.detailsItem}
                          style={{ '--org-color': orgColor(event) }}
                        >
                          <div className={styles.detailsHead}>
                            <strong>{event.title}</strong>
                            <span className={`${styles.status} ${styles[status] ?? ''}`}>
                              {eventStatusLabel(status)}
                            </span>
                          </div>
                          <div className={styles.detailsOrg}>{event.organization_name}</div>
                          <div className={styles.detailsMeta}>
                            <span>
                              <Clock size={15} aria-hidden="true" />
                              {formatTime(event.start_time)} – {formatTime(event.end_time)}
                            </span>
                            <span>
                              <MapPin size={15} aria-hidden="true" />
                              {event.location}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            ) : (
              <p className={styles.detailsEmpty}>
                {loading
                  ? 'Loading events…'
                  : legend.length === 0
                    ? 'No events this month.'
                    : 'Click a day to see its events.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default EventCalendar
