/* ============================================================
   ROLES CONFIG — ANG SENTRO NG BUONG SISTEMA

   Isang file ang naglalatag kung ano ang nakikita ng bawat
   role: anong sidebar items, at anong laman ng dashboard.

   BAKIT ISANG FILE LANG:
   Ang sidebar AT ang mga route ay parehong galing dito. Kaya
   imposibleng magkaroon ng link sa sidebar na walang route,
   o route na walang link.
   ============================================================ */

/* ┌────────────────────────────────────────────────────────┐
   │  ITO ANG LINYANG BABAGUHIN MO                          │
   │                                                        │
   │  Kung sino man ang naka-login, ito ang role niya.      │
   │  Kapag tapos ka na sa Officer, palitan mo ng 'adviser'  │
   │  at Adviser ka na sa susunod mong refresh.             │
   │                                                        │
   │  ⚠️  PANSAMANTALA ITO. Walang database pa, kaya walang │
   │  paraan para malaman kung sino talaga ang Officer.      │
   │  Kapag may profiles table na, ang isang linyang ito     │
   │  ang papalitan ng totoong role galing doon — at wala    │
   │  nang ibang file na gagalawin.                         │
   └────────────────────────────────────────────────────────┘ */
export const DEV_ROLE = 'officer'

/* Ang mga susi dito ay magiging role values sa database
   mamaya. Tandaan ang pagbabaybay. */
export const ROLE_KEYS = {
  MEMBER: 'member',
  OFFICER: 'officer',
}

/* Mga karaniwang sidebar item, para hindi paulit-ulit isulat */
const DASHBOARD = { label: 'Dashboard', to: '/dashboard', icon: '■' }
const EVENTS = { label: 'Events', to: '/events', icon: '◆' }
const ANNOUNCEMENTS = { label: 'Announcements', to: '/announcements', icon: '★' }
const ATTENDANCE = { label: 'Attendance', to: '/attendance', icon: '✓' }
const MEMBERS = { label: 'Members', to: '/members', icon: '▲' }
const REQUESTS = { label: 'Requests', to: '/requests', icon: '✉' }
const PROFILE = { label: 'Profile', to: '/profile', icon: '●' }

export const ROLES = {
  /* ---------------------------------------------------------- */
  [ROLE_KEYS.MEMBER]: {
    label: 'Member',

    /* Tumitingin lang — hindi gumagawa ng event o announcement.
       Ginagamit ito ng Events at Announcements pages para
       magpasya kung may lalabas na "Gumawa" na button. */
    canManage: false,

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

    /* Siya ang gumagawa ng event at announcement, kaya may
       dagdag na button siyang nakikita sa mga page na iyon. */
    canManage: true,

    /* Dagdag sa Member: ang Members list at ang Requests */
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
      subtitle: 'Pamahalaan ang mga aktibidad ng organisasyon.',
      stats: [
        { label: 'Aktibong events', value: '0', to: '/events' },
        { label: 'Naghihintay na requests', value: '0', to: '/requests' },
        { label: 'Kabuuang miyembro', value: '0', to: '/members' },
        { label: 'Attendance ngayong buwan', value: '—', to: '/attendance' },
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
          to: '/members',
          icon: '▲',
          title: 'Members',
          text: 'Tingnan ang listahan ng mga miyembro ng organisasyon.',
        },
      ],
    },
  },

  /* ----------------------------------------------------------
     SUSUNOD NA GAGAWIN:
       adviser, sao, supervisor, school_head, it_admin

     Kopyahin mo lang ang hugis sa itaas. Para sa bawat bago:
       1. dagdagan ang ROLE_KEYS
       2. dagdagan ang ROLES dito
       3. gumawa ng bagong page kung may bagong seksyon siya
       4. irehistro ang page sa PAGE_COMPONENTS sa App.jsx
     ---------------------------------------------------------- */
}

/* Ginagamit kapag hindi kilala ang role — halimbawa, kung
   nagkamali ng baybay sa DEV_ROLE. Kaunti lang ang laman
   para hindi masira ang app. */
export const FALLBACK_ROLE = {
  label: 'Walang role',
  canManage: false,
  sidebar: [DASHBOARD, PROFILE],
  dashboard: { subtitle: '', stats: [], cards: [] },
}

/* Laging gamitin ito imbes na direktang ROLES[role] —
   hindi ito babagsak kapag null o mali ang role. */
export function getRoleConfig(role) {
  return ROLES[role] ?? FALLBACK_ROLE
}
