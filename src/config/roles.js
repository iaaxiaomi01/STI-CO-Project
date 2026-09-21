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
const REQUESTS = { label: 'Requests', to: '/requests', icon: '✉' }
const PROFILE = { label: 'Profile', to: '/profile', icon: '●' }

/* ============================================================
   MGA KAKAYAHAN (capabilities)

   Dati ay isang "canManage" lang ito. Hinati ko na sa dalawa
   dahil ang Officer at Adviser ay may PAREHONG sidebar pero
   MAGKAIBANG trabaho:

     create — kaya niyang gumawa: may "+ Gumawa ng Event" at
              iba pang button siya sa kanang itaas

     review — siya ang umaaksyon sa mga kahilingan: nakikita
              niya ang Requests at may Aprubahan/Tanggihan

   Member  : tumitingin lang        → wala
   Officer : hindi gumagawa — sumusuri at umaaksyon sa mga
             kahilingan             → review lang
   Adviser : gumagawa ng events at announcements, at sumusuri
             rin                    → create + review

   DITO KA MAGDAGDAG kapag nagkaroon na ng totoong function.
   Halimbawa, kung may role na makakabura: dagdagan ng
   "remove: true" dito, tapos sa page: {can.remove && ...}
   ============================================================ */

function staffRole(label) {
  return {
    label,
    can: { create: false, review: false },
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
    },

    sidebar: [DASHBOARD, EVENTS, ANNOUNCEMENTS, ATTENDANCE, PROFILE],

    dashboard: {
      subtitle: 'Narito ang mabilisang tanaw ng organisasyon.',
      stats: [
        { label: 'Paparating na events', value: '0', to: '/events' },
        { label: 'Bagong announcements', value: '0', to: '/announcements' },
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

    /* Hindi siya gumagawa ng event o announcement — sumusuri
       siya at umaaksyon sa mga kahilingan. Kaya walang
       "+ Gumawa" na button sa kanya. */
    can: {
      create: false,
      review: true,
    },

    sidebar: [
      DASHBOARD,
      EVENTS,
      ANNOUNCEMENTS,
      ATTENDANCE,
      MEMBERS,
      REQUESTS,
      PROFILE,
    ],

    dashboard: {
      subtitle: 'Suriin at aksyunan ang mga kahilingan ng organisasyon.',
      stats: [
        { label: 'Naghihintay na requests', value: '0', to: '/requests' },
        { label: 'Aktibong events', value: '0', to: '/events' },
        { label: 'Kabuuang miyembro', value: '0', to: '/members', key: 'memberCount' },
        { label: 'Attendance ngayong buwan', value: '—', to: '/attendance' },
      ],
      cards: [
        {
          to: '/requests',
          icon: '✉',
          title: 'Requests',
          text: 'Suriin ang mga kahilingang naghihintay ng aksyon.',
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
      ],
    },
  },

  /* ---------------------------------------------------------- */
  [ROLE_KEYS.ADVISER]: {
    label: 'Adviser',

    /* PAREHO ang sidebar niya sa Officer — pero siya ang
       may pinakamalawak na kapangyarihan sa organisasyon.
       Gumagawa siya ng events at announcements, at sumusuri
       rin sa mga kahilingan. */
    can: {
      create: true,
      review: true,
    },

    sidebar: [
      DASHBOARD,
      EVENTS,
      ANNOUNCEMENTS,
      ATTENDANCE,
      MEMBERS,
      REQUESTS,
      PROFILE,
    ],

    dashboard: {
      subtitle: 'Pamahalaan at bantayan ang organisasyon.',
      stats: [
        { label: 'Aktibong events', value: '0', to: '/events' },
        { label: 'Naghihintay na requests', value: '0', to: '/requests' },
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
          to: '/requests',
          icon: '✉',
          title: 'Requests',
          text: 'Suriin ang mga kahilingang naghihintay ng aksyon.',
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
  can: { create: false, review: false },
  sidebar: [DASHBOARD, PROFILE],
  dashboard: { subtitle: '', stats: [], cards: [] },
}

/* Laging gamitin ito imbes na direktang ROLES[role] —
   hindi ito babagsak kapag null o mali ang role. */
export function getRoleConfig(role) {
  return ROLES[role] ?? FALLBACK_ROLE
}
