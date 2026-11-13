import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  MODE_IN,
  MODE_OUT,
  PHASE_BEFORE,
  PHASE_ONGOING,
  QR_REFRESH_SECONDS,
  attendanceErrorMessage,
  attendancePhase,
  fetchEventAttendance,
  formatClock,
  issueAttendanceToken,
  modeForPhase,
  qrValueFor,
} from '../lib/attendance.js'
import { nowKey } from '../lib/events.js'
import styles from './MyQrDialog.module.css'

/* ============================================================
   MY QR — para sa Member at Officer na nag-Join

   Ipinapakita ang QR na ii-scan ng Officer/Adviser.
   Bawat 25 segundo ay kumukuha ng BAGONG QR; ang luma ay
   mag-e-expire pagkalipas ng 45 segundo. Kaya kahit i-screenshot
   at ipasa sa iba, hindi na ito gagana.

   Kasabay ng pag-refresh, sinisilip din kung na-scan ka na,
   para makita mo agad ang Time In / Time Out mo.

   Habang bukas, sinusubukang pigilan ang pag-dim/pag-lock ng
   screen (Wake Lock) para hindi mawala ang QR sa pila.

   ORAS: Time In mula 30 min bago ang Start hanggang Start;
   sarado habang nagaganap; Time Out mula End hanggang 1 oras.
   Kapag lumipat ang yugto habang bukas ito (hal. nagsimula na
   ang event), kukuha agad ulit — at ang database na ang
   magsasabing sarado na, kaya mawawala agad ang QR.
   ============================================================ */

const MODE_LABEL = { [MODE_IN]: 'Time In', [MODE_OUT]: 'Time Out' }

/* Badge sa header: TIME IN (dilaw) / TIME OUT (puti) / sarado */
const MODE_BADGE = { [MODE_IN]: 'badgeIn', [MODE_OUT]: 'badgeOut' }
const CLOSED_LABEL = {
  [PHASE_BEFORE]: 'Not open yet',
  [PHASE_ONGOING]: 'Event in progress',
}

