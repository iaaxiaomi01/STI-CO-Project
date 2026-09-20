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
   │  ITO ANG LINYANG BABAGUHIN MO                          │
   │                                                        │
   │  Kung sino man ang naka-login, ito ang role niya.      │
   │  Palitan ng 'member', 'officer', o 'adviser' at        │
   │  iyon ka na sa susunod mong refresh.                   │
   │                                                        │
   │  ⚠️  PANSAMANTALA ITO. Walang database pa, kaya walang │
   │  paraan para malaman kung sino talaga ang Adviser.      │
   │  Kapag may profiles table na, ang isang linyang ito     │
   │  ang papalitan ng totoong role galing doon — at wala    │
   │  nang ibang file na gagalawin.                         │
   └────────────────────────────────────────────────────────┘ */
export const DEV_ROLE = 'adviser'

/* Ang mga susi dito ay magiging role values sa database
   mamaya. Tandaan ang pagbabaybay. */
export const ROLE_KEYS = {
  MEMBER: 'member',
  OFFICER: 'officer',
  ADVISER: 'adviser',
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
        { label: 'Kabuuang miyembro', value: '0', to: '/members' },
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
        { label: 'Aktibong miyembro', value: '0', to: '/members' },
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
     SUSUNOD NA GAGAWIN:
       sao, supervisor, school_head, it_admin

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
  can: { create: false, review: false },
  sidebar: [DASHBOARD, PROFILE],
  dashboard: { subtitle: '', stats: [], cards: [] },
}

/* Laging gamitin ito imbes na direktang ROLES[role] —
   hindi ito babagsak kapag null o mali ang role. */
export function getRoleConfig(role) {
  return ROLES[role] ?? FALLBACK_ROLE
}
