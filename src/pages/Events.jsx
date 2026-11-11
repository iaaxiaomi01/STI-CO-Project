import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Award,
  Building2,
  CalendarX,
  Check,
  Clock,
  Download,
  Info,
  MapPin,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { hasAdviserPowers } from '../config/roles.js'
import {
  EVENT_STATUSES,
  MISSED_STATUS,
  authorLabel,
  canCreateEventFrom,
  canCreateEvents,
  canJoinEvents,
  canDeleteEvent,
  canViewAllEvents,
  canEditEvent,
  computeStatus,
  createEventFromProposal,
  deleteEvent,
  endDateOf,
  eventErrorMessage,
  eventStatusLabel,
  fetchEvents,
  fetchMyJoinedEventIds,
  fetchParticipantCounts,
  findScheduleConflict,
  formatEventDateRange,
  formatEventTimeRange,
  isMultiDay,
  joinEvent,
  nowKey,
  orgNameOf,
  updateEvent,
  wasEdited,
} from '../lib/events.js'
import { fetchProposals } from '../lib/proposals.js'
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
import { fetchEventRewards } from '../lib/og.js'
import { OgAmount } from '../components/OgGem.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import EventForm from '../components/EventForm.jsx'
import JoinConfirmDialog from '../components/JoinConfirmDialog.jsx'
import CertificatesDialog from '../components/CertificatesDialog.jsx'
import EventDetailsDialog from '../components/EventDetailsDialog.jsx'
import styles from './Events.module.css'

/* ============================================================
   EVENTS — TOTOONG DATA mula sa public.events

   Saan galing ang event:
     Officer nagpasa ng proposal → APPROVED na ang buong daan →
     ang NAGPASA ang gumagawa ng event DITO sa Events page
     ("+ Create Event" sa itaas). Wala na ito sa Proposals.

   + CREATE EVENT (Officer lang — canCreateEvents()):
     PER ORG pa rin. Pagkapindot, kinukuha ang proposals (RLS:
     sariling org lang), at ang ipinapakita lang ay ang pasado sa
     canCreateEventFrom(): sariling org, ikaw ang nagpasa,
     approved, at wala pang event. Pipili siya ng proposal sa
     EventForm; ang Start Date, End Date, oras, Location at OG
     reward ay galing doon at naka-lock. Kapag wala, may paalala lang.
     Ang trigger sa database pa rin ang totoong nagbabantay
     (events_before_insert).

   Member  → nakikita ang events ng org niya
   Officer → nakikita lahat; gumagawa (mula sa approved na proposal);
             nag-e-edit ng SARILI niyang gawa, pero HINDI na ito
             mabubura kapag nagawa na
   Adviser → nakikita lahat; nag-e-edit/nagbubura ng LAHAT sa org

   I-EDIT: nawawala ang button 30 minuto bago magsimula ang
   event (kusa, dahil sa "now" na nire-refresh bawat 30 segundo).
   Hinaharang din ito ng database (EVENT_EDIT_LOCK.sql).

   Ang Status (Upcoming/Ongoing/Completed) ay AUTOMATIC —
   kinukuwenta mula sa Start Date, End Date at oras, at
   nire-refresh bawat 30 segundo habang bukas ang page.

   MARAMING ARAW (PROPOSAL_START_END_DATE.sql): ang stub ng
   ticket ay ang Start Date, may "to <End Date>" sa ilalim; ang
   oras ay may petsa ng simula at katapusan.

   MISSED (Member at Officer): kapag Completed na ang event at
   HINDI siya nag-Join, "Missed" ang ipinapakita imbes na "Completed",
   at may sarili itong tab. Display lang ito — walang
   binabago sa database.

   JOIN:
     Member at Officer → may "Join" habang Upcoming pa
                          (hindi pa nagsisimula) ang event.
                          Kapag Ongoing na, wala nang Join button.
                          Pagka-Join, lilipat sa Attendance tab.
     MAGKASABAY NA EVENT → kapag KASABAY (nagpapatong ang buong
                          saklaw ng petsa at oras) ng event na
                          sinalihan mo na, walang Join —
                          "Schedule conflict" at paalala kung
                          aling event ang kasabay.
                          Hinaharang din ito ng database
                          (EVENT_JOIN_NO_CONFLICT.sql).
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

   OG REWARD (OG_REWARD_FROM_PROPOSAL.sql — event_og_rewards):
     Itinakda ng Officer sa proposal; kusang nakopya sa event.
     Member, Officer, Adviser → may "Reward" sa detalye ng event
                          kapag may OG reward ito (Time In AT
                          Time Out ang kailangan).
     Member at Officer  → sa event na sinalihan at tapos na:
                          ilang OG ang natanggap mo, o ilang OG
                          ang matatanggap mo kapag kusang na-release
                          na (pagsara ng attendance). Kinukuwenta
                          mula sa sariling attendance — pareho ng
                          og_release_event() sa database.
     Kapag dumating ang "og_update" notification (na-release ang
     OG) habang bukas ang page → kukunin ulit ang mga reward.
     Basa lang ito; walang binabago sa database.

   SAO (SAO_EVENTS_READ.sql — canViewAllEvents()):
     Nakikita ang events ng LAHAT ng aktibong organisasyon, sa
     ticket view. Basa lang: walang Join, Edit, Delete o
     Certificates (hindi siya kabilang sa anumang org).
     Dagdag para sa kanya:
       • pangalan ng org sa bawat ticket
       • filter ayon sa org (katabi ng search) — ang bilang sa
         mga tab ay ayon sa napiling org
       • bilang ng sumali (event_participant_counts())
       • "View details" → EventDetailsDialog: kumpletong
         detalye (larawan, org, petsa, oras, lugar, OG reward,
         bilang ng sumali, gumawa, kailan ginawa/binago, at ang
         buong description)
     Galing sa Dashboard calendar: /events?event=<id> → dadalhin
     sa mismong ticket (tulad ng sa notification).

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

/* Mga pagpipiliang proposal sa "+ Create Event": pinakamalapit
   na petsa muna; ang walang petsa (luma) ay sa dulo */
