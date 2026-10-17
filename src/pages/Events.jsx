import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  EVENT_STATUSES,
  MISSED_STATUS,
  authorLabel,
  canJoinEvents,
  canDeleteEvent,
  canEditEvent,
  computeStatus,
  deleteEvent,
  eventErrorMessage,
  eventStatusLabel,
  fetchEvents,
  fetchMyJoinedEventIds,
  formatEventDate,
  formatTime,
  joinEvent,
  nowKey,
  updateEvent,
  wasEdited,
} from '../lib/events.js'
import { PHASE_CLOSED, attendancePhase, fetchMyAttendance } from '../lib/attendance.js'
import {
  canManageCertificates,
  downloadCertificate,
  fetchMyCertificates,
} from '../lib/certificates.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import EventForm from '../components/EventForm.jsx'
import JoinConfirmDialog from '../components/JoinConfirmDialog.jsx'
import CertificatesDialog from '../components/CertificatesDialog.jsx'
import styles from './Events.module.css'

/* ============================================================
   EVENTS — TOTOONG DATA mula sa public.events

   Saan galing ang event:
     Officer nagpasa ng proposal → Adviser nag-Approve →
     ang NAGPASA ang gumagawa ng event (sa Proposals page).
     Kaya walang "+ Gumawa ng Event" dito.

   Member  → nakikita ang events ng org niya
   Officer → nakikita lahat; nag-e-edit ng SARILI niyang gawa,
             pero HINDI na ito mabubura kapag nagawa na
   Adviser → nakikita lahat; nag-e-edit/nagbubura ng LAHAT sa org

   I-EDIT: nawawala ang button 30 minuto bago magsimula ang
   event (kusa, dahil sa "now" na nire-refresh bawat 30 segundo).
   Hinaharang din ito ng database (EVENT_EDIT_LOCK.sql).

   Ang Status (Upcoming/Ongoing/Completed) ay AUTOMATIC —
   kinukuwenta mula sa Date at oras, at nire-refresh bawat
   30 segundo habang bukas ang page.

   MISSED (Member at Officer): kapag Completed na ang event at
   HINDI siya nag-Join, "Missed" ang ipinapakita imbes na "Completed",
   at may sarili itong tab. Display lang ito — walang
   binabago sa database.

   JOIN:
     Member at Officer → may "Join" habang hindi
                          pa tapos ang event. Pagka-Join,
                          lilipat sa Attendance tab.
     Walang bilang ng sasali dito para sa kahit anong role.
     Ang bilang at buong listahan ng sasali bawat event ay
     nasa Attendance page (Officer at Adviser).

   CERTIFICATE (EVENT_CERTIFICATES.sql):
     Officer at Adviser → "Certificates" sa event na tapos na.
                          Bubukas ang drop box: tig-isang file
                          para sa bawat nakakumpleto (may Time In
                          at Time Out).
     Member at Officer  → sa event na sinalihan at tapos na:
                          "I-download ang Certificate" kapag
                          meron na, o paalala kung wala pa.

   Ang RLS sa database ang totoong nagbabantay. Ang
   canEditEvent() at canDeleteEvent() dito ay para lang itago
   ang mga button.
   ============================================================ */

/* Ongoing muna, tapos Upcoming (pinakamalapit una),
   tapos Completed at Missed (pinakabago una) */
const STATUS_ORDER = { ongoing: 0, upcoming: 1, completed: 2, missed: 2 }

function sortEvents(list) {
  return [...list].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (byStatus !== 0) return byStatus
    const ka = `${a.event_date} ${a.start_time}`
    const kb = `${b.event_date} ${b.start_time}`
    return STATUS_ORDER[a.status] === 2 ? kb.localeCompare(ka) : ka.localeCompare(kb)
  })
}

const FILTERS = [{ value: 'all', label: 'Lahat' }, ...EVENT_STATUSES]

/* Member at Officer: may dagdag na tab na "Missed" */
const MEMBER_FILTERS = [...FILTERS, MISSED_STATUS]

function isFinished(status) {
  return status === 'completed' || status === MISSED_STATUS.value
}

