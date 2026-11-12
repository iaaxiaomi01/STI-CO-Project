import { useEffect, useRef } from 'react'
import {
  Building2,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  User,
  Users,
  X,
} from 'lucide-react'
import {
  authorLabel,
  eventStatusLabel,
  formatDateTimeShort,
  formatEventDateRange,
  formatEventTimeRange,
  isMultiDay,
  orgNameOf,
  wasEdited,
} from '../lib/events.js'
import { OgAmount, OgGem } from './OgGem.jsx'
import base from './ProposalForm.module.css'
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

   Props:
     event        — event na may kinuwentang "status"
                    (galing sa withStatus sa Events.jsx)
     reward       — row ng event_og_rewards, o null
     participants — bilang ng sumali (number), o null kung
                    hindi pa nakuha / pumalya
     onClose      — isasara ang dialog
   ============================================================ */
function EventDetailsDialog({ event, reward = null, participants = null, onClose }) {
  const closeRef = useRef(null)
  const orgName = orgNameOf(event)
  const multiDay = isMultiDay(event)

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
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} strokeWidth={2.4} />
        </button>

        {/* ---------- LARAWAN ---------- */}
        {event.image_url && (
          <div className={styles.poster}>
            <img src={event.image_url} alt="" />
          </div>
        )}

        {/* ---------- ULO: status + org + title ---------- */}
        <div className={styles.head}>
          <span className={`${styles.status} ${styles[event.status] ?? ''}`}>
            {eventStatusLabel(event.status)}
          </span>
          {orgName && (
            <p className={styles.org}>
              <Building2 size={15} aria-hidden="true" />
              {orgName}
            </p>
          )}
          <h2 id="event-details-title" className={styles.title}>
            {event.title}
          </h2>
        </div>

        {/* ---------- DETALYE ---------- */}
        <dl className={styles.facts}>
          <div>
            <dt>
              <CalendarDays size={15} aria-hidden="true" />
              {multiDay ? 'Dates' : 'Date'}
            </dt>
            <dd>{formatEventDateRange(event)}</dd>
          </div>
          <div>
            <dt>
              <Clock size={15} aria-hidden="true" />
              Time
            </dt>
            <dd>{formatEventTimeRange(event)}</dd>
          </div>
          <div>
            <dt>
              <MapPin size={15} aria-hidden="true" />
              Location
            </dt>
            <dd>{event.location}</dd>
          </div>
          <div>
            <dt>
              <OgGem size={15} />
              OG reward
            </dt>
            <dd>
              {reward ? (
                <span className={styles.og}>
                  <OgAmount value={reward.amount} size={15} />
                  <small>Time In and Time Out required</small>
                </span>
              ) : (
                <span className={styles.muted}>None</span>
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Users size={15} aria-hidden="true" />
              Participants
            </dt>
            <dd>
              {participants === null ? (
                <span className={styles.muted}>—</span>
              ) : (
                `${participants.toLocaleString('en-PH')} joined`
              )}
            </dd>
          </div>
          <div>
            <dt>
              <User size={15} aria-hidden="true" />
              Created by
            </dt>
            <dd>
              {authorLabel(event)}
              <small className={styles.when}>{formatDateTimeShort(event.created_at)}</small>
            </dd>
          </div>
          {wasEdited(event) && (
            <div>
              <dt>
                <Pencil size={15} aria-hidden="true" />
                Last edited
              </dt>
              <dd>{formatDateTimeShort(event.updated_at)}</dd>
            </div>
          )}
        </dl>

        {/* ---------- DESCRIPTION ---------- */}
        <section className={styles.about}>
          <h3>Description</h3>
          <p>{event.description}</p>
        </section>
      </div>
    </div>
  )
}

export default EventDetailsDialog