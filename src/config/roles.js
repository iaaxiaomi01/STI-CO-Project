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
   │  role_id niya sa profiles table (IT Admin lang ang     │
   │  may pahintulot, dahil sa RLS at guard trigger).       │
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
const ORG_PROFILE = { label: 'Org Profile', to: '/org-profile', icon: '◈' }

/* Organization Gems (OG) — Shop, Release OG, Event rewards, atbp.
   Iba ang tab bawat role; tingnan ang pages/Rewards.jsx at
   OG_REWARDS_SHOP.sql */
const REWARDS = { label: 'Rewards', to: '/rewards', icon: '❖' }

/* Organization Health — score ng org, galing sa attendance sa
   lahat ng natapos na event. Adviser: sariling org · School
   Head: lahat ng org. Hindi kasama ang SAO at IT Admin
   (inalis sa SAO — REMOVE_SAO_ORG_HEALTH.sql).
   Tingnan ang pages/OrgHealth.jsx at ORG_HEALTH.sql */
const ORG_HEALTH = { label: 'Org Health', to: '/org-health', icon: '✚' }

/* ============================================================
   MGA KAKAYAHAN (capabilities)

   Dati ay isang "canManage" lang ito. Hinati ko na sa dalawa
   dahil ang Officer at Adviser ay may PAREHONG sidebar pero
   MAGKAIBANG trabaho:

     create — kaya niyang gumawa: may "+ Gumawa ng Event" at
              iba pang button siya sa kanang itaas

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
              VP, atbp.) sa mga member ng org sa Members page.
              May position → Officer; tinanggal → Member.
              Tingnan ang lib/officerPositions.js at
              OFFICER_POSITIONS.sql.

   Member  : tumitingin lang        → wala
   Officer : nagpapasa ng proposal at nagpapaskil ng
             announcement           → review + announce + propose
   Adviser : gumagawa ng events at announcements, at sumusuri
             rin                    → create + review + announce
                                      + assignPositions
   IT Admin: may hawak ng lahat ng account → assignPositions

   DITO KA MAGDAGDAG kapag nagkaroon na ng totoong function.
   Halimbawa, kung may role na makakabura: dagdagan ng
   "remove: true" dito, tapos sa page: {can.remove && ...}
   ============================================================ */

function staffRole(label) {
  return {
    label,
    can: { create: false, review: false, announce: false, propose: false, assignPositions: false },
    sidebar: [DASHBOARD, MEMBERS, PROFILE],
    dashboard: {
      stats: [],
      cards: [
        {
          to: '/members',
          icon: '▲',
          title: 'Members',
        },
        {
          to: '/profile',
          icon: '●',
          title: 'Profile',
        },
      ],
    },
  }
}

