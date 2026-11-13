import { useEffect, useRef, useState } from 'react'
import { fetchAllOrgHealth, formatScore, sortByConcern, toneOf } from '../lib/orgHealth.js'
import styles from './OrgHealthOverview.module.css'

/* ============================================================
   ORGANIZATION HEALTH — sa Dashboard ng SAO at SCHOOL HEAD

   ISANG card na kusang nag-i-slide (carousel), isang org bawat
   slide. Ang laman lang: GAUGE (kalahating bilog na metro) ng
   health score, porsiyento sa ilalim nito, at pangalan ng org.
   Kulay ng gauge at ng guhit sa kaliwa: ayon sa antas.

   Data: fetchAllOrgHealth() → org_health_all() sa Supabase.
   Walang bagong SQL — ito rin ang ginagamit ng Org Health page.
   Pinakamababang score muna (sortByConcern), kapareho ng page.

   GALAW:
     - Lumilipat bawat SLIDE_MS. Humihinto habang naka-hover o
       naka-focus ang card.
     - Walang katapusan: may kopya ng unang slide sa dulo; pagdating
       doon, tahimik na bumabalik sa simula (walang "rewind").
     - Ang gauge ay napupuno pagdating ng slide.
     - prefers-reduced-motion: lumilipat pa rin, pero walang slide
       at walang animation ng gauge.
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
                  <ScoreGauge score={ok ? h.score : null} active={isActive} />
                  <p className={styles.orgName}>{h.organization_name}</p>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className={`${styles.slide} ${styles.none}`}>
          <ScoreGauge score={null} active={false} />
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

/* Gauge: kalahating bilog na napupuno ayon sa score (0–100),
   may maliliit na tick bawat 10%. Porsiyento sa ilalim ng arko.
   Napupuno lang kapag "active" (nakikita) ang slide. */
const TICKS = Array.from({ length: 11 }, (_, i) => {
  const a = Math.PI - (i / 10) * Math.PI // 180° → 0°
  return {
    x1: 100 + 92 * Math.cos(a),
    y1: 104 - 92 * Math.sin(a),
    x2: 100 + (i % 5 === 0 ? 100 : 97) * Math.cos(a),
    y2: 104 - (i % 5 === 0 ? 100 : 97) * Math.sin(a),
  }
})

function ScoreGauge({ score, active }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, Number(score)))
  const shown = active ? pct : 0
  const arc = 'M 22 104 A 78 78 0 0 1 178 104'

  return (
    <div
      className={styles.gauge}
      role="img"
      aria-label={score == null ? 'No health score yet' : `Health score ${formatScore(score)}%`}
    >
      <svg viewBox="0 0 200 112" aria-hidden="true">
        {TICKS.map((t, i) => (
          <line
            key={i}
            className={`${styles.tick} ${i * 10 <= shown && pct > 0 ? styles.tickOn : ''}`}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            /* sumasabay sa pagpuno ng arko */
            style={{ transitionDelay: `${0.25 + i * 0.08}s` }}
          />
        ))}
        <path className={styles.gaugeTrack} d={arc} pathLength="100" />
        <path
          className={styles.gaugeFill}
          d={arc}
          pathLength="100"
          strokeDasharray={`${shown} 100`}
          style={{ opacity: pct > 0 ? 1 : 0 }}
        />
      </svg>
      <span className={styles.gaugeValue}>
        {score == null ? '—' : `${formatScore(score)}%`}
      </span>
    </div>
  )
}

export default OrgHealthOverview