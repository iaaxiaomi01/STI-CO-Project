import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Gem,
  Megaphone,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig, ROLE_KEYS } from '../config/roles.js'
import { supabase } from '../lib/supabaseClient.js'
import { displayNameOf, firstNameOf } from '../lib/profile.js'
import { countRecentAnnouncements } from '../lib/announcements.js'
import { countPendingProposals } from '../lib/proposals.js'
import { countEventsByStatus } from '../lib/events.js'
import { fetchAttendanceRates } from '../lib/attendance.js'
import {
  isOgNotification,
  isProposalNotification,
  subscribeToNotifications,
} from '../lib/notifications.js'
import { fetchMyBalance } from '../lib/og.js'
import {
  fetchSchoolAdminOverview,
  isSchoolAdminStat,
  schoolAdminStatValue,
} from '../lib/schoolAdmin.js'
import Avatar from '../components/Avatar.jsx'
import NotificationBell from '../components/NotificationBell.jsx'
import DashboardCalendar from '../components/DashboardCalendar.jsx'
import styles from './Dashboard.module.css'

/* ISANG Dashboard component, MARAMING magkaibang itsura.

   Ang laman ay galing sa src/config/roles.js, base sa role ng
   naka-login. Kaya hindi natin kailangan ng MemberDashboard.jsx
   at OfficerDashboard.jsx — pare-pareho lang ang hugis, ang
   teksto at numero ang nagkakaiba.

   KAILAN DAPAT HIWALAYAN:
   Kapag ang isang role ay nangailangan ng ibang-ibang LAYOUT —
   hindi lang ibang teksto. Habang teksto at numero lang ang
   pinagkaiba, config lang ang kailangan. */
