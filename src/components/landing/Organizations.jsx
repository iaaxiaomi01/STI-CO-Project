import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './Organizations.module.css'

/* ============================================================
   ORGANIZATIONS

   PALITAN: listahan ng orgs. Ang mga logo ay nasa
   public/organizations/ ng lumang project — kopyahin ang folder
   na iyon papunta sa public/ ng bagong project.

   Kapag kukunin na ito sa Supabase, palitan lang ang
   ORGANIZATIONS ng data mula sa lib/organization.js.
   ============================================================ */
const ORGANIZATIONS = [
  { name: 'ACES', department: 'Computer Engineering', image: '/organizations/aces.png' },
  { name: 'NEXI', department: 'Information Technology', image: '/organizations/nexi.png' },
  { name: 'METHA', department: 'Tourism Management and HRS', image: '/organizations/metha.png' },
  { name: 'STARTUP', department: 'Business Administration', image: '/organizations/startup.png' },
]

/* Ilang card bawat page. Dapat tugma ang breakpoint sa
   Organizations.module.css (767px). */
const CARDS_PER_PAGE_DESKTOP = 6
const CARDS_PER_PAGE_MOBILE = 1
const MOBILE_QUERY = '(max-width: 767px)'

/* true kapag mobile ang lapad ng screen; nag-a-update kapag nag-resize */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onChange = (event) => setIsMobile(event.matches)

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

function Organizations() {
  const isMobile = useIsMobile()
  const cardsPerPage = isMobile ? CARDS_PER_PAGE_MOBILE : CARDS_PER_PAGE_DESKTOP

  const totalPages = Math.max(1, Math.ceil(ORGANIZATIONS.length / cardsPerPage))

  const [page, setPage] = useState(0)

  /* Kapag lumipat mula mobile papuntang desktop, maaaring lumagpas
     ang page sa bagong totalPages — kaya nililimitahan dito. */
  const currentPage = Math.min(page, totalPages - 1)

  const nextPage = () => setPage((currentPage + 1) % totalPages)
  const previousPage = () => setPage((currentPage - 1 + totalPages) % totalPages)

  const start = currentPage * cardsPerPage
  const visibleOrganizations = ORGANIZATIONS.slice(start, start + cardsPerPage)

  const hasMultiplePages = totalPages > 1

  return (
    <section id="organizations" className={styles.section}>
      <div className={`${styles.decoration} ${styles.decorationTopLeft}`} aria-hidden="true" />
      <div className={`${styles.decoration} ${styles.decorationBottomRight}`} aria-hidden="true" />

      {/* ---------- HEADER ---------- */}
      <div className={styles.header}>
        <div className={styles.overline}>
          <span className={styles.overlineRule} />
          <span>OUR</span>
          <span className={styles.overlineRule} />
        </div>

        <h2 className={styles.title}>ORGANIZATIONS</h2>

        <div className={styles.titleLine} />

        <p className={styles.description}>
          Explore student organizations in STI San Pablo.{' '}
          <br />
          Find your <strong>community</strong>, grow your <strong>skills</strong>, and
          make an <strong>impact</strong>.
        </p>
      </div>

      {/* ---------- CAROUSEL ---------- */}
      <div className={styles.carousel}>
        {hasMultiplePages && (
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={previousPage}
            aria-label="Previous organizations"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div className={styles.grid}>
          {visibleOrganizations.map((organization) => (
            <article key={organization.name} className={styles.card}>
              <div className={styles.logoWrap}>
                <img
                  src={organization.image}
                  alt={`${organization.name} logo`}
                  className={styles.logo}
                />
              </div>

              <div className={styles.cardContent}>
                <h3>{organization.name}</h3>
                <span className={styles.cardLine} />
                <p>{organization.department}</p>
              </div>
            </article>
          ))}
        </div>

        {hasMultiplePages && (
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={nextPage}
            aria-label="Next organizations"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      {/* ---------- PAGINATION DOTS ---------- */}
      {hasMultiplePages && (
        <div className={styles.pagination}>
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              type="button"
              key={index}
              className={`${styles.dot} ${currentPage === index ? styles.dotActive : ''}`}
              onClick={() => setPage(index)}
              aria-label={`Go to organization page ${index + 1}`}
              aria-current={currentPage === index ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default Organizations
