import { useEffect, useState } from 'react'
import { ChevronDown, Crown, Info, Trophy } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { fetchOrgLeaderboard, formatScore, toneOf } from '../lib/orgHealth.js'
import styles from './OrgLeaderboard.module.css'

/* ============================================================
   ORG HEALTH LEADERBOARD — sa Dashboard ng Member

   Parang sa laro:
     - PODIUM para sa Top 3 — may kahon (1 sa gitna at
       pinakamataas, 2 sa kaliwa, 3 sa kanan) at korona sa #1
     - LISTAHAN para sa #4 pababa, sa ilalim ng podium

   Naka-highlight ang org ng naka-login ("Your org"), at may
   paalala kung ilang puntos pa bago maabutan ang nasa itaas.

   Data: fetchOrgLeaderboard() → org_health_leaderboard() sa
   Supabase (ORG_HEALTH_LEADERBOARD.sql). Ang database ang
   nagkukuwenta at nag-aayos; tabla = parehong rank.

   GALAW: umaangat ang mga kahon pagbukas (3 → 2 → 1), saka
   lumalabas ang mga org. prefers-reduced-motion: walang galaw.
   ============================================================ */

/* Ilang row ng #4 pababa ang ipapakita bago ang "Show all" */
const LIST_PREVIEW = 5

const PLACES = ['gold', 'silver', 'bronze']

