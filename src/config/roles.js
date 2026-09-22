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
  COORDINATOR: 'coordinator',
  SCHOOL_HEAD: 'school_head',
  IT_ADMIN: 'it_admin',
}

/* Katumbas ng laman ng public.roles sa database.
   Kapag nagdagdag ka ng role doon, dagdagan mo rin dito. */
export const ROLE_ID_TO_KEY = {
  1: ROLE_KEYS.MEMBER,
  2: ROLE_KEYS.OFFICER,
  3: ROLE_KEYS.ADVISER,
  4: ROLE_KEYS.SAO,
  5: ROLE_KEYS.COORDINATOR,
  6: ROLE_KEYS.SCHOOL_HEAD,
  7: ROLE_KEYS.IT_ADMIN,
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

/* ============================================================
   MGA KAKAYAHAN (capabilities)

   Dati ay isang "canManage" lang ito. Hinati ko na sa dalawa
   dahil ang Officer at Adviser ay may PAREHONG sidebar pero
   MAGKAIBANG trabaho:

     create — kaya niyang gumawa: may "+ Gumawa ng Event" at
              iba pang button siya sa kanang itaas

     review — siya ang umaaksyon sa mga proposal: nakikita
              niya ang Proposals at may Aprubahan/Tanggihan

     announce — pwedeng gumawa ng announcement para sa org
              niya. Ang pag-edit/pag-delete ng BAWAT post ay
              nakadepende pa kung sino ang gumawa — tingnan ang
              canManageAnnouncement() sa lib/announcements.js.
              Hiwalay ito sa "create" dahil ang Officer ay
              nagpapaskil pero hindi gumagawa ng events.

   Member  : tumitingin lang        → wala
   Officer : sumusuri at umaaksyon sa mga proposal, at
             nagpapaskil            → review + announce
   Adviser : gumagawa ng events at announcements, at sumusuri
             rin                    → create + review + announce

   DITO KA MAGDAGDAG kapag nagkaroon na ng totoong function.
   Halimbawa, kung may role na makakabura: dagdagan ng
   "remove: true" dito, tapos sa page: {can.remove && ...}
   ============================================================ */

function staffRole(label) {
  return {
    label,
    can: { create: false, review: false, announce: false },
    sidebar: [DASHBOARD, MEMBERS, PROFILE],
    dashboard: {
      subtitle: 'Tanaw sa lahat ng organisasyon at miyembro.',
      stats: [],
      cards: [
        {
          to: '/members',
          icon: '▲',
          title: 'Members',
          text: 'Tingnan ang mga miyembro ng lahat ng organisasyon.',
        },
        {
          to: '/profile',
          icon: '●',
          title: 'Profile',
          text: 'Tingnan ang iyong impormasyon.',
        },
      ],
    },
  }
}

export const ROLES = {
  /* ---------------------------------------------------------- */
  [ROLE_KEYS.MEMBER]: {
    label: 'Member',

    can: {
      create: false,
      review: false,
      announce: false,
    },

    sidebar: [DASHBOARD, EVENTS, ANNOUNCEMENTS, ATTENDANCE, PROFILE],

    dashboard: {
      subtitle: 'Narito ang mabilisang tanaw ng organisasyon.',
      stats: [
        { label: 'Paparating na events', value: '0', to: '/events' },
        {
          label: 'Bagong announcements (7 araw)',
          value: '0',
          to: '/announcements',
          key: 'newAnnouncements',
        },
        { label: 'Attendance rate', value: '—', to: '/attendance' },
      ],
      cards: [
        {
          to: '/events',
          icon: '◆',
          title: 'Events',
          text: 'Tingnan ang mga paparating na aktibidad at mag-sign up.',
        },
        {
          to: '/announcements',
          icon: '★',
          title: 'Announcements',
          text: 'Basahin ang pinakabagong balita mula sa organisasyon.',
        },
        {
          to: '/attendance',
          icon: '✓',
          title: 'Attendance',
          text: 'Suriin ang iyong record ng pagdalo.',
        },
      ],
    },
  },

  /* ---------------------------------------------------------- */
  [ROLE_KEYS.OFFICER]: {
    label: 'Officer',

    /* Hindi siya gumagawa ng event — sumusuri siya at
       umaaksyon sa mga proposal. Pero pwede siyang
       magpaskil ng announcement para sa org niya. */
    can: {
      create: false,
      review: true,
      announce: true,
    },

    sidebar: [
      DASHBOARD,
      EVENTS,
      ANNOUNCEMENTS,
      ATTENDANCE,
      MEMBERS,
      PROPOSALS,
      PROFILE,
    ],

    dashboard: {
      subtitle: 'Suriin at aksyunan ang mga proposal ng organisasyon.',
      stats: [
        { label: 'Naghihintay na proposals', value: '0', to: '/proposals' },
        { label: 'Aktibong events', value: '0', to: '/events' },
        { label: 'Kabuuang miyembro', value: '0', to: '/members', key: 'memberCount' },
        { label: 'Attendance ngayong buwan', value: '—', to: '/attendance' },
      ],
      cards: [
        {
          to: '/proposals',
          icon: '✉',
          title: 'Proposals',
          text: 'Suriin ang mga proposal na naghihintay ng aksyon.',
        },
        {
          to: '/events',
          icon: '◆',
          title: 'Events',
          text: 'Tingnan ang mga paparating at natapos nang aktibidad.',
        },
        {
          to: '/members',
          icon: '▲',
          title: 'Members',
          text: 'Tingnan ang listahan ng mga miyembro ng organisasyon.',
        },
        {
          to: '/announcements',
          icon: '★',
          title: 'Magpaskil',
          text: 'Maglabas ng balita at paalala sa mga miyembro.',
        },
      ],
    },
  },

  /* ---------------------------------------------------------- */
  [ROLE_KEYS.ADVISER]: {
    label: 'Adviser',

    /* PAREHO ang sidebar niya sa Officer — pero siya ang
       may pinakamalawak na kapangyarihan sa organisasyon.
       Gumagawa siya ng events at announcements, at sumusuri
       rin sa mga proposal. */
    can: {
      create: true,
      review: true,
      announce: true,
    },

    sidebar: [
      DASHBOARD,
      EVENTS,
      ANNOUNCEMENTS,
      ATTENDANCE,
      MEMBERS,
      PROPOSALS,
      PROFILE,
    ],

    dashboard: {
      subtitle: 'Pamahalaan at bantayan ang organisasyon.',
      stats: [
        { label: 'Aktibong events', value: '0', to: '/events' },
        { label: 'Naghihintay na proposals', value: '0', to: '/proposals' },
        { label: 'Aktibong miyembro', value: '0', to: '/members', key: 'memberCount' },
        { label: 'Attendance rate', value: '—', to: '/attendance' },
      ],
      cards: [
        {
          to: '/events',
          icon: '◆',
          title: 'Pamahalaan ang Events',
          text: 'Gumawa, baguhin, o kanselahin ang mga aktibidad.',
        },
        {
          to: '/announcements',
          icon: '★',
          title: 'Magpaskil',
          text: 'Maglabas ng balita at paalala sa mga miyembro.',
        },
        {
          to: '/proposals',
          icon: '✉',
          title: 'Proposals',
          text: 'Suriin ang mga proposal na naghihintay ng aksyon.',
        },
        {
          to: '/attendance',
          icon: '✓',
          title: 'Attendance',
          text: 'Tingnan ang pagdalo ng buong organisasyon.',
        },
      ],
    },
  },

  /* ----------------------------------------------------------
     STAFF ROLES (SAO, SHS/Tertiary, School Head, IT Admin)

     Panimulang config lang ito para may makita sila pagka-login.
     Dahil sa RLS (is_staff), nakikita nila ang profiles ng LAHAT
     ng organisasyon sa Members page.

     Kapag may sariling page na sila (hal. pamamahala ng
     student_records para sa SAO at IT Admin):
       1. gumawa ng page
       2. irehistro sa PAGE_COMPONENTS sa App.jsx
       3. idagdag sa sidebar nila dito
     ---------------------------------------------------------- */
  [ROLE_KEYS.SAO]: staffRole('SAO'),
  [ROLE_KEYS.COORDINATOR]: staffRole('SHS/Tertiary'),
  [ROLE_KEYS.SCHOOL_HEAD]: staffRole('School Head'),
  [ROLE_KEYS.IT_ADMIN]: staffRole('IT Administrator'),
}

/* Ginagamit kapag hindi kilala ang role — halimbawa, kung
   walang role_id ang profile o hindi pa kilala ang role_id. Kaunti lang ang laman
   para hindi masira ang app. */
export const FALLBACK_ROLE = {
  label: 'Walang role',
  can: { create: false, review: false, announce: false },
  sidebar: [DASHBOARD, PROFILE],
  dashboard: { subtitle: '', stats: [], cards: [] },
}

/* Laging gamitin ito imbes na direktang ROLES[role] —
   hindi ito babagsak kapag null o mali ang role. */
export function getRoleConfig(role) {
  return ROLES[role] ?? FALLBACK_ROLE
}
