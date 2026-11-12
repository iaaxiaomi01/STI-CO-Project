/* ============================================================
   ROLES CONFIG — ANG SENTRO NG BUONG SISTEMA

   Isang file ang naglalatag kung ano ang nakikita at kayang
   gawin ng bawat role.

   BAKIT ISANG FILE LANG:
   Ang sidebar AT ang mga route ay parehong galing dito. Kaya
   imposibleng magkaroon ng link sa sidebar na walang route,
   o route na walang link.
   ============================================================ */

/* ┌────────────────────────────────────────────────────────┐
   │  GALING NA SA DATABASE ANG ROLE                        │
   │                                                        │
   │  Wala na ang DEV_ROLE. Ang role ng naka-login ay       │
   │  kinukuha na ng AuthProvider mula sa profiles.role_id  │
   │  sa Supabase, tapos isinasalin dito sa ROLE_ID_TO_KEY. │
   │                                                        │
   │  Para palitan ang role ng isang tao, baguhin ang       │
   │  role_id niya sa profiles table gamit ang SQL Editor   │
   │  o Table Editor ng Supabase (sila lang ang lusot sa    │
   │  guard trigger — REMOVE_IT_ADMIN_FUNCTIONS.sql).       │
   └────────────────────────────────────────────────────────┘ */

export const ROLE_KEYS = {
  MEMBER: 'member',
  OFFICER: 'officer',
  ADVISER: 'adviser',
  SAO: 'sao',
  SCHOOL_HEAD: 'school_head',
  SCHOOL_ADMIN: 'school_admin',
  IT_ADMIN: 'it_admin',
}

/* Katumbas ng laman ng public.roles sa database.
   Kapag nagdagdag ka ng role doon, dagdagan mo rin dito.

   Walang 5: inalis na ang SHS/Tertiary coordinator (tingnan ang
   REMOVE_SHS_TERTIARY.sql). Hindi inilipat ang 6 at 7 para hindi
   masira ang mga role_id na nakasulat na sa database.

   8 = School Administrator (ADD_SCHOOL_ADMINISTRATOR.sql). Kasunod
   ng School Head sa daloy ng proposal, pero 8 dahil 7 na ang IT
   Admin. */
export const ROLE_ID_TO_KEY = {
  1: ROLE_KEYS.MEMBER,
  2: ROLE_KEYS.OFFICER,
  3: ROLE_KEYS.ADVISER,
  4: ROLE_KEYS.SAO,
  6: ROLE_KEYS.SCHOOL_HEAD,
  7: ROLE_KEYS.IT_ADMIN,
  8: ROLE_KEYS.SCHOOL_ADMIN,
}

export function roleKeyFromId(roleId) {
  return ROLE_ID_TO_KEY[roleId] ?? null
}

/* Mga karaniwang sidebar item, para hindi paulit-ulit isulat */
const DASHBOARD = { label: 'Dashboard', to: '/dashboard', icon: '■' }
const EVENTS = { label: 'Events', to: '/events', icon: '◆' }
const ANNOUNCEMENTS = { label: 'Announcements', to: '/announcements', icon: '★' }
const ATTENDANCE = { label: 'Attendance', to: '/attendance', icon: '✓' }
const MEMBERS = { label: 'Members', to: '/members', icon: '▲' }
const PROPOSALS = { label: 'Proposals', to: '/proposals', icon: '✉' }
const PROFILE = { label: 'Profile', to: '/profile', icon: '●' }

/* Org Profile — Adviser lang. Ang School Administrator ay sa
   Organizations → Edit na (logo, detalye, officer positions). */
const ORG_PROFILE = { label: 'Org Profile', to: '/org-profile', icon: '◈' }

/* Organization Gems (OG) — Shop, OG history, Hand out items, atbp.
   Iba ang tab bawat role; tingnan ang pages/Rewards.jsx at
   OG_REWARDS_SHOP.sql */
const REWARDS = { label: 'Rewards', to: '/rewards', icon: '❖' }