function OrgLeaderboard() {
  const [board, setBoard] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let active = true

    fetchOrgLeaderboard()
      .then((result) => {
        if (active) setBoard(result)
      })
      .catch((err) => {
        console.error('Hindi makuha ang leaderboard:', err)
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [])

  const ranked = board?.ranked ?? []
  const unranked = board?.unranked ?? []
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const shownRest = showAll ? rest : rest.slice(0, LIST_PREVIEW)

  return (
    <section className={styles.board} aria-labelledby="org-leaderboard-title">
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.eyebrow}>
            <Trophy size={14} strokeWidth={2.6} aria-hidden="true" />
            Org Health Leaderboard
          </p>
          <h2 id="org-leaderboard-title" className={styles.title}>
            Who&apos;s the <span>healthiest</span> org?
          </h2>
        </div>

        {board && <MyStanding ranked={ranked} unranked={unranked} />}
      </header>

      {failed ? (
        <p className={styles.message}>
          We couldn&apos;t load the leaderboard right now. Please try again later.
        </p>
      ) : !board ? (
        <LoadingStage />
      ) : ranked.length === 0 ? (
        <div className={styles.emptyStage}>
          <Trophy size={40} strokeWidth={1.8} aria-hidden="true" />
          <p className={styles.emptyTitle}>The race hasn&apos;t started yet</p>
          <p className={styles.emptyText}>
            Orgs get a health score once they finish an event with attendees. Join events and
            complete your Time In and Time Out to put your org on the board!
          </p>
        </div>
      ) : (
        <>
          <div className={styles.stage}>
            <Confetti />
            <ol className={styles.podium} aria-label="Top 3 organizations">
              {PLACES.map((place, i) => (
                <PodiumSpot key={place} place={place} entry={top3[i]} />
              ))}
            </ol>
          </div>

          {rest.length > 0 && (
            <>
              <ol className={styles.list} aria-label="Other ranked organizations">
                {shownRest.map((entry) => (
                  <ListRow key={entry.organization_id} entry={entry} />
                ))}
              </ol>

              {rest.length > LIST_PREVIEW && (
                <button
                  type="button"
                  className={`${styles.more} ${showAll ? styles.moreOpen : ''}`}
                  onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}
                >
                  {showAll ? 'Show less' : `Show all ${ranked.length} ranked orgs`}
                  <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </>
      )}

      {board && (
        <footer className={styles.foot}>
          {unranked.length > 0 && (
            <p className={styles.unranked}>
              <b>Not ranked yet:</b> {unrankedNames(unranked)}. They need a finished event with
              attendees first.
            </p>
          )}

          <details className={styles.how}>
            <summary>
              <Info size={15} strokeWidth={2.4} aria-hidden="true" />
              How is the score computed?
            </summary>
            <p>
              <b>Health Score</b> is the average of two rates from the org&apos;s finished events:
              the <b>Attendance Rate</b> (members who joined and completed both Time In and Time
              Out) and the <b>Participation Rate</b> (active members who attended at least one
              event). Cancelled events don&apos;t count.
            </p>
          </details>
        </footer>
      )}
    </section>
  )
}

/* ---------- PODIUM ---------- */

function PodiumSpot({ place, entry }) {
  /* Wala pang pangatlo (o pangalawa): bakanteng puwesto */
  if (!entry) {
    return (
      <li className={`${styles.spot} ${styles[place]} ${styles.vacant}`}>
        <div className={styles.player}>
          <span className={`${styles.logoWrap} ${styles.logoVacant}`} aria-hidden="true">
            ?
          </span>
          <p className={styles.spotName}>Up for grabs</p>
        </div>
        <div className={styles.block} aria-hidden="true" />
      </li>
    )
  }

  const tone = toneOf(entry.classification)

  return (
    <li
      className={`${styles.spot} ${styles[place]} ${entry.is_mine ? styles.spotMine : ''}`}
      aria-label={`Rank ${entry.rank}: ${entry.organization_name}, health score ${formatScore(
        entry.score,
      )}%${entry.is_mine ? ' (your org)' : ''}`}
    >
      <div className={styles.player}>
        {entry.rank === 1 && (
          <span className={styles.crown} aria-hidden="true">
            <Crown size={30} strokeWidth={2.2} />
          </span>
        )}

        <span className={styles.logoWrap}>
          <Avatar
            src={entry.logo_url}
            name={entry.organization_name}
            className={styles.logo}
          />
        </span>

        <p className={styles.spotName} title={entry.organization_name}>
          {entry.organization_name}
        </p>

        <p className={styles.spotScore}>
          <b>{formatScore(entry.score)}</b>
          <small>%</small>
        </p>

        {entry.is_mine ? (
          <span className={styles.youTag}>Your org</span>
        ) : (
          <span className={`${styles.chip} ${styles[tone]}`}>{entry.classification}</span>
        )}
      </div>

      <div className={styles.block} aria-hidden="true">
        <span className={styles.blockNum}>{entry.rank}</span>
      </div>
    </li>
  )
}

/* ---------- #4 PABABA ---------- */

function ListRow({ entry }) {
  const tone = toneOf(entry.classification)
  const pct = Math.max(0, Math.min(100, Number(entry.score)))

  return (
    <li className={`${styles.row} ${entry.is_mine ? styles.rowMine : ''}`}>
      <span className={styles.rank}>{entry.rank}</span>

      <Avatar src={entry.logo_url} name={entry.organization_name} className={styles.rowLogo} />

      <span className={styles.rowMain}>
        <span className={styles.rowName}>
          <span className={styles.rowNameText}>{entry.organization_name}</span>
          {entry.is_mine && <span className={styles.youTagSm}>Your org</span>}
        </span>
        <span className={`${styles.bar} ${styles[tone]}`} aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </span>

      <span className={styles.rowScore}>
        <b>{formatScore(entry.score)}%</b>
        <span className={`${styles.chip} ${styles[tone]}`}>{entry.classification}</span>
      </span>
    </li>
  )
}

/* ---------- PUWESTO NG ORG MO ----------
   #1        → "Your org is #1!"
   may rank  → "#5 · 3.4 pts behind #4"
   walang    → "Not ranked yet"
   walang org (hal. walang membership) → wala */
function MyStanding({ ranked, unranked }) {
  const mine = ranked.find((e) => e.is_mine)

  if (!mine) {
    if (!unranked.some((e) => e.is_mine)) return null
    return (
      <p className={styles.standing}>
        <span className={styles.standingLabel}>Your org</span>
        <b>Not ranked yet</b>
      </p>
    )
  }

  if (mine.rank === 1) {
    return (
      <p className={`${styles.standing} ${styles.standingTop}`}>
        <span className={styles.standingLabel}>Your org is</span>
        <b>#1 — keep it up!</b>
      </p>
    )
  }

  /* Ang pinakamalapit na org na mas mataas ang score */
  const ahead = [...ranked].reverse().find((e) => Number(e.score) > Number(mine.score))
  const gap = ahead ? Number(ahead.score) - Number(mine.score) : null

  return (
    <p className={styles.standing}>
      <span className={styles.standingLabel}>Your org is</span>
      <b>#{mine.rank}</b>
      {gap != null && (
        <span className={styles.standingGap}>
          {formatScore(Math.round(gap * 10) / 10)} pts behind #{ahead.rank}
        </span>
      )}
    </p>
  )
}

function unrankedNames(list) {
  const names = list.map((e) => e.organization_name)
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
}

/* ---------- PALAMUTI ---------- */

/* Mga piraso ng confetti sa likod ng podium (posisyon sa %, kulay) */
const CONFETTI = [
  { x: 6, y: 18, r: 20, c: 'y', s: 'bar' },
  { x: 3, y: 62, r: -30, c: 'w', s: 'dot' },
  { x: 22, y: 12, r: 45, c: 'b', s: 'bar' },
  { x: 31, y: 36, r: 0, c: 'y', s: 'star' },
  { x: 40, y: 8, r: -15, c: 'w', s: 'bar' },
  { x: 60, y: 10, r: 25, c: 'y', s: 'dot' },
  { x: 68, y: 34, r: 0, c: 'w', s: 'star' },
  { x: 77, y: 14, r: -40, c: 'y', s: 'bar' },
  { x: 86, y: 46, r: 60, c: 'b', s: 'bar' },
  { x: 94, y: 20, r: 0, c: 'y', s: 'dot' },
]

function Confetti() {
  return (
    <span className={styles.confetti} aria-hidden="true">
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          className={`${styles.bit} ${styles[`bit_${p.s}`]} ${styles[`bit_${p.c}`]}`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            '--rot': `${p.r}deg`,
            animationDelay: `${(i % 5) * 0.6}s`,
          }}
        />
      ))}
    </span>
  )
}

function LoadingStage() {
  return (
    <div className={`${styles.stage} ${styles.loading}`} aria-busy="true" aria-label="Loading">
      <ol className={styles.podium} aria-hidden="true">
        {PLACES.map((place) => (
          <li key={place} className={`${styles.spot} ${styles[place]} ${styles.vacant}`}>
            <div className={styles.player}>
              <span className={`${styles.logoWrap} ${styles.logoVacant}`} />
              <span className={styles.skelLine} />
            </div>
            <div className={styles.block} />
          </li>
        ))}
      </ol>
    </div>
  )
}

export default OrgLeaderboard
