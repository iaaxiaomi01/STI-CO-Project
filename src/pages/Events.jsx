import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  EVENT_STATUSES,
  authorLabel,
  canJoinEvents,
  canManageEvent,
  canViewParticipants,
  computeStatus,
  deleteEvent,
  eventErrorMessage,
  eventStatusLabel,
  fetchEvents,
  fetchMyJoinedEventIds,
  fetchParticipantCounts,
  formatEventDate,
  formatTime,
  joinErrorMessage,
  joinEvent,
  leaveEvent,
  nowKey,
  updateEvent,
  wasEdited,
} from '../lib/events.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import EventForm from '../components/EventForm.jsx'
import ParticipantsDialog from '../components/ParticipantsDialog.jsx'
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

   Ang Status (Upcoming/Ongoing/Completed) ay AUTOMATIC —
   kinukuwenta mula sa Date at oras, at nire-refresh bawat
   30 segundo habang bukas ang page.

   JOIN:
     Member at Officer → may "Join" / "Umalis" habang hindi
                          pa tapos ang event. Pagka-Join,
                          lilipat sa Attendance tab.
     Lahat              → nakikita ang BILANG ng sasali
     Officer at Adviser → "Tingnan ang sasali" (buong listahan)

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

  /* Oras ngayon sa Pilipinas — nag-a-update bawat 30 segundo
     para kusang lumipat ang status habang bukas ang page */
  const [now, setNow] = useState(() => nowKey())

  useEffect(() => {
    const timer = setInterval(() => setNow(nowKey()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])

  /* Ang mga event, may kinuwentang status */
  const withStatus = useMemo(
    () => events.map((e) => ({ ...e, status: computeStatus(e, now) })),
    [events, now],
  )

  /* Mga event na nakabukas ang buong description */
  const [expanded, setExpanded] = useState(() => new Set())

  /* ---------- JOIN ---------- */
  const joinable = canJoinEvents(profile)
  const showParticipants = canViewParticipants(profile)

  /* Mga event_id na sinalihan mo, at bilang ng sasali bawat event */
  const [joinedIds, setJoinedIds] = useState(() => new Set())
  const [participantCounts, setParticipantCounts] = useState({})
  const [joiningId, setJoiningId] = useState(null)

  /* Ang event na tinitingnan ang listahan ng sasali */
  const [viewingParticipants, setViewingParticipants] = useState(null)
  const closeParticipants = useCallback(() => setViewingParticipants(null), [])

  const profileId = profile?.id
  const navigate = useNavigate()

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

    /* Hiwalay para hindi masira ang listahan ng events kung
       pumalya ang pagkuha ng sasali */
    try {
      const [counts, mine] = await Promise.all([
        fetchParticipantCounts(),
        profileId ? fetchMyJoinedEventIds(profileId) : Promise.resolve(new Set()),
      ])
      setParticipantCounts(counts)
      setJoinedIds(mine)
    } catch (err) {
      console.error('Hindi makuha ang mga sasali:', err)
    }
  }, [profileId])

  async function handleJoin(event) {
    setNotice('')
    setJoiningId(event.id)
    try {
      await joinEvent(event.id)
      /* Pagka-Join, lipat sa Attendance kung saan nakalista
         ang mga sinalihan mong event */
      navigate('/attendance', { state: { joinedTitle: event.title } })
    } catch (err) {
      console.error('Hindi nakasali:', err)
      setNotice(joinErrorMessage(err))
      setJoiningId(null)
    }
  }

  async function handleLeave(event) {
    if (!window.confirm(`Umalis sa "${event.title}"?`)) return

    setNotice('')
    setJoiningId(event.id)
    try {
      await leaveEvent(event.id, profileId)
      setJoinedIds((current) => {
        const next = new Set(current)
        next.delete(event.id)
        return next
      })
      setParticipantCounts((c) => ({ ...c, [event.id]: Math.max(0, (c[event.id] ?? 1) - 1) }))
      setNotice(`Umalis ka na sa "${event.title}".`)
    } catch (err) {
      console.error('Hindi nakaalis:', err)
      setNotice(joinErrorMessage(err))
    } finally {
      setJoiningId(null)
    }
  }

  useEffect(() => {
    load()
  }, [load])

  const closeForm = useCallback(() => setEditing(null), [])

  const counts = useMemo(() => {
    const c = { all: withStatus.length, upcoming: 0, ongoing: 0, completed: 0 }
    withStatus.forEach((e) => {
      c[e.status] = (c[e.status] ?? 0) + 1
    })
    return c
  }, [withStatus])

  const visible = useMemo(
    () =>
      sortEvents(filter === 'all' ? withStatus : withStatus.filter((e) => e.status === filter)),
    [withStatus, filter],
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
                const joined = joinedIds.has(ev.id)
                const total = participantCounts[ev.id] ?? 0
                const isDone = ev.status === 'completed'
                const joinBusy = joiningId === ev.id

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

                      {/* ---------- JOIN ---------- */}
                      <div className={styles.joinRow}>
                        <span className={styles.joinCount}>
                          {total === 0
                            ? 'Wala pang sumasali'
                            : `${total} ${isDone ? 'ang sumali' : 'ang sasali'}`}
                        </span>

                        {showParticipants && total > 0 && (
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => setViewingParticipants(ev)}
                          >
                            Tingnan ang sasali
                          </button>
                        )}

                        {joinable && !isDone && !joined && (
                          <button
                            type="button"
                            className={styles.joinButton}
                            onClick={() => handleJoin(ev)}
                            disabled={joinBusy}
                          >
                            {joinBusy ? 'Sumasali…' : 'Join'}
                          </button>
                        )}

                        {joinable && joined && (
                          <span className={styles.joinedGroup}>
                            <span className={styles.joinedBadge}>✓ Nakasali ka</span>
                            {!isDone && (
                              <button
                                type="button"
                                className={`${styles.linkButton} ${styles.danger}`}
                                onClick={() => handleLeave(ev)}
                                disabled={joinBusy}
                              >
                                {joinBusy ? 'Sandali…' : 'Umalis'}
                              </button>
                            )}
                          </span>
                        )}
                      </div>

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

      {viewingParticipants && (
        <ParticipantsDialog event={viewingParticipants} onClose={closeParticipants} />
      )}

      {editing && <EventForm initial={editing} onSubmit={handleUpdate} onCancel={closeForm} />}
    </>
  )
}

export default Events
