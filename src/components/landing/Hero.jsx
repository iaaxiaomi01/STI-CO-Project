import heroStudents from '../../assets/hero-students.png'
import styles from './Hero.module.css'

/* Kung saang section tatalon ang scroll-down button */
const NEXT_SECTION_ID = 'announcements'

function Hero() {
  const scrollToNext = () => {
    document.getElementById(NEXT_SECTION_ID)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="top" className={styles.hero}>
      <div className={styles.inner}>
        {/* Left content */}
        <div className={styles.content}>
          <h1 className={styles.title}>
            <span>STI-</span>
            <span className={styles.titleAccent}>CO</span>
          </h1>

          <h2 className={styles.subtitle}>
            <span>All Organizations.</span>
            <span>One Campus.</span>
            <span className={styles.subtitleAccent}>One Platform.</span>
          </h2>

          <p className={styles.description}>
            A centralized platform designed to help student organizations
            manage activities, announcements, and student engagement.
          </p>
        </div>

        {/* Right image */}
        <div className={styles.imageWrap}>
          <img src={heroStudents} alt="STI students" />
        </div>

        <button
          type="button"
          className={styles.scrollDown}
          onClick={scrollToNext}
          aria-label="Scroll down to announcements"
        >
          <span className={styles.chevron} />
        </button>
      </div>
    </section>
  )
}

export default Hero
