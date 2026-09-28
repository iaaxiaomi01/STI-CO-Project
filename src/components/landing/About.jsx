import { Users, CalendarDays, Handshake, Megaphone } from 'lucide-react'
import studentsPhoto from '../../assets/students.png'
import eventPhoto from '../../assets/event.png'
import styles from './About.module.css'

/* ============================================================
   CONTENT — nasa taas lahat ng teksto para isang lugar lang
   ang papalitan mo.
   ============================================================ */

const PARAGRAPHS = [
  'STI-CO is the central hub for all student organizations in STI College San Pablo.',
  'We bring organizations, events, announcements, and opportunities together in one digital platform—so students can stay informed, get involved, and make an impact on campus life.',
  'Whether you’re a student leader or a member, STI-CO is here to support your journey, celebrate your initiatives, and build a strong community—together.',
]

/* Ang dalawang larawang ito ay nasa public/about/ ng lumang
   project. Kopyahin ang folder na iyon papunta sa public/
   ng bagong project. */
const ORGANIZATION_PHOTO = '/about/organization.jpg'
const LEADER_PHOTO = '/about/leader.jpg'

/* tone: 'blue' o 'yellow' — kulay ng icon */
const FEATURES = [
  {
    icon: Users,
    tone: 'blue',
    title: 'ALL IN ONE',
    text: 'All organizations, documents, and updates in one centralized platform.',
  },
  {
    icon: CalendarDays,
    tone: 'yellow',
    title: 'STAY UPDATED',
    text: 'Never miss an event or announcement that matters to you and your organization.',
  },
  {
    icon: Handshake,
    tone: 'blue',
    title: 'BUILD TOGETHER',
    text: 'Empower student leaders and strengthen connections across organizations and the campus.',
  },
  {
    icon: Megaphone,
    tone: 'yellow',
    title: 'MAKE AN IMPACT',
    text: 'Your voice, your ideas, your organization—create change and inspire more.',
  },
]

function About() {
  return (
    <section id="about" className={styles.section}>
      <div className={styles.inner}>
        {/* ---------- LEFT CONTENT ---------- */}
        <div className={styles.content}>
          <span className={styles.label}>ABOUT</span>

          <h2 className={styles.title}>
            <span className={styles.titleSti}>STI-</span>
            <span className={styles.titleCo}>CO</span>
          </h2>

          <h3 className={styles.tagline}>One Campus. Many Possibilities.</h3>

          <div className={styles.line} />

          {PARAGRAPHS.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>

        {/* ---------- RIGHT PHOTO COLLAGE ---------- */}
        <div className={styles.gallery}>
          <div className={styles.blueShape} aria-hidden="true" />

          <div className={`${styles.photo} ${styles.photoMain}`}>
            <img src={studentsPhoto} alt="STI students working together" />
            <span className={styles.photoLabel}>
              STUDENT
              <br />
              LED
            </span>
          </div>

          <div className={`${styles.photo} ${styles.photoEvent}`}>
            <img src={eventPhoto} alt="STI student organization event" />
          </div>

          <div className={`${styles.photo} ${styles.photoOrganization}`}>
            <img src={ORGANIZATION_PHOTO} alt="STI student organization members" />
          </div>

          <div className={`${styles.photo} ${styles.photoLeader}`}>
            <img src={LEADER_PHOTO} alt="STI student leader speaking" />
          </div>

          <div className={styles.quote}>
            <span>YOUR VOICE.</span>
            <span>YOUR CAMPUS.</span>
            <strong>YOUR FUTURE.</strong>
          </div>

          <div className={styles.note}>
            <span>One platform.</span>
            <span>Infinite</span>
            <span>opportunities.</span>
          </div>
        </div>
      </div>

      {/* ---------- FEATURE HIGHLIGHTS ---------- */}
      <div className={styles.features}>
        {FEATURES.map(({ icon: Icon, tone, title, text }) => (
          <div key={title} className={styles.feature}>
            <div
              className={`${styles.featureIcon} ${
                tone === 'yellow' ? styles.featureIconYellow : styles.featureIconBlue
              }`}
            >
              <Icon size={42} strokeWidth={1.8} />
            </div>

            <div className={styles.featureContent}>
              <h4>{title}</h4>
              <p>{text}</p>
              <span className={styles.featureLine} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default About
