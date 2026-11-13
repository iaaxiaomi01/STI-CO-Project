import { useEffect, useRef } from 'react'
import { Building2, CalendarDays, Clock, MapPin, Pencil, User, Users, X } from 'lucide-react'
import {
  authorLabel,
  endDateOf,
  eventStatusLabel,
  formatDateTimeShort,
  formatEventDateRange,
  formatEventTimeRange,
  isMultiDay,
  orgNameOf,
  wasEdited,
} from '../lib/events.js'
import { OgAmount, OgGem } from './OgGem.jsx'
import styles from './EventDetailsDialog.module.css'

/* ============================================================
   EVENT DETAILS DIALOG — kumpletong detalye ng isang event

   Para sa SAO at School Head sa Events page ("View details").
   Basa lang —
   walang button na nagbabago ng kahit ano.

   Laman:
     larawan (kung meron), status, organisasyon, title,
     petsa (Start/End Date), oras, lugar, OG reward,
     bilang ng sumali, gumawa, kailan ginawa, kailan huling
     binago, at ang buong description.

   ITSURA — "event ticket", kapamilya ng ticket sa Events page:
     - ulo: larawan (o asul na banda kung wala), status at org
     - title, tapos ang STUB ng petsa (kulay ayon sa status,
       pareho sa ticket) katabi ng Date / Time / Location
     - punit na linya (perforation)
     - OG reward at bilang ng sumali, description, at kung
       sino ang gumawa / kailan binago

   Props:
     event        — event na may kinuwentang "status"
                    (galing sa withStatus sa Events.jsx)
     reward       — row ng event_og_rewards, o null
     participants — bilang ng sumali (number), o null kung
                    hindi pa nakuha / pumalya
     onClose      — isasara ang dialog
   ============================================================ */

/* "2026-10-07" → { day: '07', month: 'OCT 2026', weekday: 'Wednesday' }
   Para sa malaking petsa sa stub. Display lang. */
function dateParts(ymd) {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    day: String(d).padStart(2, '0'),
    month: `${date.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase()} ${y}`,
    weekday: date.toLocaleDateString('en-PH', { weekday: 'long' }),
  }
}

/* Maraming araw → "to Sun, Nov 22" sa ilalim ng Start Date */
function untilLabel(event) {
  const [y, m, d] = endDateOf(event).split('-').map(Number)
  return `to ${new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`
}

function EventDetailsDialog({ event, reward = null, participants = null, onClose }) {
  const closeRef = useRef(null)
  const orgName = orgNameOf(event)
  const multiDay = isMultiDay(event)
  const date = dateParts(event.event_date)
  const statusClass = styles[event.status] ?? ''

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <article
        className={`${styles.modal} ${statusClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
      >
        {/* ---------- ULO: larawan (o banda), status, org ---------- */}
        <header className={`${styles.hero} ${event.image_url ? styles.heroPoster : styles.heroPlain}`}>
          {event.image_url && <img className={styles.heroImg} src={event.image_url} alt="" />}

          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.4} />
          </button>

          <div className={styles.heroBar}>
            <span className={styles.status}>
              {event.status === 'ongoing' && <span className={styles.liveDot} aria-hidden="true" />}
              {eventStatusLabel(event.status)}
            </span>
            {orgName && (
              <span className={styles.org}>
                <Building2 size={14} strokeWidth={2.4} aria-hidden="true" />
                {orgName}
              </span>
            )}
          </div>
        </header>

        {/* ---------- TITLE + STUB + DATE / TIME / LOCATION ---------- */}
        <div className={styles.body}>
          <p className={styles.eyebrow}>Event details</p>
          <h2 id="event-details-title" className={styles.title}>
            {event.title}
          </h2>

          <div className={styles.ticket}>
            {date && (
              <div className={styles.stub} aria-hidden="true">
                <span className={styles.stubDay}>{date.day}</span>
                <span className={styles.stubMeta}>
                  <span className={styles.stubMonth}>{date.month}</span>
                  <span className={styles.stubWeekday}>
                    {multiDay ? untilLabel(event) : date.weekday}
                  </span>
                </span>
              </div>
            )}

            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>
                  <CalendarDays size={15} strokeWidth={2.3} aria-hidden="true" />
                  {multiDay ? 'Dates' : 'Date'}
                </dt>
                <dd>{formatEventDateRange(event)}</dd>
              </div>
              <div className={styles.fact}>
                <dt>
                  <Clock size={15} strokeWidth={2.3} aria-hidden="true" />
                  Time
                </dt>
                <dd>{formatEventTimeRange(event)}</dd>
              </div>
              <div className={styles.fact}>
                <dt>
                  <MapPin size={15} strokeWidth={2.3} aria-hidden="true" />
                  Location
                </dt>
                <dd>{event.location}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ---------- PERFORATION ---------- */}
        <div className={styles.perforation} aria-hidden="true">
          <span className={styles.notchLeft} />
          <span className={styles.notchRight} />
        </div>

        <div className={styles.bottom}>
          {/* ---------- OG REWARD + SUMALI ---------- */}
          <dl className={styles.stats}>
            <div className={`${styles.stat} ${reward ? styles.statOg : ''}`}>
              <dt>
                <span className={styles.statIcon}>
                  <OgGem size={16} />
                </span>
                OG reward
              </dt>
              <dd>
                {reward ? (
                  <>
                    <OgAmount value={reward.amount} size={16} />
                    <small>Time In and Time Out required</small>
                  </>
                ) : (
                  <span className={styles.muted}>None</span>
                )}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>
                <span className={styles.statIcon}>
                  <Users size={16} strokeWidth={2.4} aria-hidden="true" />
                </span>
                Participants
              </dt>
              <dd>
                {participants === null ? (
                  <span className={styles.muted}>—</span>
                ) : (
                  <>
                    <strong className={styles.statNum}>
                      {participants.toLocaleString('en-PH')}
                    </strong>
                    <small>joined</small>
                  </>
                )}
              </dd>
            </div>
          </dl>

          {/* ---------- DESCRIPTION ---------- */}
          <section className={styles.about}>
            <h3>Description</h3>
            <p>{event.description}</p>
          </section>

          {/* ---------- GUMAWA / BINAGO ---------- */}
          <dl className={styles.meta}>
            <div>
              <dt>
                <User size={14} strokeWidth={2.4} aria-hidden="true" />
                Created by
              </dt>
              <dd>
                {authorLabel(event)}
                <span className={styles.when}>{formatDateTimeShort(event.created_at)}</span>
              </dd>
            </div>
            {wasEdited(event) && (
              <div>
                <dt>
                  <Pencil size={14} strokeWidth={2.4} aria-hidden="true" />
                  Last edited
                </dt>
                <dd>{formatDateTimeShort(event.updated_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      </article>
    </div>
  )
}

export default EventDetailsDialog