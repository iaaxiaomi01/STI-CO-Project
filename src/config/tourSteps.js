import { ROLE_KEYS, getRoleConfig } from './roles.js'

/* ============================================================
   TOUR STEPS — ang laman ng walkthrough

   DITO MO PALITAN ang mga sinasabi ng tour. Wala nang ibang
   file na kailangang galawin para sa text.

   Paano binubuo ang tour:
     1. Welcome (gitna ng screen)
     2. Bawat item sa sidebar ng role — kaya kapag nagdagdag ka
        ng page sa config/roles.js, kusa itong lalabas dito.
        Ang paliwanag ay galing sa PAGE_GUIDE sa ibaba.
     3. Notification bell at Event Calendar sa Dashboard
        (kung meron ang role)
     4. Account box at ang ? (replay) na button
     5. Tapos (gitna ng screen)

   Bawat step:
     target   — CSS selector ng ituturo (data-tour="..."); null =
                nasa gitna ng screen, walang spotlight
     title    — heading ng card
     body     — paliwanag
     sidebar  — true kung nasa sidebar ang target (sa phone,
                bubuksan ng tour ang sidebar para makita ito)
     optional — true = laktawan kung wala sa screen ang target
   ============================================================ */

const R = ROLE_KEYS

/* Paliwanag bawat page, ayon sa role.
   'default' = para sa role na walang sariling text. */
const PAGE_GUIDE = {
  '/dashboard': {
    default:
      'Your home page. The tiles give you a quick overview — tap any of them to jump straight to that page.',
    [R.MEMBER]:
      'Your home page. See your upcoming events, new announcements, attendance rate and Organization Gems (OG) at a glance. Tap any tile to open that page.',
    [R.OFFICER]:
      "Your home page. Track pending proposals, total members, your org's attendance rate, your own attendance and your OG. Tap any tile to open that page.",
    [R.ADVISER]:
      "Your home page. See the proposals waiting for your review, your active members and your org's attendance rate. Tap any tile to open that page.",
    [R.SAO]:
      '"Proposals awaiting your action" shows what needs your review. You also get the Organization Health summary and a calendar of every organization\'s events.',
    [R.SCHOOL_HEAD]:
      '"Proposals awaiting your action" shows what needs your review. Below it are the calendar of every organization\'s events and the Organization Health summary.',
    [R.SCHOOL_ADMIN]:
      'See the budget proposals waiting for your final decision, plus how many organizations and members are active.',
    [R.IT_ADMIN]: 'Your account currently has access to the Dashboard only.',
  },

  '/events': {
    default: 'Browse the events of your organization.',
    [R.MEMBER]:
      'All events of your organization. Press Join on an upcoming event to sign up. After the event, if you have both a Time In and a Time Out, you can download your certificate here.',
    [R.OFFICER]:
      'Join events just like a member. Once a proposal you submitted is fully approved, press Create Event here to turn it into an event — the dates, time, location and OG reward are taken from the proposal. You can edit your own events until 30 minutes before they start.',
    [R.ADVISER]:
      "Your organization's events. You can edit any of them until 30 minutes before they start, and open Certificates once an event is done.",
    [R.SAO]:
      'Events of all active organizations. Filter by organization and press View details for the full information. This page is view-only for you.',
    [R.SCHOOL_HEAD]:
      'Events of all active organizations. Filter by organization and press View details for the full information. This page is view-only for you.',
  },

  '/announcements': {
    default: 'Updates from your organization and the school. The newest posts are on top.',
    [R.OFFICER]:
      'Updates from your organization and the school. Press Post to publish an announcement for your organization. You can edit or delete your own posts.',
    [R.ADVISER]:
      'Updates from your organization and the school. Press Post to publish an announcement for your organization. You can edit or delete your own posts.',
    [R.SCHOOL_HEAD]:
      'Press Post to publish an announcement to all organizations or only to the ones you select. You can see every announcement, but only edit or delete your own.',
    [R.SCHOOL_ADMIN]:
      'Press Post to publish an announcement to all organizations or only to the ones you select. You can see every announcement, but only edit or delete your own.',
  },

  '/attendance': {
    default: 'Attendance records for events.',
    [R.MEMBER]:
      'Events you joined are listed under "Joined by me". On the event day, press Show QR and let an officer scan it. Time In opens 30 minutes before the start; Time Out runs from the end until 1 hour after. You need both to earn the OG and the certificate.',
    [R.OFFICER]:
      '"Joined by me" works like a member\'s — show your QR to Time In and Time Out. "Participants per event" lists who joined your org\'s events: scan their QR, use manual Time In/Out for anyone without a phone, and press Export (Excel) to download the record.',
    [R.ADVISER]:
      '"Participants per event" lists who joined each of your org\'s events. Scan members\' QR codes for Time In and Time Out, use manual Time In/Out for anyone without a phone, and press Export (Excel) to download the record.',
  },

  '/members': {
    default: 'The members of your organization.',
    [R.OFFICER]: 'The members of your organization, with their program, year level and role.',
    [R.ADVISER]:
      'The members of your organization. Use Set position to make a member an officer (President, VP, and so on). Removing the position turns them back into a member.',
  },

  '/proposals': {
    default: 'Activity proposals and their review status.',
    [R.OFFICER]:
      'Press Create Proposal to submit a formal letter for an activity, with at least one attached file. It goes to your Adviser, then the SAO, then the School Head — and the School Administrator if it has a budget. If a reviewer asks for changes, press Revise, update it and send it again.',
    [R.ADVISER]:
      'Proposals from your officers come to you first. Open each one, then Approve, Reject or Revise — a comment is always required. Approved proposals move on to the SAO.',
    [R.SAO]:
      'Proposals from every organization reach you after the Adviser. Approve, Reject or send them back with Revise, always with a comment. They then continue to the School Head.',
    [R.SCHOOL_HEAD]:
      'Proposals reach you after the SAO. Approve or Reject with a comment. Your decision is final for proposals without a budget; budget proposals continue to the School Administrator.',
    [R.SCHOOL_ADMIN]:
      'Only proposals with a budget reach you, after the School Head. Your Approve or Reject is the final decision.',
  },

  '/rewards': {
    default: 'Organization Gems (OG) and the rewards shop.',
    [R.MEMBER]:
      'You earn Organization Gems (OG) automatically from events with an OG reward when you have both Time In and Time Out. In the Shop, press Redeem to get a claim code, then show it to an officer to get your item. OG is only deducted once it is handed to you.',
    [R.OFFICER]:
      "Spend your OG in the Shop like a member. In Hand out items, type a member's claim code to give them their item — that is when their OG and the item's stock are deducted.",
    [R.ADVISER]:
      "Manage shop: add, edit, hide or delete the items members can get with OG. Hand out items: enter a member's claim code to release their item. Members' OG: see how much each member has earned and spent.",
  },

  '/org-health': {
    default: 'Organization Health scores, based on event attendance and participation.',
    [R.ADVISER]:
      "Your organization's health score (out of 100), based on attendance and participation in completed events. Open \"How the score is computed\" for the details.",
    [R.SAO]:
      'Health scores of all active organizations, based on attendance and participation in completed events. Use it to spot organizations that need support.',
    [R.SCHOOL_HEAD]:
      'Health scores of all active organizations, based on attendance and participation in completed events. Use it to spot organizations that need support.',
  },

  '/org-profile': {
    default:
      "Edit your organization's details — name, department and description — and upload its logo.",
  },

  '/organizations': {
    default:
      'Create organizations with + New organization. Edit their details, logo and officer positions, or deactivate an organization.',
  },

  '/users': {
    default:
      'Every student record in the system, with role, organization and login status. Use the filters to narrow the list. This page is view-only for you.',
    [R.SCHOOL_ADMIN]:
      'Every student record in the system. Use + Add user so a student can log in, edit their role and organization, Set position, or deactivate an account. Status shows whether they have logged in yet.',
  },

  '/profile': {
    default: 'Your personal details from the school records. You can upload or change your profile picture here.',
  },
}

