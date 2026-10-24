import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import {
  computeStatus,
  eventStatusLabel,
  fetchCalendarEvents,
  formatEventDate,
  formatTime,
  nowKey,
} from '../lib/events.js'
import styles from './DashboardCalendar.module.css'

/* ============================================================
   DASHBOARD CALENDAR — Event Calendar sa Dashboard
   (Member, Officer, Adviser — calendar: true sa config/roles.js)

   May laman na: events ng LAHAT ng organisasyon, hindi lang ng
   sarili mong org. Galing sa function na calendar_events() sa
   Supabase (DASHBOARD_CALENDAR_ALL_ORGS.sql) — pang-calendar na
   detalye lang ang kasama: title, petsa, oras, lugar, at org.

   Paano gumagana:
     1. Kapag lumipat ng buwan, kinukuha ang events ng 42 araw
        na nakikita sa calendar (kasama ang dulo/simula ng
        katabing buwan).
     2. Sa bawat araw, hanggang 2 event ang ipinapakita; ang
        sobra ay "+N more".
     3. I-click ang araw para makita sa ilalim ang buong listahan
        ng events nito.

   Kulay: bawat org, KASAMA ang sarili mong org, ay kumukuha sa
   ORG_COLORS — pareho sa Landing calendar. Walang "(your org)"
   na label; ang is_own_org ay ginagamit lang para mauna ang
   sariling org sa legend at para sa "View in Events →" link
   (sariling org lang ang makikita sa Events page dahil sa RLS).
   ============================================================ */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* Laging 6 na linggo (42 araw) para hindi gumagalaw ang taas
   ng calendar kada buwan. */
const TOTAL_CELLS = 42

/* Ilang event ang kasya sa isang araw bago maging "+N more" */
const MAX_PER_DAY = 2

/* Kulay ng bawat org. Pareho ang kulay ng isang org kahit
   saang buwan (galing sa id niya). PALITAN kung gusto mo —
   pero palitan din ang ORG_COLORS sa
   components/landing/EventCalendar.jsx para pareho pa rin. */
const ORG_COLORS = [
  '#e8590c', '#2f9e44', '#9c36b5', '#d6336c',
  '#0c8599', '#f08c00', '#c92a2a', '#5f3dc4',
]

function orgColor(event) {
  let hash = 0
  for (const ch of event.organization_id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return ORG_COLORS[hash % ORG_COLORS.length]
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
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

/* eyebrow — maliit na label sa itaas ng buwan (hal. "Event Calendar"
   sa bento Dashboard ng Member, kung saan wala nang hiwalay na
   heading sa labas ng calendar). */
function DashboardCalendar({ eyebrow } = {}) {
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

    fetchCalendarEvents(rangeFrom, rangeTo)
      .then((rows) => {
        if (active) setEvents(rows)
      })
      .catch((err) => {
        console.error('Hindi makuha ang events ng calendar:', err)
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

  /* Mga org na may event sa BUWANG ito — para sa legend.
     Nauuna ang sariling org. */
  const legend = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    const seen = new Map()
    for (const event of events) {
      if (!event.event_date.startsWith(monthPrefix)) continue
      if (!seen.has(event.organization_id)) seen.set(event.organization_id, event)
    }
    return [...seen.values()].sort(
      (a, b) =>
        Number(b.is_own_org) - Number(a.is_own_org) ||
        a.organization_name.localeCompare(b.organization_name),
    )
  }, [events, year, month])

  const now = nowKey()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : []

  function changeMonth(offset) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    setSelectedKey(null)
  }

  function goToToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(todayKey)
  }

  return (
    <div className={styles.calendar}>
      {/* ---------- HEADER: buwan + navigation ---------- */}
      <div className={styles.header}>
        <div>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h3 className={styles.monthTitle} aria-live="polite">
            {MONTHS[month]} <span>{year}</span>
          </h3>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={goToToday}
            disabled={isCurrentMonth && selectedKey === todayKey}
          >
            Today
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Calendar sa kaliwa, events ng napiling araw sa kanan.
          Kapag masikip (tablet/phone), bumababa ang events sa
          ilalim ng calendar — tingnan ang .body sa CSS. */}
      <div className={styles.body}>
        <div className={styles.month}>
          {/* ---------- MGA ARAW NG LINGGO ---------- */}
          <div className={styles.weekdays}>
            {WEEK_DAYS.map((day) => (
              <div key={day} className={styles.weekday}>
                <span className={styles.weekdayLong}>{day}</span>
                <span className={styles.weekdayShort} aria-hidden="true">
                  {day.charAt(0)}
                </span>
              </div>
            ))}
          </div>

          {/* ---------- MGA ARAW ---------- */}
          <div className={[styles.grid, loading ? styles.loading : ''].join(' ')}>
            {days.map(({ date, inMonth, key }) => {
              const isToday = sameDay(date, today)
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
                    isToday ? styles.today : '',
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
                          <span className={styles.dot} aria-hidden="true" />
                          <span className={styles.chipText}>{event.title}</span>
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

          {/* ---------- LEGEND: mga org na may event ngayong buwan ---------- */}
          {legend.length > 0 && (
            <ul className={styles.legend}>
              {legend.map((event) => (
                <li key={event.organization_id}>
                  <span className={styles.dot} style={{ '--org-color': orgColor(event) }} />
                  {event.organization_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- MGA EVENT NG NAPILING ARAW ---------- */}
        <div className={styles.agenda}>
          {error ? (
            <p className={styles.note}>{error}</p>
          ) : selectedKey ? (
            <div className={styles.details}>
              <div>
                <h4 className={styles.detailsTitle}>{formatEventDate(selectedKey)}</h4>
                {selectedEvents.length > 0 && (
                  <p className={styles.detailsCount}>
                    {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>

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
                          <span className={styles.detailsOrg}>
                            <span className={styles.dot} aria-hidden="true" />
                            {event.organization_name}
                          </span>
                          <span className={`${styles.status} ${styles[status]}`}>
                            {eventStatusLabel(status)}
                          </span>
                        </div>

                        <strong className={styles.detailsName}>{event.title}</strong>

                        <div className={styles.detailsMeta}>
                          <span>
                            <Clock size={14} aria-hidden="true" />
                            {formatTime(event.start_time)} – {formatTime(event.end_time)}
                          </span>
                          <span>
                            <MapPin size={14} aria-hidden="true" />
                            {event.location}
                          </span>
                        </div>

                        {event.is_own_org && (
                          <Link to="/events" className={styles.detailsLink}>
                            View in Events →
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            <p className={styles.note}>
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
  )
}

export default DashboardCalendar