/* Organization Health — score ng org, galing sa attendance sa
   lahat ng natapos na event. Adviser: sariling org · SAO at
   School Head: lahat ng org. Hindi kasama ang IT Admin
   (ibinalik sa SAO — SAO_ORG_HEALTH.sql).
   Tingnan ang pages/OrgHealth.jsx at ORG_HEALTH.sql */
const ORG_HEALTH = { label: 'Org Health', to: '/org-health', icon: '✚' }

/* School Administrator lang (SCHOOL_ADMIN_SUPERADMIN.sql) —
   pages/Organizations.jsx at pages/Users.jsx */
const ORGANIZATIONS = { label: 'Organizations', to: '/organizations', icon: '◈' }
const USERS = { label: 'Users', to: '/users', icon: '▲' }

/* May kapangyarihan ba ng Adviser sa org niya (Events, Attendance,
   OG shop, atbp.)? Adviser lang.

   Dati ay kasama ang School Administrator kapag may "acting org"
   siya. Inalis na iyon: walang org ang SA at hindi na siya
   humahawak ng Events, Attendance at Rewards
   (SA_REMOVE_ACTING_ORG.sql).

   Para lang sa pagpapakita ng button; ang database pa rin ang
   totoong nagbabantay. */
export function hasAdviserPowers(profile) {
  return Boolean(profile?.is_active && profile.role_id === 3)
}

export function isSchoolAdmin(profile) {
  return Boolean(profile?.is_active && profile.role_id === 8)
}

/* ============================================================
   MGA KAKAYAHAN (capabilities)

   Dati ay isang "canManage" lang ito. Hinati ko na sa dalawa
   dahil ang Officer at Adviser ay may PAREHONG sidebar pero
   MAGKAIBANG trabaho:

     create — hindi na ito ginagamit ng anumang button. Ang
              "+ Create Event" sa Events page ay para sa Officer
              lang — tingnan ang canCreateEvents() sa lib/events.js.

     review — siya ang umaaksyon sa mga proposal: nakikita
              niya ang Proposals at may Aprubahan/Tanggihan

     propose — pwedeng gumawa ng proposal (pormal na sulat)
              para sa org niya. Walang pag-edit; ang pag-delete
              ay sariling gawa lang, habang naghihintay pa — tingnan ang
              canManageProposal() sa lib/proposals.js.

     announce — pwedeng gumawa ng announcement para sa org
              niya. Ang pag-edit/pag-delete ng BAWAT post ay
              nakadepende pa kung sino ang gumawa — tingnan ang
              canManageAnnouncement() sa lib/announcements.js.
              Hiwalay ito sa "create" dahil ang Officer ay
              nagpapaskil pero hindi gumagawa ng events.

     assignPositions — nagbibigay ng officer position (President,
              VP, atbp.) sa mga member ng org sa Members page
              (School Administrator: sa Users page na).
              May position → Officer; tinanggal → Member.
              Tingnan ang lib/officerPositions.js at
              OFFICER_POSITIONS.sql.

   Member  : tumitingin lang        → wala
   Officer : nagpapasa ng proposal at nagpapaskil ng
             announcement           → review + announce + propose
   Adviser : gumagawa ng events at announcements, at sumusuri
             rin                    → create + review + announce
                                      + assignPositions
   IT Admin: Dashboard lang, walang kakayahan → wala
             (REMOVE_IT_ADMIN_FUNCTIONS.sql)

   DITO KA MAGDAGDAG kapag nagkaroon na ng totoong function.
   Halimbawa, kung may role na makakabura: dagdagan ng
   "remove: true" dito, tapos sa page: {can.remove && ...}
   ============================================================ */

function staffRole(label) {
  return {
    label,
    can: { create: false, review: false, announce: false, propose: false, assignPositions: false },
    sidebar: [DASHBOARD, MEMBERS, PROFILE],
    /* Inalis na ang "Sections" cards (Members, Profile) sa
       Dashboard — nasa sidebar na sila. */
    dashboard: {
      stats: [],
    },
  }
}

