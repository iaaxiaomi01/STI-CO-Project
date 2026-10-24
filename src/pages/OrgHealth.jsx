import { useEffect, useState } from 'react'
import { CalendarCheck, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import {
  HEALTH_LEVELS,
  fetchAllOrgHealth,
  fetchOrgHealth,
  formatRate,
  formatScore,
  orgHealthErrorMessage,
  seesAllOrgHealth,
  sortByConcern,
  toneOf,
} from '../lib/orgHealth.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import styles from './OrgHealth.module.css'

/* ============================================================
   ORGANIZATION HEALTH

   Adviser          → ang health ng SARILING org niya (isang report)
   School Head      → listahan ng LAHAT ng org, Critical muna
   (Inalis na sa SAO — REMOVE_SAO_ORG_HEALTH.sql)

   Batayan: LAHAT ng natapos na event ng org (walang semester).

   Ang database ang nagkukuwenta (ORG_HEALTH.sql). Dito ay
   ipinapakita lang ang resulta.

   Daloy (ayon sa activity diagram):
     1. Kunin ang natapos na events ng org
     2. Walang natapos na event na may nag-Join?
          → "Insufficient data"
     3. Attendance Rate, Participation Rate, at ang average
     4. Healthy / Needs Attention / Critical
     5. Ipakita ang score, classification at dalawang rate

   ITSURA ("Health report" — UI lang, walang binago sa data):
     Adviser: deep navy na box na may semicircle GAUGE (pula /
     amber / berde na zone + marker ng score), dalawang box ng
     rate na may segmented bar, at madilim na box ng formula.
     Walang animation maliban sa hover.
   ============================================================ */
function OrgHealth() {
  const { profile } = useAuth()
  const isStaff = seesAllOrgHealth(profile)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    const request = isStaff ? fetchAllOrgHealth() : fetchOrgHealth()

    request
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        console.error('Hindi makuha ang organization health:', err)
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isStaff])

  return (
    <div className={styles.page}>
      <PageHeader
        title="Organization Health"
      />

      {loading && <p className={styles.status}>Computing organization health…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load organization health"
          message={orgHealthErrorMessage(error)}
        />
      )}

      {!loading && !error && data && (
        isStaff ? (
          <AllOrgs list={data} />
        ) : (
          <OrgReport health={data} />
        )
      )}

      {!loading && !error && <Legend />}
    </div>
  )
}

/* ---------- ISANG ORG (Adviser) ---------- */

function OrgReport({ health }) {
  if (health.status !== 'ok') {
    return (
      <EmptyState
        icon="✚"
        title="Insufficient data"
      />
    )
  }

  const tone = toneOf(health.classification)

  return (
    <div className={styles.report}>
      <section className={`${styles.scoreCard} ${styles[tone]}`}>
        <ScoreGauge score={health.score} tone={tone} />

        <div className={styles.scoreText}>
          <p className={styles.eyebrow}>Organization Health Score</p>
          <p className={`${styles.badge} ${styles[tone]}`}>{health.classification}</p>
          <p className={styles.scoreNote}>
            Average of the attendance rate and the participation rate, from{' '}
            <strong>
              {health.completed_events} completed event
              {health.completed_events === 1 ? '' : 's'}
            </strong>
            .
          </p>
        </div>
      </section>

      <div className={styles.rateGrid}>
        <RateCard
          title="Attendance Rate"
          Icon={CalendarCheck}
          rate={health.attendance_rate}
          detail={`${health.completed_attendance} of ${health.joined} joined participants timed in and timed out.`}
        />
        <RateCard
          title="Participation Rate"
          Icon={UserCheck}
          rate={health.participation_rate}
          detail={`${health.members_attended} of ${health.active_members} active members attended at least one event.`}
        />
      </div>
    </div>
  )
}

function RateCard({ title, Icon, rate, detail }) {
  const pct = Math.max(0, Math.min(100, Number(rate) || 0))

  return (
    <section className={styles.rateCard}>
      <h2 className={styles.rateTitle}>
        {Icon && (
          <span className={styles.rateIcon} aria-hidden="true">
            <Icon size={18} strokeWidth={2.3} />
          </span>
        )}
        {title}
      </h2>
      <p className={styles.rateValue}>{formatRate(rate)}</p>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={title}
      >
        <span className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <p className={styles.rateDetail}>{detail}</p>
    </section>
  )
}

/* ---------- LAHAT NG ORG (Staff) ---------- */