/* Staff na sumusuri rin ng Proposals (SAO, School Head).
   review: true — may Approve/Reject sila kapag nasa stage nila
   ang proposal (tingnan ang canReviewProposal() sa
   lib/proposals.js).

   orgHealth: true — may Org Health sa sidebar (School Head lang;
   inalis na sa SAO).

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
      stats: [
        { label: 'Upcoming events', value: '0', to: '/events', key: 'upcomingEvents' },
        {
          label: 'New announcements (7 days)',
          value: '0',
          to: '/announcements',
          key: 'newAnnouncements',
        },
        { label: 'Your attendance rate', value: '—', to: '/attendance', key: 'attendanceRate' },
        { label: 'Your Organization Gems', value: '0', to: '/rewards', key: 'ogBalance' },
      ],
      cards: [
        {
          to: '/rewards',
          icon: '❖',
          title: 'Rewards Shop',
        },
        {
          to: '/announcements',
          icon: '★',
          title: 'Announcements',
        },
        {
          to: '/attendance',
          icon: '✓',
          title: 'Attendance',
        },
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
       roon — "+ Gumawa ng Event" sa Proposals page.
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
      cards: [
        {
          to: '/proposals',
          icon: '✉',
          title: 'Proposals',
        },
        {
          to: '/members',
          icon: '▲',
          title: 'Members',
        },
        {
          to: '/announcements',
          icon: '★',
          title: 'Announcements',
        },
        {
          to: '/rewards',
          icon: '❖',
          title: 'Rewards',
        },
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
      stats: [
        { label: 'Proposals awaiting your action', value: '0', to: '/proposals', key: 'pendingProposals' },
        { label: 'Active members', value: '0', to: '/members', key: 'memberCount' },
        { label: 'Org attendance rate', value: '—', to: '/attendance', key: 'attendanceRate' },
      ],
      cards: [
        {
          to: '/org-profile',
          icon: '◈',
          title: 'Org Profile',
        },
        {
          to: '/announcements',
          icon: '★',
          title: 'Announcements',
        },
        {
          to: '/proposals',
          icon: '✉',
          title: 'Proposals',
        },
        {
          to: '/attendance',
          icon: '✓',
          title: 'Attendance',
        },
        {
          to: '/org-health',
          icon: '✚',
          title: 'Org Health',
        },
        {
          to: '/rewards',
          icon: '❖',
          title: 'Rewards',
        },
      ],
    },
  },

  /* ----------------------------------------------------------
     STAFF ROLES (SAO, School Head, IT Admin)

     Panimulang config lang ito para may makita sila pagka-login.
     Dahil sa RLS (is_staff), nakikita nila ang profiles ng LAHAT
     ng organisasyon sa Members page.

     Kapag may sariling page na sila (hal. pamamahala ng
     student_records para sa SAO at IT Admin):
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
  [ROLE_KEYS.SAO]: staffRoleWithProposals('SAO'),
  [ROLE_KEYS.SCHOOL_HEAD]: staffRoleWithProposals('School Head', { orgHealth: true }),

  /* School Administrator — PINAL na Approve/Reject ng mga proposal
     na MAY BUDGET (Adviser → SAO → School Head → SA). Ang walang
     budget ay hindi na dumadaan sa kanya, at hindi rin niya nakikita
     (RLS: proposals_read_staff).

     Dashboard: dalawang grupo ng stat (may "group" ang bawat isa —
     tingnan ang Dashboard.jsx). Lahat ng numero ay galing sa iisang
     tawag: school_admin_overview() (lib/schoolAdmin.js), maliban sa
     "awaiting your action" na kapareho ng sa SAO / School Head.

     Kailangan sa Supabase: ADD_SCHOOL_ADMINISTRATOR.sql */
  [ROLE_KEYS.SCHOOL_ADMIN]: (() => {
    const base = staffRoleWithProposals('School Administrator')
    const PROPOSALS_GROUP = 'Budget proposals'
    const SCHOOL_GROUP = 'School overview'
    return {
      ...base,
      dashboard: {
        ...base.dashboard,
        stats: [
          {
            label: 'Awaiting your action',
            value: '0',
            to: '/proposals',
            key: 'pendingProposals',
            group: PROPOSALS_GROUP,
          },
          {
            label: 'Still with Adviser / SAO / School Head',
            value: '0',
            to: '/proposals',
            key: 'saOnTheWay',
            group: PROPOSALS_GROUP,
          },
          {
            label: 'Approved',
            value: '0',
            to: '/proposals',
            key: 'saApproved',
            group: PROPOSALS_GROUP,
          },
          {
            label: 'Rejected',
            value: '0',
            to: '/proposals',
            key: 'saRejected',
            group: PROPOSALS_GROUP,
          },
          {
            label: 'Active organizations',
            value: '0',
            to: '/members',
            key: 'saOrganizations',
            group: SCHOOL_GROUP,
          },
          {
            label: 'Active members',
            value: '0',
            to: '/members',
            key: 'saMembers',
            group: SCHOOL_GROUP,
          },
          {
            label: 'Officers',
            value: '0',
            to: '/members',
            key: 'saOfficers',
            group: SCHOOL_GROUP,
          },
        ],
      },
    }
  })(),
  /* Kaya rin niyang magbigay ng officer position sa kahit anong
     org (sa Members page). */
  [ROLE_KEYS.IT_ADMIN]: (() => {
    const base = staffRole('IT Administrator')
    return { ...base, can: { ...base.can, assignPositions: true } }
  })(),
}

/* Ginagamit kapag hindi kilala ang role — halimbawa, kung
   walang role_id ang profile o hindi pa kilala ang role_id. Kaunti lang ang laman
   para hindi masira ang app. */
export const FALLBACK_ROLE = {
  label: 'No role',
  can: { create: false, review: false, announce: false, propose: false, assignPositions: false },
  sidebar: [DASHBOARD, PROFILE],
  dashboard: { stats: [], cards: [] },
}

/* Laging gamitin ito imbes na direktang ROLES[role] —
   hindi ito babagsak kapag null o mali ang role. */
export function getRoleConfig(role) {
  return ROLES[role] ?? FALLBACK_ROLE
}