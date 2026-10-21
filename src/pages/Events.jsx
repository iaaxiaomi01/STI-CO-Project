import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import {
  isCertificateNotification,
  isOgNotification,
  subscribeToNotifications,
} from '../lib/notifications.js'
import { fetchEventRewards, rewardFor } from '../lib/og.js'
import { OgAmount } from '../components/OgGem.jsx'
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

   NOTIFICATION NG CERTIFICATE (CERTIFICATE_NOTIFICATIONS.sql):
     Kapag na-upload ang certificate mo, may realtime notification
     ka. Kung bukas ang page na ito, lalabas agad ang
     "I-download ang Certificate" — walang refresh.
     Kapag pinindot ang notification → /events?event=<id>:
     ililipat sa tab na "Lahat", iki-clear ang search, at
     dadalhin ka sa mismong event card (sandaling naka-highlight).

   OG REWARD (OG_REWARDS_SHOP.sql — event_og_rewards):
     Member, Officer, Adviser → may "Reward" sa detalye ng event:
                          ilang OG ang buo (Time In + Time Out)
                          at kalahati (Time In lang).
     Adviser            → kapag wala pang reward: "None yet ·
                          Set in Rewards" (doon itinatakda).
     Member at Officer  → sa event na sinalihan at tapos na:
                          ilang OG ang natanggap mo, o ilang OG
                          ang matatanggap mo kapag na-release na
                          ng Officer. Kinukuwenta mula sa sariling
                          attendance gamit ang rewardFor() — pareho
                          ng og_reward_for() sa database.
     Kapag dumating ang "og_update" notification (na-release ang
     OG) habang bukas ang page → kukunin ulit ang mga reward.
     Basa lang ito; walang binabago sa database.

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

const FILTERS = [{ value: 'all', label: 'All' }, ...EVENT_STATUSES]

/* Member at Officer: may dagdag na tab na "Missed" */
const MEMBER_FILTERS = [...FILTERS, MISSED_STATUS]

function isFinished(status) {
  return status === 'completed' || status === MISSED_STATUS.value
}

/* Ilang OG ang sa iyo sa isang tapos na event na sinalihan mo.
   Pareho ng release_event_og(): may Time In → may OG;
   may Time Out din → buo, kung wala → kalahati.
   Ibinabalik: { tone: 'got' | 'pending' | 'none', text } o null */
