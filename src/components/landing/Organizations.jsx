import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchPublicOrganizations } from '../../lib/organization.js'
import styles from './Organizations.module.css'

/* ============================================================
   ORGANIZATIONS

   Galing na sa public.organizations sa Supabase ang listahan
   (fetchPublicOrganizations sa lib/organization.js). Aktibong
   org lang ang lumalabas, naka-ayos ayon sa pangalan.

   Logo: ang logo_url na ina-upload ng Adviser sa Org Profile.
   Kapag wala pa (o hindi ma-load), inisyal ng pangalan ang
   ipinapakita imbes na sirang larawan.
   ============================================================ */

/* Ilang placeholder card habang naglo-load (desktop) */
const SKELETON_COUNT = 4

/* Hal. "STARTUP" → "ST", "Junior Philippine Computer Society" → "JP" */
function initialsOf(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function OrganizationCard({ organization }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = organization.logo_url && !logoFailed

  return (
    <article className={styles.card}>
      <div className={styles.logoWrap}>
        {showLogo ? (
          <img
            src={organization.logo_url}
            alt={`${organization.name} logo`}
            className={styles.logo}
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className={styles.logoFallback} aria-hidden="true">
            {initialsOf(organization.name)}
          </div>
        )}
      </div>

      <div className={styles.cardContent}>
        <h3>{organization.name}</h3>
        <span className={styles.cardLine} />
        {organization.department && <p>{organization.department}</p>}
      </div>
    </article>
  )
}

/* Kinukuha ang orgs mula sa Supabase.
   status: 'loading' | 'ready' | 'error' */
function usePublicOrganizations() {
  const [organizations, setOrganizations] = useState([])
  const [status, setStatus] = useState('loading')

  const load = useCallback(async (isCancelled = () => false) => {
    setStatus('loading')
    try {
      const data = await fetchPublicOrganizations()
      if (isCancelled()) return
      setOrganizations(data)
      setStatus('ready')
    } catch (err) {
      if (isCancelled()) return
      console.error('Hindi makuha ang organizations:', err)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  return { organizations, status, retry: () => load() }
}

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
  const { organizations, status, retry } = usePublicOrganizations()
  const cardsPerPage = isMobile ? CARDS_PER_PAGE_MOBILE : CARDS_PER_PAGE_DESKTOP

  const totalPages = Math.max(1, Math.ceil(organizations.length / cardsPerPage))

  const [page, setPage] = useState(0)

  /* Kapag lumipat mula mobile papuntang desktop, maaaring lumagpas
     ang page sa bagong totalPages — kaya nililimitahan dito. */
  const currentPage = Math.min(page, totalPages - 1)

  const nextPage = () => setPage((currentPage + 1) % totalPages)
  const previousPage = () => setPage((currentPage - 1 + totalPages) % totalPages)

  const start = currentPage * cardsPerPage
  const visibleOrganizations = organizations.slice(start, start + cardsPerPage)

  const hasMultiplePages = status === 'ready' && totalPages > 1

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

        {status === 'loading' && (
          <div className={styles.grid} aria-busy="true" aria-label="Loading organizations">
            {Array.from({ length: isMobile ? 1 : SKELETON_COUNT }, (_, index) => (
              <div key={index} className={`${styles.card} ${styles.skeletonCard}`}>
                <div className={styles.logoWrap}>
                  <div className={styles.skeletonLogo} />
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className={styles.message} role="alert">
            <p>Could not load the organizations right now.</p>
            <button type="button" className={styles.retryButton} onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && organizations.length === 0 && (
          <div className={styles.message}>
            <p>No organizations to show yet.</p>
          </div>
        )}

        {status === 'ready' && organizations.length > 0 && (
          <div className={styles.grid}>
            {visibleOrganizations.map((organization) => (
              <OrganizationCard key={organization.id} organization={organization} />
            ))}
          </div>
        )}

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