function Events() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')

  /* Search: title, description, lugar, petsa at gumawa */
  const [search, setSearch] = useState('')

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

  /* Mga event na nakabukas ang buong description */
  const [expanded, setExpanded] = useState(() => new Set())

  /* ---------- JOIN ---------- */
  const joinable = canJoinEvents(profile)

  /* Mga event_id na sinalihan mo */
  const [joinedIds, setJoinedIds] = useState(() => new Set())

  /* Nakuha na ba ang mga sinalihan mo? Habang hindi pa (o kung
     pumalya), walang "Missed" — para hindi magmukhang lahat ay
     na-miss mo sa unang segundo. */
  const [joinedLoaded, setJoinedLoaded] = useState(false)

  /* "Missed" — Member at Officer (sila ang nagja-Join) */
  const showMissed = profile?.role_id === 1 || profile?.role_id === 2
  const filters = showMissed ? MEMBER_FILTERS : FILTERS

  /* Ang mga event, may kinuwentang status.
     Member/Officer: Completed + hindi nag-Join → Missed */
  const withStatus = useMemo(
    () =>
      events.map((e) => {
        let status = computeStatus(e, now)
        if (showMissed && joinedLoaded && status === 'completed' && !joinedIds.has(e.id)) {
          status = MISSED_STATUS.value
        }
        return { ...e, status }
      }),
    [events, now, showMissed, joinedLoaded, joinedIds],
  )
  const [joiningId, setJoiningId] = useState(null)

  /* ---------- CERTIFICATE ---------- */

  /* Sariling attendance at certificate → { [event_id]: row }.
     Para sa Member at Officer (sila ang nagja-Join). */
  const [myAttendance, setMyAttendance] = useState({})
  const [myCerts, setMyCerts] = useState({})
  const [certsLoaded, setCertsLoaded] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  /* Aling event ang nasa Certificates dialog (Officer at Adviser) */
  const [certEvent, setCertEvent] = useState(null)

  /* Aling event ang nasa "Sasali ka ba?" na dialog */
  const [confirmingJoin, setConfirmingJoin] = useState(null)

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
       pumalya ang pagkuha ng mga sinalihan mo */
    if (!profileId) return
    try {
      setJoinedIds(await fetchMyJoinedEventIds(profileId))
      setJoinedLoaded(true)
    } catch (err) {
      console.error('Hindi makuha ang mga sinalihan mo:', err)
    }

    /* Sariling attendance at certificate (Member at Officer).
       Hiwalay din, para hindi madamay ang listahan kapag pumalya. */
    if (!joinable) return
    try {
      const [attendance, certs] = await Promise.all([
        fetchMyAttendance(profileId),
        fetchMyCertificates(profileId),
      ])
      setMyAttendance(attendance)
      setMyCerts(certs)
      setCertsLoaded(true)
    } catch (err) {
      console.error('Hindi makuha ang certificate mo:', err)
    }
  }, [profileId, joinable])

  async function handleDownloadCertificate(event) {
    const cert = myCerts[event.id]
    if (!cert) return
    setNotice('')
    setDownloadingId(event.id)
    try {
      await downloadCertificate(cert)
    } catch (err) {
      console.error('Hindi ma-download ang certificate:', err)
      setNotice('Hindi ma-download ang certificate. Subukan ulit.')
    } finally {
      setDownloadingId(null)
    }
  }

  const closeCertificates = useCallback(() => setCertEvent(null), [])

  /* "Join" → bubuksan muna ang JoinConfirmDialog. Doon pa lang
     talagang sasali, pagkapindot ng "Oo, mag-Join". */
  function openJoin(event) {
    setNotice('')
    setConfirmingJoin(event)
  }

  /* Galing sa JoinConfirmDialog. Kapag nag-throw, doon lalabas
     ang error at mananatiling bukas ang dialog.

     WALANG "Umalis": kapag nakasali na, hindi na makakaalis
     (hinaharang din ng database — EVENT_JOIN_NO_LEAVE.sql). */
  async function handleJoin() {
    const event = confirmingJoin
    setJoiningId(event.id)
    try {
      await joinEvent(event.id)
    } catch (err) {
      setJoiningId(null)
      throw err
    }
    /* Pagka-Join, lipat sa Attendance kung saan nakalista
       ang mga sinalihan mong event */
    navigate('/attendance', { state: { joinedTitle: event.title } })
  }

  const closeJoin = useCallback(() => setConfirmingJoin(null), [])

  useEffect(() => {
    load()
  }, [load])

  const closeForm = useCallback(() => setEditing(null), [])

  /* Mga event na tumutugma sa search (lahat kapag blangko).
     Hindi mahalaga ang malaki o maliit na titik. */
  const query = search.trim().toLowerCase()
  const matched = useMemo(() => {
    if (!query) return withStatus
    return withStatus.filter((e) =>
      [
        e.title,
        e.description,
        e.location,
        e.author_name,
        e.event_date,
        formatEventDate(e.event_date),
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query)),
    )
  }, [withStatus, query])

  /* Ang bilang sa bawat tab ay ayon sa search */
  const counts = useMemo(() => {
    const c = { all: matched.length, upcoming: 0, ongoing: 0, completed: 0, missed: 0 }
    matched.forEach((e) => {
      c[e.status] = (c[e.status] ?? 0) + 1
    })
    return c
  }, [matched])

  const visible = useMemo(
    () => sortEvents(filter === 'all' ? matched : matched.filter((e) => e.status === filter)),
    [matched, filter],
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

          {/* ---------- SEARCH ---------- */}
          <div className={styles.searchBar}>
            <input
              type="search"
              className={styles.search}
              placeholder="Hanapin ang event, lugar, petsa, o gumawa…"
              aria-label="Hanapin ang event"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {query && (
              <span className={styles.searchCount}>
                {matched.length} sa {withStatus.length}
              </span>
            )}
          </div>

          <div className={styles.filters} role="tablist" aria-label="Salain ayon sa status">
            {filters.map((f) => (
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
              {query ? (
                <>
                  Walang event
                  {filter !== 'all' && ` na ${eventStatusLabel(filter).toLowerCase()}`} na
                  tumutugma sa &ldquo;{search.trim()}&rdquo;.{' '}
                  <button type="button" className={styles.clearSearch} onClick={() => setSearch('')}>
                    I-clear ang search
                  </button>
                </>
              ) : (
                `Walang event na ${eventStatusLabel(filter).toLowerCase()}.`
              )}
            </p>
          ) : (
            <ul className={styles.list}>
              {visible.map((ev) => {
                const editable = canEditEvent(ev, profile, now)
                const deletable = canDeleteEvent(ev, profile)
                const busy = deletingId === ev.id
                const isOpen = expanded.has(ev.id)
                const longText = ev.description.length > 280
                const joined = joinedIds.has(ev.id)
                const isDone = isFinished(ev.status)
                const missed = ev.status === MISSED_STATUS.value
                const joinBusy = joiningId === ev.id
                /* May Join, "Nakasali ka" o "Hindi ka nakasali" na ipapakita */
                const hasJoinAction = joinable && (joined || !isDone || missed)

                /* Certificate: drop box para sa Officer/Adviser ng org,
                   at status ng sariling certificate para sa sumali */
                const manageCerts = isDone && canManageCertificates(ev, profile)
                const showCertStatus = joinable && joined && isDone && certsLoaded
                const myCert = myCerts[ev.id]
                const completedMine = Boolean(myAttendance[ev.id]?.time_out)
                const attendanceClosed = attendancePhase(ev, now) === PHASE_CLOSED
                const certBusy = downloadingId === ev.id

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
                      {hasJoinAction && (
                        <div className={styles.joinRow}>
                          {joinable && !isDone && !joined && (
                            <button
                              type="button"
                              className={styles.joinButton}
                              onClick={() => openJoin(ev)}
                              disabled={joinBusy}
                            >
                              {joinBusy ? 'Sumasali…' : 'Join'}
                            </button>
                          )}

                          {joinable && joined && (
                            <span className={styles.joinedGroup}>
                              <span className={styles.joinedBadge}>✓ Nakasali ka</span>
                            </span>
                          )}

                          {/* ---------- CERTIFICATE MO ---------- */}
                          {showCertStatus &&
                            (myCert ? (
                              <button
                                type="button"
                                className={styles.certButton}
                                onClick={() => handleDownloadCertificate(ev)}
                                disabled={certBusy}
                              >
                                <span aria-hidden="true">⤓</span>{' '}
                                {certBusy ? 'Binubuksan…' : 'I-download ang Certificate'}
                              </button>
                            ) : completedMine ? (
                              <span className={styles.certNote}>
                                Kumpleto ang attendance mo. Wala pang certificate — ilalagay ito ng
                                Officer o Adviser.
                              </span>
                            ) : attendanceClosed ? (
                              <span className={styles.certNoteMuted}>
                                Walang certificate — hindi kumpleto ang Time In at Time Out mo.
                              </span>
                            ) : null)}

                          {missed && (
                            <span className={styles.missedNote}>
                              Natapos ang event nang hindi ka nakasali.
                            </span>
                          )}
                        </div>
                      )}

                      <div className={styles.footer}>
                        <p className={styles.author}>
                          {authorLabel(ev)}
                          {wasEdited(ev) && <span className={styles.edited}> · na-edit</span>}
                        </p>

                        {(editable || deletable || manageCerts) && (
                          <div className={styles.actions}>
                            {manageCerts && (
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => {
                                  setNotice('')
                                  setCertEvent(ev)
                                }}
                                disabled={busy}
                              >
                                Certificates
                              </button>
                            )}
                            {editable && (
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
                            )}
                            {deletable && (
                              <button
                                type="button"
                                className={`${styles.linkButton} ${styles.danger}`}
                                onClick={() => handleDelete(ev)}
                                disabled={busy}
                              >
                                {busy ? 'Binubura…' : 'Burahin'}
                              </button>
                            )}
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

      {certEvent && <CertificatesDialog event={certEvent} onClose={closeCertificates} />}

      {confirmingJoin && (
        <JoinConfirmDialog event={confirmingJoin} onConfirm={handleJoin} onCancel={closeJoin} />
      )}
    </>
  )
}

export default Events