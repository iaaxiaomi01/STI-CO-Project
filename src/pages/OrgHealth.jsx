import { useEffect, useState } from 'react'
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
    <>
      <PageHeader
        title="Organization Health"
        subtitle={
          isStaff
            ? 'How active each organization is, based on attendance in its completed events.'
            : 'How active your organization is, based on attendance in its completed events.'
        }
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
    </>
  )
}

/* ---------- ISANG ORG (Adviser) ---------- */

function OrgReport({ health }) {
  if (health.status !== 'ok') {
    return (
      <EmptyState
        icon="✚"
        title="Insufficient data"
        message="Your organization has no completed events with participants yet. The health score will appear once at least one event with participants has ended."
      />
    )
  }

  const tone = toneOf(health.classification)

  return (
    <div className={styles.report}>
      <section className={`${styles.scoreCard} ${styles[tone]}`}>
        <ScoreRing score={health.score} tone={tone} size="lg" />

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
          rate={health.attendance_rate}
          detail={`${health.completed_attendance} of ${health.joined} joined participants timed in and timed out.`}
        />
        <RateCard
          title="Participation Rate"
          rate={health.participation_rate}
          detail={`${health.members_attended} of ${health.active_members} active members attended at least one event.`}
        />
      </div>
    </div>
  )
}

function RateCard({ title, rate, detail }) {
  const pct = Math.max(0, Math.min(100, Number(rate) || 0))

  return (
    <section className={styles.rateCard}>
      <h2 className={styles.rateTitle}>{title}</h2>
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

/* Bilog na umaapaw ayon sa score (0–100) */
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