function guideFor(route, role) {
  const guide = PAGE_GUIDE[route]
  if (!guide) return null
  return guide[role] ?? guide.default
}

/* Binubuo ang listahan ng steps para sa role ng naka-login */
export function buildTourSteps(role, profile) {
  const roleConfig = getRoleConfig(role)
  const firstName = profile?.first_name?.trim()
  const steps = []

  steps.push({
    id: 'welcome',
    target: null,
    title: firstName ? `Welcome to STI-CO, ${firstName}!` : 'Welcome to STI-CO!',
    body: `Here's a quick tour of what you can do as ${roleConfig.label}. It only takes a minute. Use Next and Back, or press Esc to skip.`,
  })

  roleConfig.sidebar.forEach((item) => {
    const body = guideFor(item.to, role)
    if (!body) return

    steps.push({
      id: `nav:${item.to}`,
      target: `[data-tour="nav:${item.to}"]`,
      title: item.label,
      body,
      sidebar: true,
    })

    /* Ang bell at calendar ay nasa Dashboard, kaya kasunod
       sila ng Dashboard step */
    if (item.to === '/dashboard') {
      if (roleConfig.notifications) {
        steps.push({
          id: 'notifications',
          target: '[data-tour="notifications"]',
          title: 'Notifications',
          body: 'New events, announcements, proposal updates and certificates show up here as they happen. The number shows how many you have not read yet.',
          optional: true,
        })
      }
      if (roleConfig.calendar) {
        steps.push({
          id: 'calendar',
          target: '[data-tour="calendar"]',
          title: 'Event Calendar',
          body: 'See events by date. Use the arrows to change the month and pick a day to see what is happening.',
          optional: true,
        })
      }
    }
  })

  steps.push({
    id: 'account',
    target: '[data-tour="account"]',
    title: 'Your account',
    body: 'Your name, role and organization. Use the door icon to log out.',
    sidebar: true,
    optional: true,
  })

  steps.push({
    id: 'help',
    target: '[data-tour="help"]',
    title: 'Need a refresher?',
    body: 'Press this button anytime to watch this tour again.',
    sidebar: true,
    optional: true,
  })

  steps.push({
    id: 'done',
    target: null,
    title: "You're all set!",
    body: 'That covers the basics. Explore the pages in the sidebar to get started.',
  })

  return steps
}
