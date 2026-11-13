import { useId, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { PHASE_CLOSED, attendancePhase, formatClock } from '../lib/attendance.js'
import styles from './AttendanceOverview.module.css'

/* ============================================================
   ATTENDANCE OVERVIEW — nasa ibaba ng "Joined by me"
   (Member at Officer)

   Sarado (default): maliit na pabilog na graph + "86% attendance
   rate" + "6 of 7 counted events attended" + "View overview".
   Bukas: malaking pabilog na graph na hinati ayon sa lagay,
   bilang ng bawat isa, bawat event ayon sa petsa, at kung bakit
   missed ang bawat missed na event.

   PAREHO ANG PATAKARAN SA DASHBOARD (attendance_summary() sa
   database):
     - mga event na SINALIHAN mo lang
     - kasama lang kapag SARADO NA ang Time Out (1 oras pagkatapos
       ng End) — PHASE_CLOSED sa lib/attendance.js
     - Attended = may Time Out (kaya may Time In at Time Out)
     - Time In lang, walang Time Out → missed
   Ang bilang ay galing sa mga event at Time In/Out na nakuha na
   ng Attendance page — walang bagong tawag sa database.

   Props:
     events — ang mga sinalihang event (may id, title, event_date,
              start_time, end_date, end_time)
     mine   — { [event_id]: { time_in, time_out } }
     now    — oras ngayon (nowKey()), para sa PHASE_CLOSED
   ============================================================ */

const ATTENDED = 'attended'
const NO_OUT = 'noOut'
const NO_IN = 'noIn'
const PENDING = 'pending'

const LABELS = {
  [ATTENDED]: 'Attended',
  [NO_OUT]: 'Missed — no Time Out',
  [NO_IN]: 'Missed — no Time In',
  [PENDING]: 'Not counted yet',
}

/* "2026-11-06" → "Nov 6" */
function shortDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

/* Lagay ng isang event para sa rate */
function resultOf(event, record, now) {
  if (attendancePhase(event, now) !== PHASE_CLOSED) return PENDING
  if (record?.time_out) return ATTENDED
  if (record?.time_in) return NO_OUT
  return NO_IN
}

/* Pabilog na graph. parts = [{ key, value }] */
function Donut({ parts, total, size, stroke, children }) {
  const r = 50 - stroke / 2
  const shown = parts.filter((p) => p.value > 0)
  const gap = shown.length > 1 ? 1.2 : 0

  let start = 0
  const arcs = shown.map((p) => {
    const length = (p.value / total) * 100
    const arc = { key: p.key, start, length: Math.max(0, length - gap) }
    start += length
    return arc
  })

  return (
    <span className={styles.donut} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className={styles.track} cx="50" cy="50" r={r} strokeWidth={stroke} pathLength="100" />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.key}
              className={`${styles.arc} ${styles[a.key]}`}
              cx="50"
              cy="50"
              r={r}
              strokeWidth={stroke}
              pathLength="100"
              strokeDasharray={`${a.length} ${100 - a.length}`}
              strokeDashoffset={-a.start}
            />
          ))}
      </svg>
      {children && <span className={styles.donutCenter}>{children}</span>}
    </span>
  )
}