/* ---------- Maliliit na icon (inline, walang dependency) ---------- */
function Icon({ children, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const TicketIcon = () => (
  <Icon size={14}>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M13 6v12" strokeDasharray="2 2.5" />
  </Icon>
)
const CloseIcon = () => (
  <Icon size={16}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
const ClockIcon = () => (
  <Icon size={13}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
const InIcon = () => (
  <Icon>
    <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
  </Icon>
)
const OutIcon = () => (
  <Icon>
    <path d="M14 7l-5 5 5 5M9 12h12M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
  </Icon>
)
const CheckIcon = () => (
  <Icon>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)
const ShieldIcon = () => (
  <Icon size={15}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
)
const AlertIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
)
const SpinnerIcon = () => (
  <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

/* Isang cell: Time In o Time Out */
function StatusCell({ label, value, done, icon }) {
  return (
    <div className={`${styles.statusCell} ${done ? styles.statusDone : ''}`}>
      <span className={styles.statusIcon}>{done ? <CheckIcon /> : icon}</span>
      <span className={styles.statusText}>
        <span className={styles.statusLabel}>{label}</span>
        <span className={styles.statusValue}>{value}</span>
      </span>
    </div>
  )
}
const PHASE_CHECK_MS = 5000
function MyQrDialog({ event, profileId, onClose }) {
  const [token, setToken] = useState(null)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(QR_REFRESH_SECONDS)
  const [mine, setMine] = useState(null)
  const [phase, setPhase] = useState(() => attendancePhase(event, nowKey()))
  const mode = modeForPhase(phase)

  /* Kapag may error na galing sa database (hal. "Kumpleto na
     ang attendance mo"), huminto na sa pag-refresh */
  const stoppedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (stoppedRef.current) return
    try {
      const [t, att] = await Promise.all([
        issueAttendanceToken(event.id),
        fetchEventAttendance(event.id),
      ])
      setToken(t.token)
      setMine(att[profileId] ?? null)
      setError('')
    } catch (err) {
      console.error('Hindi makakuha ng QR:', err)
      setToken(null)
      setError(attendanceErrorMessage(err))

      /* Mensahe ng database = hindi na magbabago kahit
         subukan ulit. Ang error sa network ay susubukan ulit. */
      if (err?.code === 'P0001') {
        stoppedRef.current = true
        try {
          const att = await fetchEventAttendance(event.id)
          setMine(att[profileId] ?? null)
        } catch {
          /* hindi kritikal */
        }
      }
    } finally {
      setSecondsLeft(QR_REFRESH_SECONDS)
    }
  }, [event.id, profileId])

  /* Unang kuha + countdown. Kapag umabot sa 0, kukuha ng bago. */
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft === 0) refresh()
  }, [secondsLeft, refresh])

  /* Bantayan ang oras. Kapag nagbago ang yugto (hal. Time In →
     nagaganap), kumuha agad ng bago para hindi na makita ang
     QR na hindi na tatanggapin. */
  const phaseRef = useRef(phase)
  useEffect(() => {
    const timer = setInterval(() => {
      const next = attendancePhase(event, nowKey())
      if (next === phaseRef.current) return
      phaseRef.current = next
      setPhase(next)
      stoppedRef.current = false
      refresh()
    }, PHASE_CHECK_MS)
    return () => clearInterval(timer)
  }, [event, refresh])

  /* Kapag bumalik sa app (hal. galing sa ibang tab), kumuha
     agad ng bago — baka luma na ang nakikita */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  /* Wake Lock — hindi lahat ng browser ay may ganito */
  useEffect(() => {
    let lock = null
    let cancelled = false
    navigator.wakeLock
      ?.request('screen')
      .then((l) => {
        if (cancelled) l.release()
        else lock = l
      })
      .catch(() => {})
    return () => {
      cancelled = true
      lock?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const timeIn = mine?.time_in ? formatClock(mine.time_in) : '—'
  const timeOut = mine?.time_out ? formatClock(mine.time_out) : '—'

  const badgeClass = mode ? styles[MODE_BADGE[mode]] : ''
  const badgeText = mode ? `${MODE_LABEL[mode]} open` : CLOSED_LABEL[phase] ?? 'Attendance closed'
  const progress = (secondsLeft / QR_REFRESH_SECONDS) * 100

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="my-qr-title">
        {/* ---------- ITAAS: asul na header + QR card ---------- */}
        <div className={styles.top}>
          <div className={styles.topRow}>
            <span className={styles.eyebrow}>
              <TicketIcon />
              Attendance Pass
            </span>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <h2 id="my-qr-title" className={styles.heading}>
            {event.title}
          </h2>

          <span className={`${styles.badge} ${badgeClass}`}>
            <span className={styles.badgeDot} />
            {badgeText}
          </span>

          <div className={styles.qrCard}>
            <div className={styles.qrFrame}>
              {token ? (
                /* key = token → bawat bagong QR ay may maikling fade-in */
                <QRCodeSVG
                  key={token}
                  className={styles.qrCode}
                  value={qrValueFor(token)}
                  size={260}
                  level="M"
                  marginSize={1}
                  fgColor="#031b4b"
                  title={`Your ${mode ? MODE_LABEL[mode] : 'attendance'} QR code`}
                />
              ) : (
                <div className={styles.qrPlaceholder} role="status">
                  {error ? <AlertIcon /> : <SpinnerIcon />}
                  <span>{error || 'Getting your QR…'}</span>
                </div>
              )}
            </div>

            {token && (
              <div className={styles.timer}>
                <div className={styles.timerTrack} aria-hidden="true">
                  <div
                    className={`${styles.timerBar} ${secondsLeft <= 5 ? styles.timerBarLow : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={styles.timerText}>
                  <ClockIcon />
                  {secondsLeft}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ---------- PERFORATION ---------- */}
        <div className={styles.perforation} aria-hidden="true">
          <span className={styles.notchLeft} />
          <span className={styles.notchRight} />
        </div>

        {/* ---------- IBABA: Time In / Time Out + paalala ---------- */}
        <div className={styles.bottom}>
          <div className={styles.status}>
            <StatusCell label="Time In" value={timeIn} done={Boolean(mine?.time_in)} icon={<InIcon />} />
            <StatusCell
              label="Time Out"
              value={timeOut}
              done={Boolean(mine?.time_out)}
              icon={<OutIcon />}
            />
          </div>

          <p className={styles.help}>
            <ShieldIcon />
            <span>
              Show this to an Officer or Adviser at the entrance and exit. Screenshots won&apos;t
              work — the code refreshes every {QR_REFRESH_SECONDS} seconds.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default MyQrDialog