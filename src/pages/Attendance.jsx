import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  canJoinEvents,
  computeStatus,
  eventStatusLabel,
  fetchMyJoinedEvents,
  formatDateTimeShort,
  formatEventDate,
  formatTime,
  joinErrorMessage,
  leaveEvent,
  nowKey,
} from '../lib/events.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import styles from './Attendance.module.css'

/* ============================================================
   ATTENDANCE

   Member at Officer → listahan ng mga event na SINALIHAN mo
                       (galing sa "Join" sa Events). Dito ka rin
                       dinadala pagkatapos mag-Join.
   Adviser           → placeholder pa (pagkuha ng attendance ng
                       buong organisasyon — susunod na gagawin).

   Automatic ang status ng event (Upcoming/Ongoing/Completed),
   gaya ng sa Events page.
   ============================================================ */
function Attendance() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  if (canJoinEvents(profile)) {
    return <MyJoinedEvents profile={profile} />
  }

  /* ---------- ADVISER (placeholder pa) ---------- */
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Kumuha at suriin ang pagdalo sa mga aktibidad."
        action={can.create && <ActionButton>+ Kumuha ng Attendance</ActionButton>}
      />

      <EmptyState
        icon="✓"
        title="Wala pang attendance record"
        message="Kapag may natapos nang event, dito lalabas ang talaan ng dumalo at hindi dumalo."
      />
    </>
  )
}

/* Ongoing muna, tapos Upcoming (pinakamalapit una),
   tapos Completed (pinakabago una) */
const STATUS_ORDER = { ongoing: 0, upcoming: 1, completed: 2 }

function MyJoinedEvents({ profile }) {
  const location = useLocation()
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [leavingId, setLeavingId] = useState(null)

  /* Mensahe galing sa Events pagkatapos mag-Join */
  const [notice, setNotice] = useState(() =>
    location.state?.joinedTitle
      ? `Sumali ka sa "${location.state.joinedTitle}". Nakalista na ito dito sa Attendance.`
      : '',
  )

  /* Alisin ang state sa URL para hindi na lumabas ulit ang
     mensahe kapag nag-refresh */
  useEffect(() => {
    if (location.state?.joinedTitle) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const [now, setNow] = useState(() => nowKey())
  useEffect(() => {
    const timer = setInterval(() => setNow(nowKey()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])

  const profileId = profile.id

  const load = useCallback(async () => {
    try {
      setEvents(await fetchMyJoinedEvents(profileId))
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang mga sinalihang event:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => {
    const withStatus = events.map((e) => ({ ...e, status: computeStatus(e, now) }))
    return withStatus.sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (byStatus !== 0) return byStatus
      const ka = `${a.event_date} ${a.start_time}`
      const kb = `${b.event_date} ${b.start_time}`
      return a.status === 'completed' ? kb.localeCompare(ka) : ka.localeCompare(kb)
    })
  }, [events, now])

  const activeCount = list.filter((e) => e.status !== 'completed').length

  async function handleLeave(event) {
    if (!window.confirm(`Umalis sa "${event.title}"?`)) return

    setNotice('')
    setLeavingId(event.id)
    try {
      await leaveEvent(event.id, profileId)
      setEvents((current) => current.filter((e) => e.id !== event.id))
      setNotice(`Umalis ka na sa "${event.title}".`)
    } catch (err) {
      console.error('Hindi nakaalis:', err)
      setNotice(joinErrorMessage(err))
    } finally {
      setLeavingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Mga event na sinalihan mo."
      />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.muted}>Kinukuha ang mga sinalihan mo…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang attendance"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon="✓"
          title="Wala ka pang sinalihang event"
          message='Pumunta sa Events at pindutin ang "Join" sa event na gusto mong salihan.'
        />
      )}

      {!loading && !error && list.length > 0 && (
        <>
          <p className={styles.summary}>
            <strong>{list.length}</strong> event ang sinalihan mo ·{' '}
            <strong>{activeCount}</strong> ang paparating o nagaganap ·{' '}
            <Link to="/events">Maghanap pa ng event →</Link>
          </p>

          <ul className={styles.list}>
            {list.map((ev) => (
              <li key={ev.id} className={styles.row}>
                {ev.image_url ? (
                  <img className={styles.thumb} src={ev.image_url} alt="" loading="lazy" />
                ) : (
                  <div className={styles.thumbPlaceholder} aria-hidden="true">
                    ◆
                  </div>
                )}

                <div className={styles.main}>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>{ev.title}</h2>
                    <span className={`${styles.badge} ${styles[`badge_${ev.status}`] ?? ''}`}>
                      {eventStatusLabel(ev.status)}
                    </span>
                  </div>
                  <p className={styles.meta}>
                    {formatEventDate(ev.event_date)} · {formatTime(ev.start_time)} –{' '}
                    {formatTime(ev.end_time)}
                  </p>
                  <p className={styles.meta}>{ev.location}</p>
                  <p className={styles.joined}>Sumali ka noong {formatDateTimeShort(ev.joined_at)}</p>
                </div>

                {ev.status !== 'completed' && (
                  <button
                    type="button"
                    className={styles.leave}
                    onClick={() => handleLeave(ev)}
                    disabled={leavingId === ev.id}
                  >
                    {leavingId === ev.id ? 'Sandali…' : 'Umalis'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export default Attendance
