import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import {
  EVENT_STATUSES,
  canJoinEvents,
  canViewParticipants,
  computeStatus,
  eventStatusLabel,
  fetchEvents,
  fetchMyJoinedEvents,
  fetchParticipantCounts,
  fetchParticipants,
  formatDateTimeShort,
  formatEventDate,
  formatTime,
  nowKey,
  participantLabel,
} from '../lib/events.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import styles from './Attendance.module.css'

/* ============================================================
   ATTENDANCE

   Member  → "Sinalihan ko" lang: mga event na SINALIHAN mo
             (galing sa "Join" sa Events).
   Officer → dalawang tab:
               "Sinalihan ko"         — gaya ng sa Member
               "Sasali bawat event"   — listahan ng sasali sa
                                        bawat event ng org
   Adviser → "Sasali bawat event" lang (hindi siya nagja-Join).

   Pagka-Join sa Events, dito dinadala ang user (tab na
   "Sinalihan ko"). Ang pag-alis sa event ay sa Events page.

   Ang listahan ng sasali ay DITO na lang makikita, hindi na sa
   Events. Ang RLS sa database ang totoong nagbabantay — Officer
   at Adviser lang ang nakakabasa ng buong listahan.

   Automatic ang status ng event (Upcoming/Ongoing/Completed),
   gaya ng sa Events page.
   ============================================================ */

const TAB_MINE = 'mine'
const TAB_PER_EVENT = 'per-event'

function Attendance() {
  const { profile } = useAuth()
  const location = useLocation()

  const joinable = canJoinEvents(profile)
  const viewer = canViewParticipants(profile)

  /* Kung galing sa Join, buksan ang "Sinalihan ko" */
  const [tab, setTab] = useState(() =>
    joinable && (!viewer || location.state?.joinedTitle) ? TAB_MINE : TAB_PER_EVENT,
  )

  const tabs = []
  if (joinable) tabs.push({ value: TAB_MINE, label: 'Sinalihan ko' })
  if (viewer) tabs.push({ value: TAB_PER_EVENT, label: 'Sasali bawat event' })

  if (tabs.length === 0) {
    return (
      <>
        <PageHeader title="Attendance" />
        <EmptyState
          icon="✓"
          title="Walang makikita dito"
          message="Para sa mga miyembro, officer at adviser ng organisasyon ang page na ito."
        />
      </>
    )
  }

  const subtitle =
    tab === TAB_MINE
      ? 'Mga event na sinalihan mo.'
      : 'Tingnan kung sino ang sasali sa bawat event ng organisasyon.'

  return (
    <>
      <PageHeader title="Attendance" subtitle={subtitle} />

      {tabs.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Attendance">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`${styles.tab} ${tab === t.value ? styles.tabActive : ''}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === TAB_MINE ? <MyJoinedEvents profile={profile} /> : <ParticipantsPerEvent />}
    </>
  )
}

/* Ongoing muna, tapos Upcoming (pinakamalapit una),
   tapos Completed (pinakabago una) */
const STATUS_ORDER = { ongoing: 0, upcoming: 1, completed: 2 }

function sortByStatus(list) {
  return [...list].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (byStatus !== 0) return byStatus
    const ka = `${a.event_date} ${a.start_time}`
    const kb = `${b.event_date} ${b.start_time}`
    return a.status === 'completed' ? kb.localeCompare(ka) : ka.localeCompare(kb)
  })
}