/* Staff na sumusuri rin ng Proposals (SAO, School Head).
   review: true — may Approve/Reject sila kapag nasa stage nila
   ang proposal (tingnan ang canReviewProposal() sa
   lib/proposals.js).

   orgHealth: true — may Org Health sa sidebar (School Head;
   ang SAO ay may sariling sidebar sa ibaba na may Org Health din).

   Walang hiwalay na Proposals card sa Dashboard nila — ang stat na
   "Proposals awaiting your action" na ang link papunta sa Proposals. */
function staffRoleWithProposals(label, { orgHealth = false } = {}) {
  const base = staffRole(label)
  return {
    ...base,

    /* May notification bell sa Dashboard: realtime na dating ng
       proposal na naghihintay ng aksyon nila
       (PROPOSAL_REVIEW_NOTIFICATIONS.sql) */
    notifications: true,

    can: { ...base.can, review: true },
    sidebar: orgHealth
      ? [DASHBOARD, MEMBERS, PROPOSALS, ORG_HEALTH, PROFILE]
      : [DASHBOARD, MEMBERS, PROPOSALS, PROFILE],
    dashboard: {
      ...base.dashboard,
      stats: [
        {
          label: 'Proposals awaiting your action',
          value: '0',
          to: '/proposals',
          key: 'pendingProposals',
        },
      ],
    },
  }
}