function sortChoices(list) {
  return [...list].sort((a, b) => {
    const ka = a.event_date ? `${a.event_date} ${a.start_time ?? ''}` : '9999'
    const kb = b.event_date ? `${b.event_date} ${b.start_time ?? ''}` : '9999'
    return ka.localeCompare(kb)
  })
}

const FILTERS = [{ value: 'all', label: 'All' }, ...EVENT_STATUSES]

/* Member at Officer: may dagdag na tab na "Missed" */
const MEMBER_FILTERS = [...FILTERS, MISSED_STATUS]

/* "2026-10-07" → { day: '07', month: 'OCT 2026', weekday: 'Wednesday' }
   Para sa malaking petsa sa stub ng ticket. Display lang. */
function dateParts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    day: String(d).padStart(2, '0'),
    month: `${date.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase()} ${y}`,
    weekday: date.toLocaleDateString('en-PH', { weekday: 'long' }),
  }
}

/* Event na maraming araw → "to Sun, Nov 22" (sa ilalim ng Start
   Date sa stub ng ticket) */
function untilLabel(ev) {
  const [y, m, d] = endDateOf(ev).split('-').map(Number)
  return `to ${new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`
}

/* Diamond sa poster kapag walang larawan ang event */
function PosterMark() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 22 12 12 22 2 12Z" />
      <path d="M12 7 17 12 12 17 7 12Z" />
    </svg>
  )
}

function isFinished(status) {
  return status === 'completed' || status === MISSED_STATUS.value
}

/* Paalala kapag kasabay ng event na sinalihan mo na:
   "Same schedule as “Sports Fest” (8:00 AM – 10:00 AM), which you already joined."
   Maraming araw: "(Nov 20, 8:00 AM – Nov 22, 5:00 PM)" */
