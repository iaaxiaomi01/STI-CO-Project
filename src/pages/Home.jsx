import styles from './Home.module.css'

/* ============================================================
   PLACEHOLDER CONTENT
   Nasa taas lahat ng teksto para isang lugar lang ang
   papalitan mo. Hindi mo na kailangang galawin ang JSX sa baba.
   ============================================================ */

const STATS = [
  { value: '10+', label: 'Years of experience' },
  { value: '250', label: 'Projects delivered' },
  { value: '98%', label: 'Client satisfaction' },
]

const SERVICES = [
  {
    icon: '◆',
    title: 'Service One',
    description:
      'Maikling paliwanag ng unang serbisyo o feature. Dalawa hanggang tatlong linya lang — sapat na para maintindihan agad ng bisita.',
  },
  {
    icon: '●',
    title: 'Service Two',
    description:
      'Paliwanag ng pangalawang serbisyo. Panatilihing pare-pareho ang haba ng bawat card para pantay ang itsura ng grid.',
  },
  {
    icon: '▲',
    title: 'Service Three',
    description:
      'Paliwanag ng pangatlong serbisyo. Pwede kang magdagdag ng ikaapat — automatic itong susunod sa grid layout.',
  },
]

function Home() {
  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section id="top" className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <span className={styles.badge}>Placeholder badge</span>

            {/* PALITAN: headline */}
            <h1 className={styles.heroTitle}>
              Ang headline ng iyong <span className={styles.highlight}>landing page</span>
            </h1>

            {/* PALITAN: subheadline */}
            <p className={styles.heroSubtitle}>
              Isang maikling talata na nagpapaliwanag kung ano ang inaalok
              ninyo at bakit dapat magtiwala ang bisita. Panatilihin itong
              simple — dalawang pangungusap lang ang kailangan.
            </p>

            <div className={styles.heroActions}>
              <a href="#contact" className={styles.btnPrimary}>
                Get Started
              </a>
              <a href="#about" className={styles.btnSecondary}>
                Learn More
              </a>
            </div>
          </div>

          {/* PALITAN: ito ay placeholder para sa larawan.
              Kapag may image ka na, palitan ito ng:
              <img src={heroImage} alt="..." className={styles.heroImage} />
              at i-import sa taas: import heroImage from '../assets/hero.png' */}
          <div className={styles.heroVisual}>
            <div className={styles.visualCard}>
              <span className={styles.visualLabel}>Larawan dito</span>
              <span className={styles.visualHint}>1200 × 900 px</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ABOUT ---------------- */}
      <section id="about" className={styles.about}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>About Us</span>
            <h2 className={styles.sectionTitle}>Tungkol sa STI-CO</h2>
          </div>

          <div className={styles.aboutGrid}>
            {/* PALITAN: about text */}
            <p className={styles.aboutText}>
              Dito mo ilalagay ang kuwento ng kompanya o organisasyon — kung
              paano ito nagsimula, ano ang layunin, at sino ang pinaglilingkuran
              nito. Ang mabuting About section ay hindi mahaba; sapat lang para
              malaman ng bisita kung para ba sa kanila ito.
            </p>
            <p className={styles.aboutText}>
              Pwede ka ring maglagay ng pangalawang talata para sa mission o
              values. Kung mas gusto mo ng bullet list, palitan mo lang ang
              talatang ito ng <code>&lt;ul&gt;</code> na may mga
              <code>&lt;li&gt;</code> sa loob.
            </p>
          </div>

          {/* Stats row */}
          <div className={styles.statsRow}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.statItem}>
                <p className={styles.statValue}>{stat.value}</p>
                <p className={styles.statLabel}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- SERVICES ---------------- */}
      <section id="services" className={styles.services}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>What We Offer</span>
            <h2 className={styles.sectionTitle}>Aming mga serbisyo</h2>
            <p className={styles.sectionSubtitle}>
              Maikling panimula para sa mga serbisyong nakalista sa ibaba.
            </p>
          </div>

          {/* Ginagamit ang .map() para gawing cards ang SERVICES array.
              Magdagdag ka lang ng item sa array sa taas at automatic
              itong lalabas dito. */}
          <div className={styles.cardGrid}>
            {SERVICES.map((service) => (
              <article key={service.title} className={styles.card}>
                <span className={styles.cardIcon}>{service.icon}</span>
                <h3 className={styles.cardTitle}>{service.title}</h3>
                <p className={styles.cardText}>{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CONTACT / CTA ---------------- */}
      <section id="contact" className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Handa nang magsimula?</h2>
          <p className={styles.ctaText}>
            Isang maikling panghihikayat bago ang button. Dito papasok ang
            huling hakbang na gusto mong gawin ng bisita.
          </p>
          <a href="mailto:hello@sti-co.example" className={styles.btnAccent}>
            Contact Us
          </a>
        </div>
      </section>
    </>
  )
}

export default Home