function Dashboard() {
  const { user, profile, role } = useAuth()
  const roleConfig = getRoleConfig(role)

  const fullName = displayNameOf(profile, user)
  const firstName = firstNameOf(profile, user)

  /* TOTOONG DATA: bilang ng aktibong miyembro ng organisasyon
     mo. Galing sa function na my_org_member_count() sa Supabase.
     Kukunin lang kung may stat na key: 'memberCount' sa role
     config (Officer at Adviser). */
  const needsMemberCount = roleConfig.dashboard.stats.some(
    (stat) => stat.key === 'memberCount',
  )
  const [memberCount, setMemberCount] = useState(null)

  useEffect(() => {
    if (!needsMemberCount) return
    let active = true

    supabase.rpc('my_org_member_count').then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('Hindi makuha ang member count:', error)
        return
      }
      setMemberCount(data)
    })

    return () => {
      active = false
    }
  }, [needsMemberCount])

  /* TOTOONG DATA: ilang announcement ng org mo ang lumabas sa
     nakaraang 7 araw. Kukunin lang kung may stat na
     key: 'newAnnouncements' (Member). */
  const needsNewAnnouncements = roleConfig.dashboard.stats.some(
    (stat) => stat.key === 'newAnnouncements',
  )
  const [newAnnouncements, setNewAnnouncements] = useState(null)

  useEffect(() => {
    if (!needsNewAnnouncements) return
    let active = true

    countRecentAnnouncements(7)
      .then((count) => {
        if (active) setNewAnnouncements(count)
      })
      .catch((error) => {
        console.error('Hindi makuha ang bilang ng announcements:', error)
      })

    return () => {
      active = false
    }
  }, [needsNewAnnouncements])

  /* TOTOONG DATA: bilang ng events.
       key: 'upcomingEvents' (Member) → hindi pa nagsisimula
     Automatic ang status, kaya kinukuwenta ito mula sa petsa at
     oras (tingnan ang countEventsByStatus() sa lib/events.js).

     Inalis na ang 'activeEvents' (Officer, Adviser) — Event
     Calendar na ang pumalit sa Dashboard. */
  const needsEventCounts = roleConfig.dashboard.stats.some(
    (stat) => stat.key === 'upcomingEvents',
  )
  const [eventCounts, setEventCounts] = useState(null)

  useEffect(() => {
    if (!needsEventCounts) return
    let active = true

    countEventsByStatus()
      .then((counts) => {
        if (active) setEventCounts(counts)
      })
      .catch((error) => {
        console.error('Hindi makuha ang bilang ng events:', error)
      })

    return () => {
      active = false
    }
  }, [needsEventCounts])

  /* TOTOONG DATA: ilang proposal ang naghihintay pa ng aksyon.
     key: 'pendingProposals'
       Officer                   → lahat ng naghihintay pa sa org niya
       Adviser, SAO, School Head → ang naghihintay ng AKSYON NIYA
                                   (SAO/School Head: hindi kasama ang
                                   naaksyunan na niya) */
  const needsPendingProposals = roleConfig.dashboard.stats.some(
    (stat) => stat.key === 'pendingProposals',
  )
  const [pendingProposals, setPendingProposals] = useState(null)

  /* REALTIME: kinukuwenta ulit ang bilang kapag may notification
     tungkol sa proposal (bagong dating, umusad, ipina-revise) */
  useEffect(() => {
    if (!needsPendingProposals) return undefined
    let active = true

    function refresh() {
      countPendingProposals(profile?.role_id, profile?.id)
        .then((count) => {
          if (active) setPendingProposals(count)
        })
        .catch((error) => {
          console.error('Hindi makuha ang bilang ng proposals:', error)
        })
    }

    refresh()

    const unsubscribe = profile?.id
      ? subscribeToNotifications(profile.id, {
          onInsert: (row) => {
            if (isProposalNotification(row)) refresh()
          },
        })
      : () => {}

    return () => {
      active = false
      unsubscribe()
    }
  }, [needsPendingProposals, profile?.role_id, profile?.id])

  /* TOTOONG DATA: attendance rate (galing sa QR Time In).
     key: 'attendanceRate'
       Member          → sa mga natapos na event na sinalihan mo
       Officer/Adviser → sa buong organisasyon
     key: 'myAttendanceRate'
       Officer         → sa mga natapos na event na sinalihan MO
     Iisang tawag lang sa database para sa dalawa.
     Tingnan ang attendance_summary() sa QR_ATTENDANCE.sql. */
  const needsAttendanceRate = roleConfig.dashboard.stats.some(
    (stat) => stat.key === 'attendanceRate' || stat.key === 'myAttendanceRate',
  )
  const orgWideRate = profile?.role_id === 2 || profile?.role_id === 3
  const [attendanceRates, setAttendanceRates] = useState(null)

  useEffect(() => {
    if (!needsAttendanceRate) return
    let active = true

    fetchAttendanceRates()
      .then((rates) => {
        if (active) setAttendanceRates(rates)
      })
      .catch((error) => {
        console.error('Hindi makuha ang attendance rate:', error)
        if (active) setAttendanceRates({ mine: '—', org: '—' })
      })

    return () => {
      active = false
    }
  }, [needsAttendanceRate])

  /* TOTOONG DATA: Organization Gems (OG) mo sa org mo.
     key: 'ogBalance' (Member at Officer)
     REALTIME: kinukuha ulit kapag may OG notification (na-release
     ang OG ng event, o na-cancel ang redemption mo).
     Tingnan ang my_og_balance() sa OG_REWARDS_SHOP.sql. */
  const needsOgBalance = roleConfig.dashboard.stats.some((stat) => stat.key === 'ogBalance')
  const [ogBalance, setOgBalance] = useState(null)

  useEffect(() => {
    if (!needsOgBalance) return undefined
    let active = true

    function refresh() {
      fetchMyBalance()
        .then((n) => {
          if (active) setOgBalance(n.toLocaleString('en-PH'))
        })
        .catch((error) => {
          console.error('Hindi makuha ang OG balance:', error)
          if (active) setOgBalance('—')
        })
    }

    refresh()

    const unsubscribe = profile?.id
      ? subscribeToNotifications(profile.id, {
          onInsert: (row) => {
            if (isOgNotification(row)) refresh()
          },
        })
      : () => {}

    return () => {
      active = false
      unsubscribe()
    }
  }, [needsOgBalance, profile?.id])

  /* TOTOONG DATA: School Administrator — budget proposals at
     bilang ng org/members/officers ng buong school.
     key: 'saOnTheWay', 'saApproved', 'saRejected',
          'saOrganizations', 'saMembers', 'saOfficers'
     Iisang tawag lang para sa lahat (school_admin_overview()).
     REALTIME: kinukuha ulit kapag may notification tungkol sa
     proposal, tulad ng pendingProposals. */
  const needsSchoolAdminOverview = roleConfig.dashboard.stats.some((stat) =>
    isSchoolAdminStat(stat.key),
  )
  const [schoolAdminOverview, setSchoolAdminOverview] = useState(null)
  const [schoolAdminError, setSchoolAdminError] = useState(false)

  useEffect(() => {
    if (!needsSchoolAdminOverview) return undefined
    let active = true

    function refresh() {
      fetchSchoolAdminOverview()
        .then((overview) => {
          if (!active) return
          setSchoolAdminOverview(overview)
          setSchoolAdminError(false)
        })
        .catch((error) => {
          console.error('Hindi makuha ang overview ng School Administrator:', error)
          if (active) setSchoolAdminError(true)
        })
    }

    refresh()

    const unsubscribe = profile?.id
      ? subscribeToNotifications(profile.id, {
          onInsert: (row) => {
            if (isProposalNotification(row)) refresh()
          },
        })
      : () => {}

    return () => {
      active = false
      unsubscribe()
    }
  }, [needsSchoolAdminOverview, profile?.id])

  const attendanceRate = attendanceRates
    ? orgWideRate
      ? attendanceRates.org
      : attendanceRates.mine
    : null
  const myAttendanceRate = attendanceRates?.mine ?? null

  /* Ang value sa config ay default lang; papalitan kapag
     may totoong numero na. */
  function statValue(stat) {
    if (stat.key === 'memberCount') return memberCount ?? '…'
    if (stat.key === 'newAnnouncements') return newAnnouncements ?? '…'
    if (stat.key === 'upcomingEvents') return eventCounts?.upcoming ?? '…'
    if (stat.key === 'pendingProposals') return pendingProposals ?? '…'
    if (stat.key === 'attendanceRate') return attendanceRate ?? '…'
    if (stat.key === 'myAttendanceRate') return myAttendanceRate ?? '…'
    if (stat.key === 'ogBalance') return ogBalance ?? '…'
    if (isSchoolAdminStat(stat.key)) {
      if (schoolAdminError) return '—'
      return schoolAdminStatValue(schoolAdminOverview, stat.key) ?? '…'
    }
    return stat.value
  }

  /* Mga stat na may "group" (hal. School Administrator) → may
     sariling heading ang bawat grupo. Kapag walang group, iisang
     hanay lang tulad ng dati. */
  const statGroups = groupStats(roleConfig.dashboard.stats)

  function renderStat(stat) {
    return (
      <Link key={stat.label} to={stat.to} state={stat.state} className={styles.stat}>
        <span className={styles.statValue}>{statValue(stat)}</span>
        <span className={styles.statLabel}>{stat.label}</span>
      </Link>
    )
  }

  /* ============================================================
     BENTO LAYOUT — layout: 'bento' sa config/roles.js
     (Member, Officer, Adviser)

     Pareho ang data at mga numero sa itaas (statValue); ibang
     hugis lang ng tile ayon sa key (BENTO_TILES):
       upcomingEvents, newAnnouncements,
       pendingProposals, memberCount    → malaking numero + icon
       ogBalance                        → dilaw na tile na may gem
       attendanceRate, myAttendanceRate → ring gauge

     Ang PUWESTO ng bawat tile sa grid ay nasa BENTO_LAYOUTS
     (iba-iba bawat role, dahil iba-iba ang bilang ng stat).
     ============================================================ */
  if (roleConfig.dashboard.layout === 'bento') {
    const bento = BENTO_LAYOUTS[role] ?? BENTO_LAYOUTS[ROLE_KEYS.MEMBER]
    const orgName = profile?.organizations?.name
    const cards = roleConfig.dashboard.cards

    return (
      <div className={styles.bentoPage}>
        <div className={styles.bentoWrap}>
          <div className={`${styles.bento} ${bento.gridClass ?? ''}`}>
            <div
              className={`${styles.tile} ${styles.hero} ${
                bento.identity ? styles.heroWithMeta : ''
              }`}
            >
              <span className={styles.heroArt} aria-hidden="true">
                <svg width="360" height="360" viewBox="0 0 360 360" fill="none">
                  <circle cx="180" cy="180" r="170" stroke="#fff" strokeOpacity="0.07" strokeWidth="2" />
                  <circle cx="180" cy="180" r="125" stroke="#fff" strokeOpacity="0.09" strokeWidth="2" />
                  <circle cx="180" cy="180" r="80" stroke="#fff" strokeOpacity="0.11" strokeWidth="2" />
                  <circle className={styles.heroDot} cx="64" cy="132" r="9" fill="var(--dash-yellow)" />
                </svg>
              </span>

              {/* Bell sa kanang itaas (notifications: true sa config) */}
              {roleConfig.notifications && (
                <div className={styles.heroBell}>
                  <NotificationBell variant="onDark" />
                </div>
              )}

              {/* Officer at Adviser: avatar + role · org (galing sa
                  lumang welcome card — hindi inalis, inilipat lang) */}
              {bento.identity && (
                <div className={styles.heroMeta}>
                  <Avatar
                    src={profile?.avatar_url}
                    name={fullName}
                    size="sm"
                    className={styles.heroAvatar}
                  />
                  <p className={styles.heroBadge}>
                    {roleConfig.label}
                    {orgName && ` · ${orgName}`}
                  </p>
                </div>
              )}

              <h1 className={styles.heroTitle}>
                Hello,
                <br />
                <span>{firstName}!</span>
              </h1>
            </div>

            {roleConfig.dashboard.stats.map((stat) => renderBentoTile(stat, bento))}
          </div>
        </div>

        {roleConfig.calendar && <DashboardCalendar eyebrow="Event Calendar" />}

        {/* Sections cards — Officer at Adviser (walang laman ang
            cards ng Member, kaya hindi lumalabas sa kanya) */}
        {cards.length > 0 && (
          <section className={styles.sections}>
            <h2 className={styles.sectionsTitle}>Sections</h2>

            <div className={styles.sectionsGrid}>
              {cards.map((card) => {
                const Icon = SECTION_ICONS[card.to]
                return (
                  <Link key={card.to} to={card.to} className={styles.sectionCard}>
                    <span className={styles.sectionGo} aria-hidden="true">
                      <ArrowUpRight size={16} strokeWidth={2.4} />
                    </span>
                    <span className={styles.sectionIcon} aria-hidden="true">
                      {Icon ? <Icon size={22} /> : card.icon}
                    </span>
                    <div>
                      <h3 className={styles.sectionName}>{card.title}</h3>
                      {card.text && <p className={styles.sectionText}>{card.text}</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    )
  }

  function renderBentoTile(stat, bento) {
    const value = statValue(stat)
    const tile = BENTO_TILES[stat.key] ?? {}
    const place = bento.tiles[stat.key] ?? ''

    return (
      <Link
        key={stat.key ?? stat.label}
        to={stat.to}
        state={stat.state}
        className={`${styles.tile} ${styles.statTile} ${tile.className ?? ''} ${place}`}
      >
        <span className={styles.go} aria-hidden="true">
          <ArrowUpRight size={18} strokeWidth={2.4} />
        </span>

        {tile.kind === 'gem' ? (
          <>
            <span className={styles.gemArt} aria-hidden="true">
              <svg viewBox="0 0 230 200" fill="none">
                <path d="M55 10h120l50 60-110 125L5 70Z" fill="var(--dash-gold)" />
                <path
                  d="M55 10 85 70 115 10 145 70 175 10M5 70h220M85 70l30 125 30-125"
                  stroke="var(--dash-navy-deep)"
                  strokeOpacity="0.22"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <path
                  d="M55 10h120l50 60-110 125L5 70Z"
                  stroke="var(--dash-navy-deep)"
                  strokeOpacity="0.28"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={`${styles.tileLabel} ${styles.topLabel}`}>{stat.label}</span>
            <span className={styles.ogValue}>
              <span className={`${styles.num} ${styles.ogNum}`}>{value}</span>
              <span className={styles.tileLabel}>OG</span>
            </span>
          </>
        ) : tile.kind === 'ring' ? (
          <>
            <span className={`${styles.tileLabel} ${styles.topLabel}`}>{stat.label}</span>
            <AttendanceRing value={value} />
            <span />
          </>
        ) : (
          <>
            <span className={styles.tileIcon} aria-hidden="true">
              {tile.Icon && <tile.Icon size={22} />}
            </span>
            <span className={styles.numRow}>
              <span className={styles.num}>{value}</span>
              <span className={styles.tileLabel}>
                {stat.label}
                {stat.tag && <span className={styles.tileTag}>{stat.tag}</span>}
              </span>
            </span>
          </>
        )}
      </Link>
    )
  }

  return (
    <>
      <div className={styles.welcomeCard}>
        <Avatar src={profile?.avatar_url} name={fullName} size="md" />

        <div className={styles.welcomeText}>
          <p className={styles.badge}>
            {roleConfig.label}
            {profile?.organizations?.name && ` · ${profile.organizations.name}`}
          </p>
          <h1 className={styles.title}>Hello, {firstName}!</h1>
        </div>

        {/* Bell sa kanang itaas — Member, Officer, Adviser, SAO at
            School Head (notifications: true sa config/roles.js) */}
        {roleConfig.notifications && (
          <div className={styles.welcomeActions}>
            <NotificationBell />
          </div>
        )}
      </div>

      {/* Stat tiles — nakalink sa kaukulang seksyon */}
      {statGroups.some((group) => group.title) ? (
        <div className={styles.statGroups}>
          {statGroups.map((group) => (
            <section key={group.title ?? 'other'}>
              {group.title && <h2 className={styles.sectionTitle}>{group.title}</h2>}
              <div className={styles.statRow}>{group.stats.map(renderStat)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.statRow}>{roleConfig.dashboard.stats.map(renderStat)}</div>
      )}

      {/* Event Calendar — Member, Officer, Adviser lang
          (calendar: true sa config/roles.js). Events ng LAHAT
          ng org ang lumalabas (DASHBOARD_CALENDAR_ALL_ORGS.sql). */}
      {roleConfig.calendar && (
        <section className={styles.calendarSection}>
          <h2 className={styles.sectionTitle}>Event Calendar</h2>
          <DashboardCalendar />
        </section>
      )}

      <h2 className={styles.sectionTitle}>Sections</h2>

      <div className={styles.cardGrid}>
        {roleConfig.dashboard.cards.map((card) => (
          <Link key={card.to} to={card.to} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">
              {card.icon}
            </span>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            <p className={styles.cardText}>{card.text}</p>
          </Link>
        ))}
      </div>
    </>
  )
}

/* [{ group: 'A', ... }, { group: 'A' }, { group: 'B' }]
     → [{ title: 'A', stats: [..] }, { title: 'B', stats: [..] }]
   Walang group → [{ title: null, stats: lahat }] */
function groupStats(stats) {
  const groups = []
  for (const stat of stats) {
    const title = stat.group ?? null
    const last = groups[groups.length - 1]
    if (last && last.title === title) last.stats.push(stat)
    else groups.push({ title, stats: [stat] })
  }
  return groups
}

/* HUGIS ng bawat stat tile sa bento (key → tile).
   Pareho sa lahat ng role na naka-bento. */
const BENTO_TILES = {
  upcomingEvents: { Icon: CalendarDays },
  newAnnouncements: { Icon: Megaphone },
  pendingProposals: { Icon: FileText },
  memberCount: { Icon: Users },
  ogBalance: { className: styles.tileGem, kind: 'gem' },
  attendanceRate: { kind: 'ring' },
  myAttendanceRate: { kind: 'ring' },
}

/* PUWESTO ng bawat stat tile sa grid, bawat role (key → class).
   Ang mismong grid-column/grid-row ay nasa Dashboard.module.css.

     gridClass — dagdag na class sa .bento (ibang taas ng row)
     identity  — ipakita ang avatar at "Role · Org" sa pagbati
                 (dating nasa welcome card ng Officer/Adviser)

   Member : pagbati + 2 stat sa kaliwa, Gems at attendance sa kanan
   Officer: pagbati + proposals + members sa itaas;
            Gems, org attendance, at sariling attendance sa ibaba
   Adviser: pagbati + proposals + members sa kaliwa;
            org attendance na matangkad sa kanan */
const BENTO_LAYOUTS = {
  [ROLE_KEYS.MEMBER]: {
    tiles: {
      upcomingEvents: styles.tEvents,
      newAnnouncements: styles.tAnn,
      ogBalance: styles.tOg,
      attendanceRate: styles.tAtt,
    },
  },
  [ROLE_KEYS.OFFICER]: {
    gridClass: styles.bentoOfficer,
    identity: true,
    tiles: {
      pendingProposals: styles.oProposals,
      memberCount: styles.oMembers,
      attendanceRate: styles.oOrgAtt,
      myAttendanceRate: styles.oMyAtt,
      ogBalance: styles.oOg,
    },
  },
  [ROLE_KEYS.ADVISER]: {
    gridClass: styles.bentoAdviser,
    identity: true,
    tiles: {
      pendingProposals: styles.aProposals,
      memberCount: styles.aMembers,
      attendanceRate: styles.aAtt,
    },
  },
}

/* Icon ng Sections cards (card.to → icon). Kapag wala rito,
   ang icon sa config/roles.js ang gagamitin. */
const SECTION_ICONS = {
  '/proposals': FileText,
  '/members': Users,
  '/announcements': Megaphone,
  '/rewards': Gem,
  '/attendance': ClipboardCheck,
  '/org-health': Activity,
  '/org-profile': Building2,
  '/events': CalendarDays,
}

/* Circumference ng ring (r = 78 sa viewBox na 184) */
const RING_LENGTH = 2 * Math.PI * 78

/* "86%" → 86 · "—" o "…" → null
   (string ang ibinabalik ng fetchAttendanceRates(), kaya dito
   na lang kinukuha ang numero para sa ring) */
function percentOf(value) {
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null
}

function AttendanceRing({ value }) {
  const pct = percentOf(value)

  return (
    <span className={styles.ring}>
      <svg viewBox="0 0 184 184" aria-hidden="true">
        <circle className={styles.ringTrack} cx="92" cy="92" r="78" />
        {pct > 0 && (
          <circle
            className={styles.ringBar}
            cx="92"
            cy="92"
            r="78"
            strokeDasharray={`${(pct / 100) * RING_LENGTH} ${RING_LENGTH}`}
          />
        )}
      </svg>
      <span className={styles.ringValue}>
        <b>{value}</b>
        {pct !== null && <small>attended</small>}
      </span>
    </span>
  )
}

export default Dashboard