export const ROLES = {
  /* ---------------------------------------------------------- */
  [ROLE_KEYS.MEMBER]: {
    label: 'Member',

    /* May notification bell sa Dashboard (UI lang muna) */
    notifications: true,

    /* May Event Calendar sa Dashboard (UI lang muna, wala pang data) */
    calendar: true,

    can: {
      create: false,
      review: false,
      announce: false,
      propose: false,
      assignPositions: false,
    },

    sidebar: [DASHBOARD, EVENTS, ANNOUNCEMENTS, ATTENDANCE, REWARDS, PROFILE],

    dashboard: {
      /* BENTO LAYOUT (Member, Officer, Adviser)
         Pagbati + 4 na stat tile sa iisang grid, tapos ang
         Event Calendar na may listahan ng events sa gilid.
         Tingnan ang renderBentoTile() at BENTO_LAYOUTS sa
         pages/Dashboard.jsx. Ang staff roles (SAO, School Head,
         School Administrator) at ang IT Admin ay nasa lumang layout pa. */
      layout: 'bento',

      stats: [
        { label: 'Upcoming events', value: '0', to: '/events', key: 'upcomingEvents' },
        {
          label: 'New announcements',
          tag: 'Last 7 days',
          value: '0',
          to: '/announcements',
          key: 'newAnnouncements',
        },
        { label: 'Your attendance rate', value: '—', to: '/attendance', key: 'attendanceRate' },
        { label: 'Your Organization Gems', value: '0', to: '/rewards', key: 'ogBalance' },
      ],
    },
  },

  /* ---------------------------------------------------------- */
  [ROLE_KEYS.OFFICER]: {
    label: 'Officer',

    /* May notification bell sa Dashboard (UI lang muna) */
    notifications: true,

    /* May Event Calendar sa Dashboard (UI lang muna, wala pang data) */
    calendar: true,

    /* Nagpapasa siya ng proposal. Dadaan ito sa Adviser, SAO,
       at School Head. Kapag na-approve ng School Head (pinal),
       SIYA (ang nagpasa) ang gagawa ng event mula
       roon — "+ Create Event" sa Events page.
       Pwede rin siyang magpaskil ng announcement. */
    can: {
      create: false,
      review: true,
      announce: true,
      propose: true,
      assignPositions: false,
    },

    sidebar: [
      DASHBOARD,
      EVENTS,
      ANNOUNCEMENTS,
      ATTENDANCE,
      MEMBERS,
      PROPOSALS,
      REWARDS,
      PROFILE,
    ],

    dashboard: {
      /* Kaparehong UI ng Member (bento): 5 stat at Event Calendar.
         Inalis na ang "Sections" cards — nasa sidebar na sila. */
      layout: 'bento',

      stats: [
        { label: 'Pending proposals', value: '0', to: '/proposals', key: 'pendingProposals' },
        { label: 'Total members', value: '0', to: '/members', key: 'memberCount' },
        { label: 'Org attendance rate', value: '—', to: '/attendance', key: 'attendanceRate' },
        /* Sariling attendance ng Officer (sa mga event na sinalihan
           niya). Bubuksan ang tab na "Sinalihan ko" sa Attendance. */
        {
          label: 'Your attendance rate',
          value: '—',
          to: '/attendance',
          state: { tab: 'mine' },
          key: 'myAttendanceRate',
        },
        { label: 'Your Organization Gems', value: '0', to: '/rewards', key: 'ogBalance' },
      ],
    },
  },

  /* ---------------------------------------------------------- */
  [ROLE_KEYS.ADVISER]: {
    label: 'Adviser',

    /* May notification bell sa Dashboard (UI lang muna) */
    notifications: true,

    /* May Event Calendar sa Dashboard (UI lang muna, wala pang data) */
    calendar: true,

    /* Halos PAREHO ang sidebar niya sa Officer (may dagdag na
       Org Profile) — pero siya ang
       may pinakamalawak na kapangyarihan sa organisasyon.
       Gumagawa siya ng events at announcements, at sumusuri
       rin sa mga proposal. */
    can: {
      create: true,
      review: true,
      announce: true,
      propose: false,
      assignPositions: true,
    },

    sidebar: [
      DASHBOARD,
      EVENTS,
      ANNOUNCEMENTS,
      ATTENDANCE,
      MEMBERS,
      PROPOSALS,
      REWARDS,
      ORG_HEALTH,
      ORG_PROFILE,
      PROFILE,
    ],

    dashboard: {
      /* Kaparehong UI ng Member (bento): 3 stat at Event Calendar.
         Inalis na ang "Sections" cards — nasa sidebar na sila. */
      layout: 'bento',

      stats: [
        { label: 'Proposals awaiting your action', value: '0', to: '/proposals', key: 'pendingProposals' },
        { label: 'Active members', value: '0', to: '/members', key: 'memberCount' },
        { label: 'Org attendance rate', value: '—', to: '/attendance', key: 'attendanceRate' },
      ],
    },
  },

  /* ----------------------------------------------------------
     STAFF ROLES (SAO, School Head, School Administrator)

     Panimulang config lang ito para may makita sila pagka-login.
     Dahil sa RLS (is_staff), nakikita nila ang profiles ng LAHAT
     ng organisasyon sa Members page.

     Kapag may sariling page na sila (hal. pamamahala ng
     student_records para sa SAO):
       1. gumawa ng page
       2. irehistro sa PAGE_COMPONENTS sa App.jsx
       3. idagdag sa sidebar nila dito
     ---------------------------------------------------------- */
  /* SAO at School Head: tulad ng ibang staff, pero may
     Proposals din, ng LAHAT ng organisasyon.

     Daloy: Officer → Adviser → SAO → School Head (→ SA kapag may budget)
       SAO         → Approve/Reject pagkatapos ng Adviser;
                     tuloy pa rin sa School Head anuman ang piliin
       School Head → PINAL na Approve/Reject kapag WALANG budget;
                     kapag MAY budget, tuloy pa sa School Administrator

     Kailangan sa Supabase:
       ADD_SCHOOL_HEAD_PROPOSALS_READ.sql (makabasa)
       PROPOSAL_THREE_STEP_REVIEW.sql     (makaaksyon) */
  [ROLE_KEYS.SAO]: {
    ...staffRoleWithProposals('SAO'),

    /* EVENT CALENDAR SA DASHBOARD NG SAO
       Events ng LAHAT ng aktibong organisasyon — iisang calendar
       na ginagamit din ng Member, Officer at Adviser
       (components/DashboardCalendar.jsx). Lumalabas ito sa ilalim
       ng "Proposals awaiting your action" (staff layout sa
       pages/Dashboard.jsx).

       Walang bagong SQL na kailangan: ang calendar_events() sa
       Supabase ay gumagana na sa kahit sinong aktibong naka-login,
       may org man o wala.

       Walang sariling org ang SAO, kaya is_own_org = false sa
       lahat ng event. Pero dahil may Events page na siya, may
       "View in Events →" sa BAWAT event, papunta mismo sa event
       na iyon (/events?event=<id>). */
    calendar: true,

    /* EVENTS PAGE NG SAO (SAO_EVENTS_READ.sql)
       Listahan ng events ng LAHAT ng aktibong organisasyon, may
       pangalan ng org, filter ayon sa org, bilang ng sumali, at
       "View details" para sa kumpletong detalye.
       Basa lang — walang Join, Edit, Delete o Certificates.
       Tingnan ang canViewAllEvents() sa lib/events.js.

       ORG HEALTH NG SAO — KAPAREHO NG SCHOOL HEAD
       (SAO_ORG_HEALTH.sql): listahan ng LAHAT ng org sa Org
       Health page, at ang buod (OrgHealthOverview) sa Dashboard.
       Tingnan ang seesAllOrgHealth() sa lib/orgHealth.js.

       USERS NG SAO (SAO_USERS_READ.sql) — PINALITAN ang Members.
       Kaparehong Users page ng School Administrator (lahat ng
       nasa student_records, may status ng login), pero BASA LANG:
       walang Add user, Edit, Remove o Set position.
       Tingnan ang canManage sa pages/Users.jsx. */
    sidebar: [DASHBOARD, EVENTS, USERS, PROPOSALS, ORG_HEALTH, PROFILE],
  },
  [ROLE_KEYS.SCHOOL_HEAD]: {
    ...staffRoleWithProposals('School Head', { orgHealth: true }),

    /* EVENT CALENDAR SA DASHBOARD NG SCHOOL HEAD — KAPAREHO NG SAO
       Events ng LAHAT ng aktibong organisasyon (calendar_events(),
       walang bagong SQL para dito). Walang sariling org ang School
       Head, pero dahil may Events page na siya, may
       "View in Events →" sa BAWAT event (/events?event=<id>). */
    calendar: true,

    /* EVENTS PAGE NG SCHOOL HEAD — KAPAREHO NG SAO
       (SCHOOL_HEAD_EVENTS_READ.sql)
       Listahan ng events ng LAHAT ng aktibong organisasyon, may
       pangalan ng org, filter ayon sa org, bilang ng sumali, at
       "View details" para sa kumpletong detalye.
       Basa lang — walang Join, Edit, Delete o Certificates.
       Tingnan ang canViewAllEvents() sa lib/events.js.
       Naiwan ang Org Health (kapareho na rin ng SAO). */
    sidebar: [DASHBOARD, EVENTS, MEMBERS, PROPOSALS, ORG_HEALTH, PROFILE],
  },

  /* School Administrator — PINAL na Approve/Reject ng mga proposal
     na MAY BUDGET (Adviser → SAO → School Head → SA). Ang walang
     budget ay hindi na dumadaan sa kanya, at hindi rin niya nakikita
     (RLS: proposals_read_staff).

     Dashboard:
       "Proposals" → Pending proposals: mga budget proposal na
                     nasa SA na at IKAW ang hinihintay (hindi mo pa
                     naaaksyunan). Kapareho ng sa SAO / School Head —
                     countPendingProposals() sa lib/proposals.js.
                     Realtime: nag-a-update kapag may notification
                     tungkol sa proposal.
       "School overview" → Active organizations (→ Organizations) at
                     Active members (→ Users).
                     Galing sa school_admin_overview() (lib/schoolAdmin.js).

     Inalis na sa Dashboard: ang grupong "Budget proposals"
     (Still with Adviser / SAO / School Head, Approved, Rejected),
     ang "Officers" stat, at ang Sections cards (Members, Profile).
     Ibinalik lang ang "Pending proposals" (nasa itaas). Nasa sidebar
     pa rin ang Proposals at Profile.

     SUPERADMIN (SCHOOL_ADMIN_SUPERADMIN.sql):
       Organizations → gumawa, mag-edit, mag-deactivate ng org,
                       at piliin ang "special org". Nasa Edit na rin
                       ang dating Org Profile: logo at officer
                       positions ng KAHIT ANONG org
                       (SA_ORG_LOGO_ANY_ORG.sql para sa logo)
       Users         → magdagdag/mag-edit ng student record, magpalit
                       ng role at org, mag-deactivate, at "Set
                       position" sa kahit anong org. May Status din
                       kung naka-login na ang tao
                       (SA_USERS_LOGIN_STATUS.sql para sa huling login)
       Announcements → nagpo-post para sa LAHAT o sa PILING org (walang
                       "My organization only" dahil wala siyang org).
                       Nakikita at naa-edit/nabubura niya ang lahat ng
                       announcement.

     WALA NANG MEMBERS PAGE ANG SA. Inilipat na sa Users ang lahat ng
     ginagawa niya roon (profile picture, officer position bilang
     Role, "Set position"). Ang Users ay kumpleto pa: kasama pati ang
     hindi pa nakaka-login. Dahil wala na sa sidebar, wala na rin
     siyang /members na route (ibabalik siya sa dashboard).

     INALIS NA (SA_REMOVE_ACTING_ORG.sql): ang "acting org" /
     Managing organization, Org Profile, Events, Attendance at
     Rewards. Laging walang org ang SA (profiles.organization_id =
     null — may constraint sa database).

     Hindi nagbago ang proposal flow: budget proposals pa rin lang.

     Kailangan sa Supabase: ADD_SCHOOL_ADMINISTRATOR.sql,
     SCHOOL_ADMIN_SUPERADMIN.sql, SA_ORG_LOGO_ANY_ORG.sql,
     SA_REMOVE_ACTING_ORG.sql at SA_USERS_LOGIN_STATUS.sql */
  [ROLE_KEYS.SCHOOL_ADMIN]: (() => {
    const base = staffRoleWithProposals('School Administrator')
    const PROPOSALS_GROUP = 'Proposals'
    const SCHOOL_GROUP = 'School overview'
    return {
      ...base,
      can: {
        ...base.can,
        announce: true,
        assignPositions: true,
      },
      sidebar: [
        DASHBOARD,
        ORGANIZATIONS,
        USERS,
        PROPOSALS,
        ANNOUNCEMENTS,
        PROFILE,
      ],
      dashboard: {
        ...base.dashboard,
        stats: [
          {
            label: 'Pending proposals',
            value: '0',
            to: '/proposals',
            key: 'pendingProposals',
            group: PROPOSALS_GROUP,
          },
          {
            label: 'Active organizations',
            value: '0',
            to: '/organizations',
            key: 'saOrganizations',
            group: SCHOOL_GROUP,
          },
          {
            label: 'Active members',
            value: '0',
            to: '/users',
            key: 'saMembers',
            group: SCHOOL_GROUP,
          },
        ],
      },
    }
  })(),
  /* IT Administrator — inalis na ang lahat ng kakayahan niya
     (REMOVE_IT_ADMIN_FUNCTIONS.sql). Nananatili ang role sa
     database at nakakapag-login pa rin siya, pero Dashboard na
     lang ang nakikita niya. Walang Members, Profile, o "Set
     position". */
  [ROLE_KEYS.IT_ADMIN]: {
    label: 'IT Administrator',
    can: { create: false, review: false, announce: false, propose: false, assignPositions: false },
    sidebar: [DASHBOARD],
    dashboard: { stats: [] },
  },
}

/* Ginagamit kapag hindi kilala ang role — halimbawa, kung
   walang role_id ang profile o hindi pa kilala ang role_id. Kaunti lang ang laman
   para hindi masira ang app. */
export const FALLBACK_ROLE = {
  label: 'No role',
  can: { create: false, review: false, announce: false, propose: false, assignPositions: false },
  sidebar: [DASHBOARD, PROFILE],
  dashboard: { stats: [] },
}

/* Laging gamitin ito imbes na direktang ROLES[role] —
   hindi ito babagsak kapag null o mali ang role. */
export function getRoleConfig(role) {
  return ROLES[role] ?? FALLBACK_ROLE
}