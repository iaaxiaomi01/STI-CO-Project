import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  EVENT_STATUSES,
  authorLabel,
  canManageEvent,
  deleteEvent,
  eventErrorMessage,
  eventStatusLabel,
  fetchEvents,
  formatEventDate,
  formatTime,
  updateEvent,
  wasEdited,
} from '../lib/events.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import EventForm from '../components/EventForm.jsx'
import styles from './Events.module.css'

/* ============================================================
   EVENTS — TOTOONG DATA mula sa public.events

   Saan galing ang event:
     Officer nagpasa ng proposal → Adviser nag-Approve →
     ang NAGPASA ang gumagawa ng event (sa Proposals page).
     Kaya walang "+ Gumawa ng Event" dito.

   Member  → nakikita ang events ng org niya
   Officer → nakikita lahat; nag-e-edit/nagbubura ng SARILI niyang gawa
   Adviser → nakikita lahat; nag-e-edit/nagbubura ng LAHAT sa org

   Ang Status (Upcoming/Ongoing/Completed) ay binabago ng
   gumawa o ng Adviser sa "I-edit".

   Ang RLS sa database ang totoong nagbabantay. Ang
   canManageEvent() dito ay para lang itago ang mga button.
   ============================================================ */

/* Ongoing muna, tapos Upcoming (pinakamalapit una),
   tapos Completed (pinakabago una) */
const STATUS_ORDER = { ongoing: 0, upcoming: 1, completed: 2 }

function sortEvents(list) {
  return [...list].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (byStatus !== 0) return byStatus
    const ka = `${a.event_date} ${a.start_time}`
    const kb = `${b.event_date} ${b.start_time}`
    return a.status === 'completed' ? kb.localeCompare(ka) : ka.localeCompare(kb)
  })
}

const FILTERS = [{ value: 'all', label: 'Lahat' }, ...EVENT_STATUSES]

function Events() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')

  /* Ang event na ine-edit (bukas ang form) */
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  /* Mga event na nakabukas ang buong description */
  const [expanded, setExpanded] = useState(() => new Set())

  const load = useCallback(async () => {
    try {
      setEvents(await fetchEvents())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang events:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const closeForm = useCallback(() => setEditing(null), [])

  const counts = useMemo(() => {
    const c = { all: events.length, upcoming: 0, ongoing: 0, completed: 0 }
    events.forEach((e) => {
      c[e.status] = (c[e.status] ?? 0) + 1
    })
    return c
  }, [events])

  const visible = useMemo(
    () => sortEvents(filter === 'all' ? events : events.filter((e) => e.status === filter)),
    [events, filter],
  )

  async function handleUpdate(values, imageOptions) {
    const updated = await updateEvent(editing, values, imageOptions)
    setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)))
    setEditing(null)
    setNotice('Na-save ang pagbabago.')
  }

  async function handleDelete(event) {
    const ok = window.confirm(`Burahin ang event na "${event.title}"? Hindi na ito maibabalik.`)
    if (!ok) return

    setNotice('')
    setDeletingId(event.id)
    try {
      await deleteEvent(event)
      setEvents((list) => list.filter((e) => e.id !== event.id))
      setNotice('Nabura ang event.')
    } catch (err) {
      console.error('Hindi nabura ang event:', err)
      setNotice(eventErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  function toggleExpanded(id) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  let subtitle = 'Mga aktibidad ng organisasyon.'
  if (can.propose) {
    subtitle = 'Ang event ay ginagawa mula sa approved mong proposal sa Proposals.'
  } else if (can.review) {
    subtitle = 'Mga event ng organisasyon. Pwede mong i-edit o burahin ang alinman dito.'
  }

  return (
    <>
      <PageHeader title="Events" subtitle={subtitle} />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.loading}>Kinukuha ang events…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang events"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && events.length === 0 && (
        <EmptyState
          icon="◆"
          title="Wala pang naka-schedule na event"
          message={
            can.propose
              ? 'Kapag na-approve ang proposal mo, pindutin ang "+ Gumawa ng Event" sa Proposals.'
              : 'Kapag may naidagdag nang event, dito ito lalabas kasama ang petsa, oras at lugar.'
          }
        />
      )}

      {!loading && !error && events.length > 0 && (
        <>
          {can.propose && (
            <p className={styles.hint}>
              May approved kang proposal?{' '}
              <Link to="/proposals">Pumunta sa Proposals</Link> para gawan ito ng event.
            </p>
          )}

          <div className={styles.filters} role="tablist" aria-label="Salain ayon sa status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className={`${styles.filter} ${filter === f.value ? styles.filterActive : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                <span className={styles.filterCount}>{counts[f.value] ?? 0}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className={styles.loading}>
              Walang event na {eventStatusLabel(filter).toLowerCase()}.
            </p>
          ) : (
            <ul className={styles.list}>
              {visible.map((ev) => {
                const manageable = canManageEvent(ev, profile)
                const busy = deletingId === ev.id
                const isOpen = expanded.has(ev.id)
                const longText = ev.description.length > 280

                return (
                  <li key={ev.id} className={styles.card}>
                    {ev.image_url ? (
                      <img className={styles.image} src={ev.image_url} alt="" loading="lazy" />
                    ) : (
                      <div className={styles.imagePlaceholder} aria-hidden="true">
                        ◆
                      </div>
                    )}

                    <div className={styles.body}>
                      <span className={`${styles.badge} ${styles[`badge_${ev.status}`] ?? ''}`}>
                        {eventStatusLabel(ev.status)}
                      </span>

                      <h2 className={styles.title}>{ev.title}</h2>

                      <dl className={styles.details}>
                        <div>
                          <dt>Petsa</dt>
                          <dd>{formatEventDate(ev.event_date)}</dd>
                        </div>
                        <div>
                          <dt>Oras</dt>
                          <dd>
                            {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                          </dd>
                        </div>
                        <div>
                          <dt>Lugar</dt>
                          <dd>{ev.location}</dd>
                        </div>
                      </dl>

                      <p
                        className={`${styles.description} ${
                          longText && !isOpen ? styles.clamped : ''
                        }`}
                      >
                        {ev.description}
                      </p>
                      {longText && (
                        <button
                          type="button"
                          className={styles.more}
                          onClick={() => toggleExpanded(ev.id)}
                        >
                          {isOpen ? 'Itago' : 'Magbasa pa'}
                        </button>
                      )}

                      <div className={styles.footer}>
                        <p className={styles.author}>
                          {authorLabel(ev)}
                          {wasEdited(ev) && <span className={styles.edited}> · na-edit</span>}
                        </p>

                        {manageable && (
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => {
                                setNotice('')
                                setEditing(ev)
                              }}
                              disabled={busy}
                            >
                              I-edit
                            </button>
                            <button
                              type="button"
                              className={`${styles.linkButton} ${styles.danger}`}
                              onClick={() => handleDelete(ev)}
                              disabled={busy}
                            >
                              {busy ? 'Binubura…' : 'Burahin'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {editing && <EventForm initial={editing} onSubmit={handleUpdate} onCancel={closeForm} />}
    </>
  )
}

export default Events
