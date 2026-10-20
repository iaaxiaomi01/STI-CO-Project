import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchPublicOrganizations } from '../../lib/organization.js'
import styles from './Organizations.module.css'

/* ============================================================
   ORGANIZATIONS

   Galing sa public.organizations sa Supabase ang listahan
   (fetchPublicOrganizations sa lib/organization.js). Aktibong
   org lang ang lumalabas, naka-ayos ayon sa pangalan.

   CAROUSEL:
   Isang hilera ng card na nag-i-scroll pahalang (scroll-snap).
     - Kasya lahat     → naka-gitna, walang arrow/dots
     - Hindi kasya     → may arrow (desktop) at dots
     - Phone           → i-swipe lang; may dots sa ibaba
   Kaya kahit 1, 4 o 20 ang org, maayos pa rin ang itsura.

   Logo: ang logo_url na ina-upload ng Adviser sa Org Profile.
   Kapag wala pa (o hindi ma-load), inisyal ng pangalan ang
   ipinapakita imbes na sirang larawan.
   ============================================================ */

/* Ilang placeholder card habang naglo-load */
const SKELETON_COUNT = 4

/* Hal. "STARTUP" → "ST", "Junior Philippine Computer Society" → "JP" */
function initialsOf(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/* ------------------------------------------------------------
   ISANG CARD
   ------------------------------------------------------------ */
function OrganizationCard({ organization }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = organization.logo_url && !logoFailed

  return (
    <article className={styles.card} role="listitem">
      <div className={styles.cardBanner} aria-hidden="true" />

      <div className={styles.logoRing}>
        {showLogo ? (
          <img
            src={organization.logo_url}
            alt={`${organization.name} logo`}
            className={styles.logo}
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className={styles.logoFallback} aria-hidden="true">
            {initialsOf(organization.name)}
          </span>
        )}
      </div>

      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle} title={organization.name}>
          {organization.name}
        </h3>

        {organization.department && (
          <p className={styles.department}>{organization.department}</p>
        )}

        <span className={styles.cardLine} aria-hidden="true" />

        {organization.description && (
          <p className={styles.cardDescription}>{organization.description}</p>
        )}
      </div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`} aria-hidden="true">
      <div className={`${styles.cardBanner} ${styles.skeletonBanner}`} />
      <div className={styles.logoRing}>
        <span className={styles.skeletonLogo} />
      </div>
      <div className={styles.cardContent}>
        <span className={styles.skeletonLine} />
        <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   DATA — status: 'loading' | 'ready' | 'error'
   ------------------------------------------------------------ */
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

/* ------------------------------------------------------------
   SCROLL STATE ng carousel

   Binabantayan ang lapad ng track para malaman kung kailangan
   pa ng arrows/dots, at kung nasaang "page" na tayo.
   Ang isang page = isang buong lapad ng nakikitang track.
   ------------------------------------------------------------ */
function useCarousel(itemCount) {
  const trackRef = useRef(null)
  const [state, setState] = useState({
    overflowing: false,
    atStart: true,
    atEnd: true,
    pageCount: 1,
    activePage: 0,
  })

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const maxScroll = track.scrollWidth - track.clientWidth
    const overflowing = maxScroll > 2
    const pageCount = overflowing ? Math.ceil(track.scrollWidth / track.clientWidth - 0.05) : 1
    const progress = overflowing ? track.scrollLeft / maxScroll : 0

    setState({
      overflowing,
      atStart: track.scrollLeft <= 2,
      atEnd: track.scrollLeft >= maxScroll - 2,
      pageCount,
      activePage: Math.round(progress * (pageCount - 1)),
    })
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return undefined

    measure()
    track.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(track)

    return () => {
      track.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, itemCount])

  const behavior = () => (prefersReducedMotion() ? 'auto' : 'smooth')

  const scrollByPage = (direction) => {
    const track = trackRef.current
    if (!track) return
    /* Isang buong page = lapad ng track + isang gap */
    const gap = parseFloat(getComputedStyle(track.firstElementChild).columnGap) || 0
    track.scrollBy({ left: direction * (track.clientWidth + gap), behavior: behavior() })
  }

  const goToPage = (index) => {
    const track = trackRef.current
    if (!track) return
    const maxScroll = track.scrollWidth - track.clientWidth
    const left = state.pageCount > 1 ? (maxScroll * index) / (state.pageCount - 1) : 0
    track.scrollTo({ left, behavior: behavior() })
  }

  return { trackRef, ...state, scrollByPage, goToPage }
}

/* ------------------------------------------------------------
   SECTION
   ------------------------------------------------------------ */
function Organizations() {
  const { organizations, status, retry } = usePublicOrganizations()

  const isReady = status === 'ready' && organizations.length > 0
  const carousel = useCarousel(isReady ? organizations.length : 0)
  const showNav = isReady && carousel.overflowing

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

        {status === 'loading' && (
          <div className={styles.track} aria-busy="true" aria-label="Loading organizations">
            <div className={styles.row}>
              {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          </div>
        )}

        {isReady && (
          <>
            {showNav && (
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowLeft}`}
                onClick={() => carousel.scrollByPage(-1)}
                disabled={carousel.atStart}
                aria-label="Previous organizations"
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* tabIndex: para ma-scroll din gamit ang arrow keys ng keyboard */}
            <div
              ref={carousel.trackRef}
              className={styles.track}
              tabIndex={showNav ? 0 : -1}
              aria-label="Student organizations"
            >
              <div className={styles.row} role="list">
                {organizations.map((organization) => (
                  <OrganizationCard key={organization.id} organization={organization} />
                ))}
              </div>
            </div>

            {showNav && (
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowRight}`}
                onClick={() => carousel.scrollByPage(1)}
                disabled={carousel.atEnd}
                aria-label="Next organizations"
              >
                <ChevronRight size={28} />
              </button>
            )}
          </>
        )}
      </div>

      {/* ---------- PAGINATION DOTS ---------- */}
      {showNav && carousel.pageCount > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: carousel.pageCount }, (_, index) => (
            <button
              type="button"
              key={index}
              className={`${styles.dot} ${carousel.activePage === index ? styles.dotActive : ''}`}
              onClick={() => carousel.goToPage(index)}
              aria-label={`Go to organization page ${index + 1}`}
              aria-current={carousel.activePage === index ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default Organizations