function conflictText(conflict) {
  return (
    `Same schedule as “${conflict.title}” ` +
    `(${formatEventTimeRange(conflict)}), ` +
    'which you already joined. You can only join one event at a time.'
  )
}

/* Ilang OG ang sa iyo sa isang tapos na event na sinalihan mo.
   Pareho ng og_release_event(): kailangan may Time In AT Time Out.
   Ibinabalik: { tone: 'got' | 'pending' | 'none', text } o null */
function myOgStatus(reward, attendance, attendanceClosed) {
  const timedIn = Boolean(attendance?.time_in)
  const complete = Boolean(attendance?.time_out)
  const amount = timedIn && complete ? Number(reward.amount) || 0 : 0
  const og = amount.toLocaleString('en-PH')
  const full = Number(reward.amount).toLocaleString('en-PH')

  const noOg = timedIn
    ? 'No OG — you had Time In but no Time Out for this event.'
    : 'No OG — you had no Time In for this event.'

  if (reward.released_at) {
    return amount > 0
      ? { tone: 'got', text: `You received +${og} OG for this event.` }
      : { tone: 'none', text: noOg }
  }

  if (attendanceClosed) {
    return amount > 0
      ? { tone: 'pending', text: `Your ${og} OG is being released. It will show up shortly.` }
      : { tone: 'none', text: noOg }
  }

  /* Bukas pa ang attendance (hanggang 1 oras pagkatapos ng event) */
  if (complete) {
    return {
      tone: 'pending',
      text: `You'll receive ${og} OG automatically when attendance closes.`,
    }
  }
  if (timedIn) {
    return {
      tone: 'pending',
      text: `Time Out before attendance closes to get ${full} OG.`,
    }
  }
  return null
}

