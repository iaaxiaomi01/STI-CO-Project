import { useEffect, useRef, useState } from 'react'
import { fetchAllOrgHealth, formatScore, sortByConcern, toneOf } from '../lib/orgHealth.js'
import styles from './OrgHealthOverview.module.css'

/* ============================================================
   ORGANIZATION HEALTH — sa Dashboard ng SCHOOL HEAD lang

   ISANG card na kusang nag-i-slide (carousel), isang org bawat
   slide. Ang laman lang: bilog na graph ng health score,
   porsiyento sa gitna, at pangalan ng org.

   Data: fetchAllOrgHealth() → org_health_all() sa Supabase.
   Walang bagong SQL — ito rin ang ginagamit ng Org Health page.
   Pinakamababang score muna (sortByConcern), kapareho ng page.

   GALAW:
     - Lumilipat bawat SLIDE_MS. Humihinto habang naka-hover o
       naka-focus ang card.
     - Walang katapusan: may kopya ng unang slide sa dulo; pagdating
       doon, tahimik na bumabalik sa simula (walang "rewind").
     - Ang bilog ay napupuno pagdating ng slide.
     - prefers-reduced-motion: lumilipat pa rin, pero walang slide
       at walang animation ng bilog.
   ============================================================ */
const SLIDE_MS = 4000
const MOVE_MS = 700

function OrgHealthOverview() {
  const [list, setList] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    fetchAllOrgHealth()
      .then((result) => {
        if (active) setList(sortByConcern(result))
      })
      .catch((err) => {
        console.error('Hindi makuha ang organization health:', err)
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [])

  const count = list?.length ?? 0
  /* Kopya ng unang slide sa dulo, para tuloy-tuloy ang ikot */
  const slides = count > 1 ? [...list, list[0]] : (list ?? [])

  const [index, setIndex] = useState(0)
  const [animate, setAnimate] = useState(true)
  const [paused, setPaused] = useState(false)
  const resetTimer = useRef(null)

  /* Lipat sa susunod bawat SLIDE_MS */
  useEffect(() => {
    if (count < 2 || paused) return undefined
    const timer = setInterval(() => {
      setAnimate(true)
      setIndex((i) => Math.min(i + 1, count))
    }, SLIDE_MS)
    return () => clearInterval(timer)
  }, [count, paused])

  /* Nasa kopya na ng unang slide → tahimik na bumalik sa 0 */
  useEffect(() => {
    if (count < 2 || index !== count) return undefined
    resetTimer.current = setTimeout(() => {
      setAnimate(false)
      setIndex(0)
    }, MOVE_MS)
    return () => clearTimeout(resetTimer.current)
  }, [index, count])

  /* Ibalik ang animation pagkatapos ng tahimik na pagbalik */
  useEffect(() => {
    if (animate) return undefined
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(frame)
  }, [animate])

  const current = count > 0 ? index % count : 0

  return (
    <section
      className={styles.card}
      aria-roledescription="carousel"
      aria-label="Organization health"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {count > 0 ? (
        <div className={styles.viewport}>
          <ul
            className={`${styles.track} ${animate ? styles.moving : ''}`}
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((h, i) => {
              const ok = h.status === 'ok'
              const isActive =
                i === index || (index === count && i === 0) || (index === 0 && i === count)

              return (
                <li
                  key={`${h.organization_id}-${i}`}
                  className={`${styles.slide} ${styles[ok ? toneOf(h.classification) : 'none']}`}
                  aria-roledescription="slide"
                  aria-hidden={i % count !== current || i === count}
                >
                  <ScoreDonut score={ok ? h.score : null} active={isActive} />
                  <p className={styles.orgName}>{h.organization_name}</p>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className={`${styles.slide} ${styles.none}`}>
          <ScoreDonut score={null} active={false} />
          <p className={styles.orgName}>
            {failed
              ? 'Could not load organization health'
              : list
                ? 'No active organizations'
                : 'Loading…'}
          </p>
        </div>
      )}
    </section>
  )
}

/* Bilog na graph: puno ayon sa score (0–100), porsiyento sa gitna.
   Napupuno lang kapag "active" (nakikita) ang slide. */
function ScoreDonut({ score, active }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = score == null ? 0 : Math.max(0, Math.min(100, Number(score)))
  const shown = active ? pct : 0

  return (
    <div
      className={styles.donut}
      role="img"
      aria-label={score == null ? 'No health score yet' : `Health score ${formatScore(score)}%`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className={styles.donutTrack} cx="60" cy="60" r={r} />
        <circle
          className={styles.donutFill}
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={`${(shown / 100) * c} ${c}`}
          style={{ opacity: pct > 0 ? 1 : 0 }}
        />
      </svg>
      <span className={styles.donutValue}>
        {score == null ? '—' : `${formatScore(score)}%`}
      </span>
    </div>
  )
}

export default OrgHealthOverview