function myOgStatus(reward, attendance, attendanceClosed) {
  const timedIn = Boolean(attendance?.time_in)
  const complete = Boolean(attendance?.time_out)
  const amount = timedIn ? rewardFor(reward.amount, complete) : 0
  const og = amount.toLocaleString('en-PH')
  const full = Number(reward.amount).toLocaleString('en-PH')

  if (reward.released_at) {
    return amount > 0
      ? { tone: 'got', text: `You received +${og} OG for this event.` }
      : { tone: 'none', text: 'No OG — you had no Time In for this event.' }
  }

  if (attendanceClosed) {
    return amount > 0
      ? { tone: 'pending', text: `You'll receive ${og} OG once an Officer releases it.` }
      : { tone: 'none', text: 'No OG — you had no Time In for this event.' }
  }

  /* Bukas pa ang attendance (hanggang 1 oras pagkatapos ng event) */
  if (complete) {
    return { tone: 'pending', text: `You'll receive ${og} OG once an Officer releases it.` }
  }
  if (timedIn) {
    return {
      tone: 'pending',
      text: `Time In only so far: ${og} OG. Time Out before attendance closes to get the full ${full} OG.`,
    }
  }
  return null
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

  /* ---------- OG REWARD ----------
     { [event_id]: row } mula sa event_og_rewards (sariling org, RLS).
     Hiwalay sa listahan ng events: kapag pumalya, walang Reward
     na lalabas pero gagana pa rin ang page. */
  const [rewards, setRewards] = useState({})
  const isAdviser = profile?.role_id === 3

  const loadRewards = useCallback(async () => {
    try {
      setRewards(await fetchEventRewards())
    } catch (err) {
      console.error('Hindi makuha ang OG reward ng events:', err)
    }
  }, [])

  const profileId = profile?.id
  const navigate = useNavigate()

  /* Galing sa notification ng certificate: /events?event=<id> */
  const [searchParams, setSearchParams] = useSearchParams()
  const focusParam = searchParams.get('event')

  /* Ang event card na sandaling naka-highlight */
  const [highlightId, setHighlightId] = useState(null)

  /* Sariling attendance at certificate (Member at Officer).
     Hiwalay, para hindi madamay ang listahan kapag pumalya.
     Tinatawag din kapag may bagong certificate notification. */
  const loadMyCertificates = useCallback(async () => {
    if (!profileId || !joinable) return
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

    loadRewards()

    /* Hiwalay para hindi masira ang listahan ng events kung
       pumalya ang pagkuha ng mga sinalihan mo */
    if (!profileId) return
    try {
      setJoinedIds(await fetchMyJoinedEventIds(profileId))
      setJoinedLoaded(true)
    } catch (err) {
      console.error('Hindi makuha ang mga sinalihan mo:', err)
    }

    await loadMyCertificates()
  }, [profileId, loadMyCertificates, loadRewards])

  async function handleDownloadCertificate(event) {
    const cert = myCerts[event.id]
    if (!cert) return
    setNotice('')
    setDownloadingId(event.id)
    try {
      await downloadCertificate(cert)
    } catch (err) {
      console.error('Hindi ma-download ang certificate:', err)
      setNotice('Could not download the certificate. Please try again.')
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

  /* REALTIME: may bagong certificate para sa iyo habang bukas
     ang page → kunin ulit para lumabas agad ang "I-download".
     Na-release ang OG mo → kunin ulit ang mga reward para
     lumabas agad ang "You received … OG". */
  useEffect(() => {
    if (!profileId || !joinable) return undefined
    return subscribeToNotifications(profileId, {
      onInsert: (row) => {
        if (isCertificateNotification(row)) loadMyCertificates()
        if (isOgNotification(row)) loadRewards()
      },
    })
  }, [profileId, joinable, loadMyCertificates, loadRewards])

  /* Galing sa notification: ipakita ang event card. Hinihintay
     munang matapos ang unang pagkuha ng events. */
  useEffect(() => {
    if (!focusParam || loading) return
    setFilter('all')
    setSearch('')
    setHighlightId(focusParam)
    setSearchParams({}, { replace: true })
    /* Sigurado: kunin ulit kahit may nakaligtaang realtime */
    loadMyCertificates()
  }, [focusParam, loading, setSearchParams, loadMyCertificates])

  /* I-scroll papunta sa card, tapos alisin ang highlight */
  useEffect(() => {
    if (!highlightId) return undefined
    document
      .getElementById(`event-${highlightId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setHighlightId(null), 4000)
    return () => clearTimeout(timer)
  }, [highlightId])

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
    setNotice('Changes saved.')
  }

  async function handleDelete(event) {
    const ok = window.confirm(`Delete the event "${event.title}"? This cannot be undone.`)
    if (!ok) return

    setNotice('')
    setDeletingId(event.id)
    try {
      await deleteEvent(event)
      setEvents((list) => list.filter((e) => e.id !== event.id))
      setNotice('Event deleted.')
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

  return (
    <>
      <PageHeader title="Events" />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.loading}>Loading events…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load events"
          message="There was a problem connecting to the database. Please try again later."
        />
      )}

      {!loading && !error && events.length === 0 && (
        <EmptyState
          icon="◆"
          title="No events scheduled yet"
          message={
            can.propose
              ? 'Once your proposal is approved, press "+ Create Event" in Proposals.'
              : 'Once an event is added, it will appear here with its date, time and location.'
          }
        />
      )}

      {!loading && !error && events.length > 0 && (
        <>
          {can.propose && (
            <p className={styles.hint}>
              Have an approved proposal?{' '}
              <Link to="/proposals">Go to Proposals</Link> to create an event for it.
            </p>
          )}

          {/* ---------- SEARCH ---------- */}
          <div className={styles.searchBar}>
            <input
              type="search"
              className={styles.search}
              placeholder="Search by event, location, date, or creator…"
              aria-label="Search events"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {query && (
              <span className={styles.searchCount}>
                {matched.length} of {withStatus.length}
              </span>
            )}
          </div>

          <div className={styles.filters} role="tablist" aria-label="Filter by status">
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
                  No
                  {filter !== 'all' && ` ${eventStatusLabel(filter).toLowerCase()}`} events
                  match &ldquo;{search.trim()}&rdquo;.{' '}
                  <button type="button" className={styles.clearSearch} onClick={() => setSearch('')}>
                    Clear search
                  </button>
                </>
              ) : (
                `No ${eventStatusLabel(filter).toLowerCase()} events.`
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

                /* OG reward ng event (null kung walang itinakda) */
                const reward = rewards[ev.id] ?? null
                const showRewardRow = Boolean(reward) || isAdviser
                const myOg =
                  joinable && joined && isDone && reward && certsLoaded
                    ? myOgStatus(reward, myAttendance[ev.id], attendanceClosed)
                    : null

                return (
                  <li
                    key={ev.id}
                    id={`event-${ev.id}`}
                    className={`${styles.card} ${highlightId === ev.id ? styles.cardHighlight : ''}`}
                  >
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
                          <dt>Date</dt>
                          <dd>{formatEventDate(ev.event_date)}</dd>
                        </div>
                        <div>
                          <dt>Time</dt>
                          <dd>
                            {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                          </dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>{ev.location}</dd>
                        </div>
                        {showRewardRow && (
                          <div>
                            <dt>Reward</dt>
                            <dd>
                              {reward ? (
                                <span className={styles.reward}>
                                  <OgAmount value={reward.amount} size={15} />
                                  <span className={styles.rewardSub}>
                                    Time In + Time Out · {rewardFor(reward.amount, false)} OG
                                    if Time In only
                                  </span>
                                </span>
                              ) : (
                                <span className={styles.rewardNone}>
                                  None yet · <Link to="/rewards">Set in Rewards</Link>
                                </span>
                              )}
                            </dd>
                          </div>
                        )}
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
                          {isOpen ? 'Show less' : 'Read more'}
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
                              {joinBusy ? 'Joining…' : 'Join'}
                            </button>
                          )}

                          {joinable && joined && (
                            <span className={styles.joinedGroup}>
                              <span className={styles.joinedBadge}>✓ You joined</span>
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
                                {certBusy ? 'Opening…' : 'Download Certificate'}
                              </button>
                            ) : completedMine ? (
                              <span className={styles.certNote}>
                                Your attendance is complete. No certificate yet — an Officer or the
                                Adviser will upload it.
                              </span>
                            ) : attendanceClosed ? (
                              <span className={styles.certNoteMuted}>
                                No certificate — your Time In and Time Out are incomplete.
                              </span>
                            ) : null)}

                          {/* ---------- OG MO ---------- */}
                          {myOg && (
                            <span
                              className={
                                myOg.tone === 'got'
                                  ? styles.ogGot
                                  : myOg.tone === 'pending'
                                    ? styles.ogPending
                                    : styles.ogNone
                              }
                            >
                              {myOg.text}
                            </span>
                          )}

                          {missed && (
                            <span className={styles.missedNote}>
                              The event ended without you joining.
                            </span>
                          )}
                        </div>
                      )}

                      <div className={styles.footer}>
                        <p className={styles.author}>
                          {authorLabel(ev)}
                          {wasEdited(ev) && <span className={styles.edited}> · edited</span>}
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
                                Edit
                              </button>
                            )}
                            {deletable && (
                              <button
                                type="button"
                                className={`${styles.linkButton} ${styles.danger}`}
                                onClick={() => handleDelete(ev)}
                                disabled={busy}
                              >
                                {busy ? 'Deleting…' : 'Delete'}
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