function Events() {
  const { role, profile } = useAuth()

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

  /* ---------- + CREATE EVENT (Officer) ----------
     null = sarado, o ang listahan ng approved na proposal na
     pwedeng gawan ng event (bukas ang form) */
  const canCreate = canCreateEvents(profile)
  const [createChoices, setCreateChoices] = useState(null)
  const [openingCreate, setOpeningCreate] = useState(false)

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

  /* Ang mismong mga event na sinalihan mo — para malaman kung
     KASABAY ng isa sa mga ito ang ibang event (findScheduleConflict) */
  const joinedEvents = useMemo(
    () => events.filter((e) => joinedIds.has(e.id)),
    [events, joinedIds],
  )

  /* ---------- SAO: events ng LAHAT ng org ----------
     orgFilter: 'all' o organization_id
     participantCounts: { [event_id]: bilang ng sumali }
     detailsEvent: ang event na nasa "View details" */
  const viewAllEvents = canViewAllEvents(profile)
  const [orgFilter, setOrgFilter] = useState('all')
  const [participantCounts, setParticipantCounts] = useState(null)
  const [detailsEvent, setDetailsEvent] = useState(null)
  const closeDetails = useCallback(() => setDetailsEvent(null), [])

  /* "Missed" — Member at Officer (sila ang nagja-Join) */
  const showMissed = profile?.role_id === 1 || profile?.role_id === 2
  const filters = showMissed ? MEMBER_FILTERS : FILTERS

  /* TICKET VIEW — Member, Officer at Adviser.
     Itsura lang ang iba; pareho ang data at mga aksyon.
     Ang Adviser ay walang Join (canJoinEvents), kaya walang
     button sa stub niya — nasa ibaba ng ticket ang Certificates,
     Edit at Delete, tulad ng sa Officer.
     Ang dating card layout ay naiwan para sa ibang role. */
  const ticketView = showMissed || hasAdviserPowers(profile) || viewAllEvents

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
  const isAdviser = hasAdviserPowers(profile)

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

    /* SAO: bilang ng sumali bawat event. Hiwalay — kapag pumalya,
       "—" lang ang lalabas pero gagana pa rin ang page. */
    if (viewAllEvents) {
      fetchParticipantCounts()
        .then(setParticipantCounts)
        .catch((err) => console.error('Hindi makuha ang bilang ng sumali:', err))
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

    await loadMyCertificates()
  }, [profileId, loadMyCertificates, loadRewards, viewAllEvents])

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
     (hinaharang din ng database — EVENT_JOIN_NO_LEAVE.sql).

     Kapag may kasabay na event na nasalihan na (hal. sa ibang
     tab), ang database ang haharang at ang mensahe nito ang
     lalabas sa dialog (EVENT_JOIN_NO_CONFLICT.sql). */
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
    setOrgFilter('all')
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
  const closeCreate = useCallback(() => setCreateChoices(null), [])

  /* "+ Create Event" → kunin ang approved na proposals ng org mo
     na ikaw ang nagpasa at wala pang event. Laging bago ang
     kinukuha, para kasama agad ang kaaa-approve lang. */
  async function openCreate() {
    if (openingCreate) return
    setNotice('')
    setOpeningCreate(true)
    try {
      const proposals = await fetchProposals()
      const choices = sortChoices(proposals.filter((p) => canCreateEventFrom(p, profile)))
      if (choices.length === 0) {
        setNotice(
          'No approved proposals are waiting for an event. Once a proposal you submitted is fully approved, you can create its event here.',
        )
        return
      }
      setCreateChoices(choices)
    } catch (err) {
      console.error('Hindi makuha ang approved na proposals:', err)
      setNotice('Could not load your approved proposals. Please try again.')
    } finally {
      setOpeningCreate(false)
    }
  }

  /* Galing sa EventForm. Kapag nag-throw, doon lalabas ang
     error at mananatiling bukas ang form. */
  async function handleCreate(values, { imageFile, proposal }) {
    const created = await createEventFromProposal(proposal, values, imageFile)
    setEvents((list) => [...list, created])
    setCreateChoices(null)
    setFilter('all')
    setSearch('')
    setHighlightId(created.id)
    setNotice('Event created. Members of your organization can now see and join it.')
    /* Kinokopya ng database ang OG reward ng proposal sa event */
    loadRewards()
  }

  /* Mga event na tumutugma sa search (lahat kapag blangko).
     Hindi mahalaga ang malaki o maliit na titik.
     Kasama ang Start Date at End Date. */
  const query = search.trim().toLowerCase()

  /* SAO: mga org na may event — para sa filter. A–Z. */
  const orgOptions = useMemo(() => {
    if (!viewAllEvents) return []
    const seen = new Map()
    events.forEach((e) => {
      if (!seen.has(e.organization_id)) seen.set(e.organization_id, orgNameOf(e) || 'Organization')
    })
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [events, viewAllEvents])

  /* Kapag nawala ang napiling org (hal. na-delete ang huling
     event nito), balik sa "All organizations" */
  const activeOrgFilter =
    orgFilter !== 'all' && orgOptions.some((o) => o.id === orgFilter) ? orgFilter : 'all'

  const matched = useMemo(() => {
    const inOrg =
      activeOrgFilter === 'all'
        ? withStatus
        : withStatus.filter((e) => e.organization_id === activeOrgFilter)
    if (!query) return inOrg
    return inOrg.filter((e) =>
      [
        e.title,
        e.description,
        e.location,
        e.author_name,
        orgNameOf(e),
        e.event_date,
        e.end_date,
        formatEventDateRange(e),
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query)),
    )
  }, [withStatus, query, activeOrgFilter])

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
    <div className={ticketView ? styles.ticketPage : undefined}>
      <PageHeader
        title="Events"
        action={
          canCreate && (
            <ActionButton onClick={openCreate}>
              {openingCreate ? 'Loading…' : '+ Create Event'}
            </ActionButton>
          )
        }
      />

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
            viewAllEvents
              ? 'Events created by any organization will show up here.'
              : undefined
          }
        />
      )}

      {!loading && !error && events.length > 0 && (
        <>

          <div className={styles.toolbar}>
          {/* ---------- SEARCH ---------- */}
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} size={18} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="search"
              className={styles.search}
              placeholder={
                viewAllEvents
                  ? 'Search by event, organization, location, date…'
                  : 'Search by event, location, date, or creator…'
              }
              aria-label="Search events"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {/* Member/Officer ticket view: wala — ang bilang sa "All"
                tab na ang nagsasabi kung ilan ang tumugma.
                Adviser: naiwan, tulad ng dati niyang layout. */}
            {query && (!ticketView || isAdviser || viewAllEvents) && (
              <span className={styles.searchCount}>
                {matched.length} of {withStatus.length}
              </span>
            )}
          </div>

          {/* SAO: filter ayon sa org */}
          {viewAllEvents && orgOptions.length > 1 && (
            <label className={styles.orgFilter}>
              <Building2 size={17} aria-hidden="true" className={styles.orgFilterIcon} />
              <span className={styles.srOnly}>Organization</span>
              <select
                value={activeOrgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
              >
                <option value="all">All organizations</option>
                {orgOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}

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
                /* Kasabay (nagpapatong ang petsa at oras) ng event
                   na sinalihan mo na → walang Join, may paalala.
                   Hinaharang din ito ng database (EVENT_JOIN_NO_CONFLICT.sql). */
                const conflict =
                  joinable && !joined && ev.status === 'upcoming'
                    ? findScheduleConflict(ev, joinedEvents)
                    : null
                /* Join: Upcoming lang. Kapag Ongoing na (nagsimula na ang
                   event), sarado na ang pagsali — wala nang Join button.
                   Hinaharang din ito ng database (EVENT_JOIN_BEFORE_START.sql). */
                const canJoinNow = joinable && !joined && ev.status === 'upcoming' && !conflict
                /* May Join, "Nakasali ka", "Hindi ka nakasali" o
                   "Schedule conflict" na ipapakita */
                const hasJoinAction = joinable && (joined || canJoinNow || missed || Boolean(conflict))

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
                const showRewardRow = Boolean(reward)
                const myOg =
                  joinable && joined && isDone && reward && certsLoaded
                    ? myOgStatus(reward, myAttendance[ev.id], attendanceClosed)
                    : null

                if (ticketView) {
                  const date = dateParts(ev.event_date)
                  const certReady = showCertStatus && Boolean(myCert)

                  return (
                    <li
                      key={ev.id}
                      id={`event-${ev.id}`}
                      className={[
                        styles.ticket,
                        styles[`t_${ev.status}`] ?? '',
                        highlightId === ev.id ? styles.cardHighlight : '',
                      ].join(' ')}
                    >
                      {/* ---------- POSTER ---------- */}
                      <div className={styles.poster}>
                        {ev.image_url ? (
                          <img src={ev.image_url} alt="" loading="lazy" />
                        ) : (
                          <PosterMark />
                        )}
                      </div>

                      {/* ---------- KATAWAN ---------- */}
                      <div className={styles.ticketBody}>
                        {viewAllEvents && orgNameOf(ev) && (
                          <p className={styles.ticketOrg}>
                            <Building2 size={14} aria-hidden="true" />
                            {orgNameOf(ev)}
                          </p>
                        )}
                        <h2 className={styles.ticketTitle}>{ev.title}</h2>

                        <p
                          className={`${styles.ticketDesc} ${
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

                        <ul className={styles.chips}>
                          <li>
                            <Clock size={15} aria-hidden="true" />
                            <span className={styles.srOnly}>Time: </span>
                            {formatEventTimeRange(ev)}
                          </li>
                          <li>
                            <MapPin size={15} aria-hidden="true" />
                            <span className={styles.srOnly}>Location: </span>
                            {ev.location}
                          </li>
                          {reward && (
                            <li className={styles.chipOg}>
                              <span className={styles.srOnly}>Reward: </span>
                              <OgAmount value={reward.amount} size={15} />
                            </li>
                          )}
                          {viewAllEvents && participantCounts && (
                            <li>
                              <Users size={15} aria-hidden="true" />
                              {(participantCounts[ev.id] ?? 0).toLocaleString('en-PH')} joined
                            </li>
                          )}
                        </ul>

                        {/* ---------- KASABAY NG SINALIHAN MO ---------- */}
                        {conflict && (
                          <p className={`${styles.ticketNote} ${styles.noteConflict}`}>
                            {conflictText(conflict)}
                          </p>
                        )}

                        {/* ---------- CERTIFICATE NOTE (wala pang file) ---------- */}
                        {showCertStatus && !myCert && completedMine && (
                          <p className={`${styles.ticketNote} ${styles.notePending}`}>
                            Your attendance is complete. No certificate yet — an Officer or the
                            Adviser will upload it.
                          </p>
                        )}
                        {showCertStatus && !myCert && !completedMine && attendanceClosed && (
                          <p className={`${styles.ticketNote} ${styles.noteNone}`}>
                            No certificate — your Time In and Time Out are incomplete.
                          </p>
                        )}

                        {/* ---------- OG MO ---------- */}
                        {myOg && (
                          <p
                            className={`${styles.ticketNote} ${
                              myOg.tone === 'got'
                                ? styles.noteGot
                                : myOg.tone === 'pending'
                                  ? styles.notePending
                                  : styles.noteNone
                            }`}
                          >
                            {myOg.text}
                          </p>
                        )}

                        <div className={styles.ticketFooter}>
                          <p className={styles.author}>
                            {authorLabel(ev)}
                            {wasEdited(ev) && <span className={styles.edited}> · edited</span>}
                          </p>

                          {/* SAO: kumpletong detalye ng event */}
                          {viewAllEvents && (
                            <div className={`${styles.actions} ${styles.tActions}`}>
                              <button
                                type="button"
                                className={`${styles.linkButton} ${styles.tAction}`}
                                onClick={() => setDetailsEvent(ev)}
                              >
                                <Info size={16} strokeWidth={2.2} aria-hidden="true" />
                                View details
                              </button>
                            </div>
                          )}

                          {/* Officer at Adviser: Certificates / Edit / Delete */}
                          {(editable || deletable || manageCerts) && (
                            <div className={`${styles.actions} ${styles.tActions}`}>
                              {manageCerts && (
                                <button
                                  type="button"
                                  className={`${styles.linkButton} ${styles.tAction}`}
                                  onClick={() => {
                                    setNotice('')
                                    setCertEvent(ev)
                                  }}
                                  disabled={busy}
                                >
                                  <Award size={16} strokeWidth={2.2} aria-hidden="true" />
                                  Certificates
                                </button>
                              )}
                              {editable && (
                                <button
                                  type="button"
                                  className={`${styles.linkButton} ${styles.tAction}`}
                                  onClick={() => {
                                    setNotice('')
                                    setEditing(ev)
                                  }}
                                  disabled={busy}
                                >
                                  <Pencil size={15} strokeWidth={2.2} aria-hidden="true" />
                                  Edit
                                </button>
                              )}
                              {deletable && (
                                <button
                                  type="button"
                                  className={`${styles.linkButton} ${styles.tAction} ${styles.danger}`}
                                  onClick={() => handleDelete(ev)}
                                  disabled={busy}
                                >
                                  <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                                  {busy ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ---------- STUB: status, petsa, aksyon ---------- */}
                      <div className={styles.stub}>
                        <span className={`${styles.notch} ${styles.notchA}`} aria-hidden="true" />
                        <span className={`${styles.notch} ${styles.notchB}`} aria-hidden="true" />

                        <span className={styles.statusPill}>
                          {ev.status === 'ongoing' && (
                            <span className={styles.liveDot} aria-hidden="true" />
                          )}
                          {eventStatusLabel(ev.status)}
                        </span>

                        {/* Start Date; kapag maraming araw, "to <End Date>"
                            ang kapalit ng weekday */}
                        <p className={styles.stubDate}>
                          <span className={styles.srOnly}>{formatEventDateRange(ev)}</span>
                          <span className={styles.stubDay} aria-hidden="true">
                            {date.day}
                          </span>
                          <span className={styles.stubMeta} aria-hidden="true">
                            <span className={styles.stubMonth}>{date.month}</span>
                            <span className={styles.stubWeekday}>
                              {isMultiDay(ev) ? untilLabel(ev) : date.weekday}
                            </span>
                          </span>
                        </p>

                        <div className={styles.stubAction}>
                          {canJoinNow && (
                            <button
                              type="button"
                              className={styles.tJoin}
                              onClick={() => openJoin(ev)}
                              disabled={joinBusy}
                            >
                              {joinBusy ? 'Joining…' : 'Join'}
                            </button>
                          )}

                          {/* Kasabay ng sinalihan mo — kapalit ng Join */}
                          {conflict && (
                            <span className={styles.tConflict} title={conflictText(conflict)}>
                              <CalendarX size={16} strokeWidth={2.4} aria-hidden="true" />
                              Schedule conflict
                            </span>
                          )}

                          {/* Hindi na kasabay ng Download — sa sumali lang
                              lumalabas ang Download */}
                          {joinable && joined && !certReady && (
                            <span className={styles.tStamp}>
                              <Check size={15} strokeWidth={3} aria-hidden="true" />
                              You joined
                            </span>
                          )}

                          {certReady && (
                            <button
                              type="button"
                              className={styles.tCert}
                              onClick={() => handleDownloadCertificate(ev)}
                              disabled={certBusy}
                            >
                              <Download size={16} strokeWidth={2.4} aria-hidden="true" />
                              {certBusy ? 'Opening…' : 'Download Certificate'}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                }

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
                          <dt>{isMultiDay(ev) ? 'Dates' : 'Date'}</dt>
                          <dd>{formatEventDateRange(ev)}</dd>
                        </div>
                        <div>
                          <dt>Time</dt>
                          <dd>{formatEventTimeRange(ev)}</dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>{ev.location}</dd>
                        </div>
                        {showRewardRow && (
                          <div>
                            <dt>Reward</dt>
                            <dd>
                              <span className={styles.reward}>
                                <OgAmount value={reward.amount} size={15} />
                              </span>
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
                          {canJoinNow && (
                            <button
                              type="button"
                              className={styles.joinButton}
                              onClick={() => openJoin(ev)}
                              disabled={joinBusy}
                            >
                              {joinBusy ? 'Joining…' : 'Join'}
                            </button>
                          )}

                          {/* Kasabay ng sinalihan mo — kapalit ng Join */}
                          {conflict && (
                            <span className={styles.conflictNote}>{conflictText(conflict)}</span>
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

      {createChoices && (
        <EventForm
          proposalChoices={createChoices}
          onSubmit={handleCreate}
          onCancel={closeCreate}
        />
      )}

      {editing && <EventForm initial={editing} onSubmit={handleUpdate} onCancel={closeForm} />}

      {certEvent && <CertificatesDialog event={certEvent} onClose={closeCertificates} />}

      {detailsEvent && (
        <EventDetailsDialog
          event={withStatus.find((e) => e.id === detailsEvent.id) ?? detailsEvent}
          reward={rewards[detailsEvent.id] ?? null}
          participants={participantCounts ? participantCounts[detailsEvent.id] ?? 0 : null}
          onClose={closeDetails}
        />
      )}

      {confirmingJoin && (
        <JoinConfirmDialog event={confirmingJoin} onConfirm={handleJoin} onCancel={closeJoin} />
      )}
    </div>
  )
}

export default Events