function AllOrgs({ list }) {
  if (list.length === 0) {
    return (
      <EmptyState
        icon="✚"
        title="No active organizations"
        message="Organization health will appear here once there are active organizations."
      />
    )
  }

  const sorted = sortByConcern(list)
  const counts = HEALTH_LEVELS.map((level) => ({
    ...level,
    count: list.filter((h) => h.classification === level.name).length,
  }))
  const insufficient = list.filter((h) => h.status !== 'ok').length

  return (
    <>
      <div className={styles.summary}>
        {counts.map((c) => (
          <div key={c.name} className={`${styles.summaryTile} ${styles[c.tone]}`}>
            <span className={styles.summaryValue}>{c.count}</span>
            <span className={styles.summaryLabel}>{c.name}</span>
          </div>
        ))}
        <div className={`${styles.summaryTile} ${styles.none}`}>
          <span className={styles.summaryValue}>{insufficient}</span>
          <span className={styles.summaryLabel}>Insufficient data</span>
        </div>
      </div>

      <p className={styles.listNote}>
        Lowest score first
      </p>

      <ul className={styles.orgList}>
        {sorted.map((h) => {
          const ok = h.status === 'ok'
          const tone = ok ? toneOf(h.classification) : 'none'

          return (
            <li key={h.organization_id} className={styles.orgRow}>
              <ScoreRing score={ok ? h.score : null} tone={tone} size="sm" />

              <div className={styles.orgMain}>
                <p className={styles.orgName}>{h.organization_name}</p>
                <p className={`${styles.badge} ${styles.badgeSm} ${styles[tone]}`}>
                  {ok ? h.classification : 'Insufficient data'}
                </p>
              </div>

              <dl className={styles.orgRates}>
                <div>
                  <dt>Attendance</dt>
                  <dd>{ok ? formatRate(h.attendance_rate) : '—'}</dd>
                </div>
                <div>
                  <dt>Participation</dt>
                  <dd>{ok ? formatRate(h.participation_rate) : '—'}</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>{h.completed_events}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* ---------- MALIIT NA BAHAGI ---------- */

/* Semicircle gauge (Adviser) — display lang.
   Zone: 0–60 Critical · 60–80 Needs Attention · 80–100 Healthy
   (kapareho ng HEALTH_LEVELS). Ang marker ay nasa score. */
function ScoreGauge({ score, tone }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, Number(score)))
  /* 0 → kaliwa (180°), 100 → kanan (0°) */
  const angle = Math.PI * (1 - pct / 100)
  const mx = 100 + 80 * Math.cos(angle)
  const my = 100 - 80 * Math.sin(angle)
  const arc = 'M20 100 A80 80 0 0 1 180 100'

  return (
    <div className={`${styles.gauge} ${styles[tone]}`}>
      <svg viewBox="0 0 200 118" aria-hidden="true">
        <path className={styles.gaugeTrack} d={arc} pathLength="100" />
        <path className={`${styles.gaugeZone} ${styles.zoneCritical}`} d={arc} pathLength="100" strokeDasharray="59.4 100" />
        <path className={`${styles.gaugeZone} ${styles.zoneAttention}`} d={arc} pathLength="100" strokeDasharray="0 60.3 19.4 100" />
        <path className={`${styles.gaugeZone} ${styles.zoneHealthy}`} d={arc} pathLength="100" strokeDasharray="0 80.3 19.7 100" />
        <path className={styles.gaugeFill} d={arc} pathLength="100" strokeDasharray={`${pct} 100`} />
        <circle className={styles.gaugeMarker} cx={mx} cy={my} r="7" />
        <text className={styles.gaugeTick} x="20" y="116" textAnchor="middle">0</text>
        <text className={styles.gaugeTick} x="180" y="116" textAnchor="middle">100</text>
      </svg>
      <span className={styles.gaugeValue}>
        {formatScore(score)}
        {score != null && <span className={styles.ringMax}>/100</span>}
      </span>
    </div>
  )
}

/* Bilog na umaapaw ayon sa score (0–100) — sa listahan ng School Head */
function ScoreRing({ score, tone, size }) {
  const r = 42
  const c = 2 * Math.PI * r
  const pct = score == null ? 0 : Math.max(0, Math.min(100, Number(score)))

  return (
    <div className={`${styles.ring} ${styles[size]} ${styles[tone]}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className={styles.ringTrack} cx="50" cy="50" r={r} />
        <circle
          className={styles.ringFill}
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span className={styles.ringValue}>
        {formatScore(score)}
        {size === 'lg' && score != null && <span className={styles.ringMax}>/100</span>}
      </span>
    </div>
  )
}

function Legend() {
  return (
    <div className={styles.legend}>
      <p className={styles.legendTitle}>How the score is computed</p>
      <ul className={styles.legendFormulas}>
        <li>
          <strong>Attendance Rate</strong> = participants with Time In and Time Out ÷
          participants who joined × 100
        </li>
        <li>
          <strong>Participation Rate</strong> = members who attended at least one event ÷
          active members × 100
        </li>
        <li>
          <strong>Health Score</strong> = average of the two rates
        </li>
      </ul>
      <ul className={styles.legendLevels}>
        {HEALTH_LEVELS.map((l) => (
          <li key={l.name}>
            <span className={`${styles.dot} ${styles[l.tone]}`} aria-hidden="true" />
            <strong>{l.name}</strong> {l.rule}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default OrgHealth