/* Oras ngayon sa Pilipinas — nag-a-update bawat 30 segundo */
function useNow() {
  const [now, setNow] = useState(() => nowKey())
  useEffect(() => {
    const timer = setInterval(() => setNow(nowKey()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function EventThumb({ event }) {
  return event.image_url ? (
    <img className={styles.thumb} src={event.image_url} alt="" loading="lazy" />
  ) : (
    <div className={styles.thumbPlaceholder} aria-hidden="true">
      ◆
    </div>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`] ?? ''}`}>
      {eventStatusLabel(status)}
    </span>
  )
}

/* ============================================================
   SINALIHAN KO — Member at Officer
   ============================================================ */
function MyJoinedEvents({ profile }) {
  const location = useLocation()
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /* Mensahe galing sa Events pagkatapos mag-Join */
  const [notice] = useState(() =>
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

  const now = useNow()
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

  const list = useMemo(
    () => sortByStatus(events.map((e) => ({ ...e, status: computeStatus(e, now) }))),
    [events, now],
  )

  const activeCount = list.filter((e) => e.status !== 'completed').length

  return (
    <>
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
              <li key={ev.id} className={`${styles.card} ${styles.row}`}>
                <EventThumb event={ev} />

                <div className={styles.main}>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>{ev.title}</h2>
                    <StatusBadge status={ev.status} />
                  </div>
                  <p className={styles.meta}>
                    {formatEventDate(ev.event_date)} · {formatTime(ev.start_time)} –{' '}
                    {formatTime(ev.end_time)}
                  </p>
                  <p className={styles.meta}>{ev.location}</p>
                  <p className={styles.joined}>Sumali ka noong {formatDateTimeShort(ev.joined_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/* ============================================================
   SASALI BAWAT EVENT — Officer at Adviser

   Lahat ng event ng org, may bilang ng sasali. Pindutin ang
   "Tingnan ang sasali" para buksan ang listahan ng event na
   iyon (kinukuha lang kapag binuksan).
   ============================================================ */
const FILTERS = [{ value: 'all', label: 'Lahat' }, ...EVENT_STATUSES]

function ParticipantsPerEvent() {
  const [events, setEvents] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  /* Mga event na nakabukas ang listahan */
  const [openIds, setOpenIds] = useState(() => new Set())

  const now = useNow()

  const load = useCallback(async () => {
    try {
      const [evs, c] = await Promise.all([fetchEvents(), fetchParticipantCounts()])
      setEvents(evs)
      setCounts(c)
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang attendance ng events:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const withStatus = useMemo(
    () => events.map((e) => ({ ...e, status: computeStatus(e, now) })),
    [events, now],
  )

  const filterCounts = useMemo(() => {
    const c = { all: withStatus.length, upcoming: 0, ongoing: 0, completed: 0 }
    withStatus.forEach((e) => {
      c[e.status] = (c[e.status] ?? 0) + 1
    })
    return c
  }, [withStatus])

  const visible = useMemo(
    () => sortByStatus(filter === 'all' ? withStatus : withStatus.filter((e) => e.status === filter)),
    [withStatus, filter],
  )

  const totalParticipants = useMemo(
    () => events.reduce((sum, e) => sum + (counts[e.id] ?? 0), 0),
    [events, counts],
  )

  function toggle(id) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <p className={styles.muted}>Kinukuha ang mga event…</p>

  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Hindi makuha ang attendance"
        message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
      />
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon="✓"
        title="Wala pang event"
        message="Kapag may event na ang organisasyon, dito makikita kung sino ang sasali sa bawat isa."
      />
    )
  }

  return (
    <>
      <p className={styles.summary}>
        <strong>{events.length}</strong> event · <strong>{totalParticipants}</strong> kabuuang
        sumali
      </p>

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
            <span className={styles.filterCount}>{filterCounts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={styles.muted}>Walang event na {eventStatusLabel(filter).toLowerCase()}.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((ev) => {
            const total = counts[ev.id] ?? 0
            const isOpen = openIds.has(ev.id)
            const isDone = ev.status === 'completed'

            return (
              <li key={ev.id} className={styles.card}>
                <div className={styles.row}>
                  <EventThumb event={ev} />

                  <div className={styles.main}>
                    <div className={styles.titleRow}>
                      <h2 className={styles.title}>{ev.title}</h2>
                      <StatusBadge status={ev.status} />
                    </div>
                    <p className={styles.meta}>
                      {formatEventDate(ev.event_date)} · {formatTime(ev.start_time)} –{' '}
                      {formatTime(ev.end_time)}
                    </p>
                    <p className={styles.meta}>{ev.location}</p>
                  </div>

                  <div className={styles.countBox}>
                    <span className={styles.countNum}>{total}</span>
                    <span className={styles.countLabel}>{isDone ? 'sumali' : 'sasali'}</span>
                  </div>
                </div>

                {total > 0 && (
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={isOpen}
                    onClick={() => toggle(ev.id)}
                  >
                    {isOpen ? 'Itago ang listahan ▴' : 'Tingnan ang sasali ▾'}
                  </button>
                )}

                {isOpen && <ParticipantList eventId={ev.id} />}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function ParticipantList({ eventId }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchParticipants(eventId)
      .then((data) => {
        if (active) setList(data)
      })
      .catch((err) => {
        console.error('Hindi makuha ang listahan ng sasali:', err)
        if (active) setError('Hindi makuha ang listahan. Subukan ulit.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [eventId])

  if (loading) return <p className={styles.panelMuted}>Kinukuha ang listahan…</p>
  if (error) return <p className={styles.panelError}>{error}</p>
  if (list.length === 0) return <p className={styles.panelMuted}>Wala pang sumasali.</p>

  return (
    <ol className={styles.people}>
      {list.map((p, i) => {
        const { name, role } = participantLabel(p)
        return (
          <li key={p.profile_id} className={styles.person}>
            <span className={styles.num}>{i + 1}</span>
            <span className={styles.name}>{name}</span>
            <span className={styles.role}>{role}</span>
            <span className={styles.when}>{formatDateTimeShort(p.joined_at)}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default Attendance