function AttendanceOverview({ events, mine, now }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const data = useMemo(() => {
    /* Pinakaluma una, para makita ang takbo ng attendance mo */
    const rows = [...events]
      .sort((a, b) =>
        `${a.event_date} ${a.start_time}`.localeCompare(`${b.event_date} ${b.start_time}`),
      )
      .map((e) => ({ event: e, record: mine[e.id], result: resultOf(e, mine[e.id], now) }))

    const count = (key) => rows.filter((r) => r.result === key).length
    const attended = count(ATTENDED)
    const noOut = count(NO_OUT)
    const noIn = count(NO_IN)
    const pending = count(PENDING)
    const counted = attended + noOut + noIn

    return {
      rows,
      attended,
      noOut,
      noIn,
      pending,
      counted,
      rate: counted > 0 ? Math.round((attended / counted) * 100) : null,
      missed: rows.filter((r) => r.result === NO_OUT || r.result === NO_IN),
    }
  }, [events, mine, now])

  const parts = [
    { key: ATTENDED, value: data.attended },
    { key: NO_OUT, value: data.noOut },
    { key: NO_IN, value: data.noIn },
  ]
  const rateText = data.rate === null ? '—' : `${data.rate}%`

  return (
    <section className={`${styles.overview} ${open ? styles.open : ''}`} aria-label="Attendance overview">
      {/* ---------- SARADO: maliit na linya ---------- */}
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Donut parts={parts} total={data.counted} size={46} stroke={14} />
        <span className={styles.toggleText}>
          <span className={styles.toggleRate}>
            <b>{rateText}</b> attendance rate
          </span>
          <span className={styles.toggleSub}>
            {data.counted > 0
              ? `${data.attended} of ${data.counted} counted events attended`
              : 'No finished events yet'}
          </span>
        </span>
        <span className={styles.toggleAction}>
          {open ? 'Hide overview' : 'View overview'}
          <ChevronDown className={styles.chevron} size={16} strokeWidth={2.6} aria-hidden="true" />
        </span>
      </button>

      {/* ---------- BUKAS ---------- */}
      {open && (
        <div id={panelId} className={styles.panel}>
          <div className={styles.breakdown}>
            <Donut parts={parts} total={data.counted} size={148} stroke={16}>
              <b>{rateText}</b>
              <span>{data.counted > 0 ? `${data.attended} of ${data.counted}` : 'not yet'}</span>
            </Donut>

            <ul className={styles.legend}>
              <li>
                <span className={`${styles.key} ${styles.keyAttended}`} aria-hidden="true" />
                <span className={styles.legendLabel}>Attended — Time In and Time Out</span>
                <b>{data.attended}</b>
              </li>
              <li>
                <span className={`${styles.key} ${styles.keyNoOut}`} aria-hidden="true" />
                <span className={styles.legendLabel}>Missed — no Time Out</span>
                <b>{data.noOut}</b>
              </li>
              <li>
                <span className={`${styles.key} ${styles.keyNoIn}`} aria-hidden="true" />
                <span className={styles.legendLabel}>Missed — no Time In</span>
                <b>{data.noIn}</b>
              </li>
              <li className={styles.legendPending}>
                <span className={`${styles.key} ${styles.keyPending}`} aria-hidden="true" />
                <span className={styles.legendLabel}>Not counted yet</span>
                <b>{data.pending}</b>
              </li>
            </ul>
          </div>

          {/* Bawat event ayon sa petsa */}
          <h3 className={styles.heading}>Event by event</h3>
          <ol className={styles.strip}>
            {data.rows.map(({ event, result }) => (
              <li
                key={event.id}
                className={styles.tile}
                title={`${event.title} · ${LABELS[result]}`}
              >
                <span className={`${styles.square} ${styles[`sq_${result}`]}`} aria-hidden="true" />
                <span className={styles.tileDate}>{shortDate(event.event_date)}</span>
                <span className={styles.srOnly}>
                  {event.title}: {LABELS[result]}
                </span>
              </li>
            ))}
          </ol>

          {/* Kung bakit missed */}
          {data.missed.length > 0 && (
            <ul className={styles.missedList}>
              {data.missed.map(({ event, record, result }) => (
                <li key={event.id} className={styles.missed}>
                  <AlertCircle size={18} strokeWidth={2.4} aria-hidden="true" />
                  <span>
                    <b>
                      {event.title} · {shortDate(event.event_date)}
                    </b>
                    <span>
                      {result === NO_OUT
                        ? `Time In at ${formatClock(record.time_in)}, but no Time Out — so it counts as missed.`
                        : 'No Time In and no Time Out — so it counts as missed.'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.note}>
            Counted once an event's Time Out closes, 1 hour after it ends.
          </p>
        </div>
      )}
    </section>
  )
}

export default AttendanceOverview
