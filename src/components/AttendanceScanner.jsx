import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {
  MODE_IN,
  MODE_OUT,
  PHASE_BEFORE,
  attendanceErrorMessage,
  attendancePhase,
  attendanceWindows,
  formatClock,
  formatWindowKey,
  modeForPhase,
  parseQrValue,
  scanAttendance,
} from '../lib/attendance.js'
import { nowKey } from '../lib/events.js'
import { toTitleCase } from '../lib/profile.js'
import styles from './AttendanceScanner.module.css'

/* ============================================================
   SCANNER — para sa Officer at Adviser

   Binubuksan ang camera ng phone, tapos itapat sa QR ng miyembro.

   Ang ORAS ang pumipili ng mode — hindi na ito pinipili:
     30 min bago ang Start → Start   Time In
     Start → End                     sarado (nagaganap)
     End → 1 oras pagkatapos         Time Out
   Kapag sarado, hindi tumatanggap ng scan.
   (Start = Start Date + Start Time · End = End Date + End Time.
   Sa maraming araw, may petsa ang mga oras sa mensahe.)

   Ang database ang nagsusuri (scan_attendance):
     - hindi expired ang QR at para sa event na ito
     - nag-Join ang tao (bawal ang walk-in)
     - bukas pa ang Time In / Time Out
     - hindi sarili mong QR

   Para hindi paulit-ulit na mag-record ang iisang QR habang
   nakatapat pa ang camera, may maikling pahinga pagkatapos ng
   bawat scan, at hindi pinapansin ang parehong QR sa loob ng
   ilang segundo.

   KAILANGAN NG HTTPS ang camera (o localhost habang nagde-develop).
   ============================================================ */

const PAUSE_AFTER_SCAN_MS = 1500
const SAME_QR_IGNORE_MS = 6000

const MODE_LABEL = { [MODE_IN]: 'Time In', [MODE_OUT]: 'Time Out' }
const PHASE_CHECK_MS = 5000

/* Mensahe kapag sarado ang pag-scan */
function closedMessage(event, phase) {
  const w = attendanceWindows(event)
  const at = (key) => formatWindowKey(key, event)
  if (phase === PHASE_BEFORE) {
    return `Not open yet. Time In is from ${at(w.inOpens)} to ${at(w.inCloses)}.`
  }
  if (nowKey() < w.outOpens) {
    return `The event is in progress — Time In and Time Out are closed. Time Out opens from ${at(w.outOpens)} to ${at(w.outCloses)}.`
  }
  return 'Attendance for this event is already closed.'
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

const ScanIcon = ({ size = 14 }) => (
  <Icon size={size}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" />
  </Icon>
)
const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
const CheckIcon = () => (
  <Icon>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)
const RepeatIcon = () => (
  <Icon>
    <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
  </Icon>
)
const AlertIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
)
const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
)
const SpinnerIcon = () => (
  <Icon>
    <path d="M21 12a9 9 0 1 1-9-9" />
  </Icon>
)
const CameraOffIcon = () => (
  <Icon size={30}>
    <path d="M3 3l18 18M9.5 5H15l1.5 2H19a2 2 0 0 1 2 2v8M17 19H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1" />
    <path d="M9.9 10.3a3 3 0 0 0 3.8 3.8" />
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

/* Icon at klase ng resulta, ayon sa uri */
const RESULT_LOOK = {
  idle: { cls: 'resultIdle', icon: <ScanIcon size={16} /> },
  closed: { cls: 'resultIdle', icon: <LockIcon /> },
  busy: { cls: 'resultBusy', icon: <SpinnerIcon /> },
  ok: { cls: 'resultOk', icon: <CheckIcon /> },
  already: { cls: 'resultAlready', icon: <RepeatIcon /> },
  error: { cls: 'resultError', icon: <AlertIcon /> },
}

/* Isang mode sa header — hindi pinipindot */
function ModePill({ label, active }) {
  return (
    <span
      className={`${styles.modeBtn} ${active ? styles.modeActive : ''}`}
      aria-current={active ? 'true' : undefined}
    >
      <span className={styles.modeDot} />
      {label}
    </span>
  )
}

/* Isang cell ng bilang */
function TallyCell({ label, icon, value, total }) {
  return (
    <div className={styles.tallyCell}>
      <span className={styles.tallyIcon}>{icon}</span>
      <span className={styles.tallyText}>
        <span className={styles.tallyLabel}>{label}</span>
        <span className={styles.tallyValue}>
          <strong>{value}</strong> / {total}
        </span>
      </span>
    </div>
  )
}

/* Iisang camera lang sa buong app; dito pumipila ang
   pagbukas at pagsara */
let cameraQueue = Promise.resolve()

function cameraErrorMessage(err) {
  if (!window.isSecureContext) {
    return 'HTTPS is required to use the camera. Open the site using https:// (or localhost).'
  }
  const text = String(err?.name ?? err ?? '')
  if (text.includes('NotAllowed') || text.includes('Permission')) {
    return 'No camera permission. Allow the camera in your browser settings, then reopen the scanner.'
  }
  if (text.includes('NotFound') || text.includes('DevicesNotFound')) {
    return 'No camera was found on this device.'
  }
  if (text.includes('NotReadable')) {
    return 'Another app is using the camera. Close it first, then try again.'
  }
  return 'Could not open the camera. Please try again.'
}

function AttendanceScanner({ event, totalJoined, initialCounts, onClose }) {
  const rawId = useId()
  const regionId = `qr-region-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const [phase, setPhase] = useState(() => attendancePhase(event, nowKey()))
  /* MODE_IN, MODE_OUT, o null kapag sarado */
  const mode = modeForPhase(phase)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [result, setResult] = useState(null) // { kind, title, text }
  /* Tumataas bawat resulta → maikling "flash" sa camera */
  const [flash, setFlash] = useState(0)
  const [counts, setCounts] = useState({
    timedIn: initialCounts?.timedIn ?? 0,
    timedOut: initialCounts?.timedOut ?? 0,
  })

  /* Mga ref para mabasa ng callback ng camera ang
     pinakabagong halaga nang hindi nire-restart ang camera */
  const modeRef = useRef(mode)
  const busyRef = useRef(false)
  const lastRef = useRef({ text: '', at: 0 })
  const changedRef = useRef(false)

  useEffect(() => {
    modeRef.current = mode
    /* Bagong mode = pwedeng i-scan ulit ang parehong QR */
    lastRef.current = { text: '', at: 0 }
    setResult(null)
  }, [mode])

  /* Bantayan ang oras para lumipat ang mode nang kusa */
  useEffect(() => {
    const timer = setInterval(() => setPhase(attendancePhase(event, nowKey())), PHASE_CHECK_MS)
    return () => clearInterval(timer)
  }, [event])

  const handleDecoded = useCallback(
    async (text) => {
      if (busyRef.current) return

      const now = Date.now()
      if (text === lastRef.current.text && now - lastRef.current.at < SAME_QR_IGNORE_MS) return
      lastRef.current = { text, at: now }

      const currentMode = modeRef.current
      if (!currentMode) {
        setResult({
          kind: 'error',
          title: 'Attendance is closed',
          text: closedMessage(event, attendancePhase(event, nowKey())),
        })
        return
      }

      const token = parseQrValue(text)
      if (!token) {
        setResult({
          kind: 'error',
          title: 'This is not an attendance QR',
          text: 'Ask the member to open "Show QR" on the Attendance page.',
        })
        return
      }

      busyRef.current = true
      setResult({ kind: 'busy', title: 'Checking…', text: '' })

      try {
        const r = await scanAttendance(token, event.id, currentMode)
        const label = MODE_LABEL[r.mode] ?? ''
        const when = formatClock(r.mode === MODE_OUT ? r.time_out : r.time_in)

        setFlash((n) => n + 1)
        if (r.result === 'ok') {
          changedRef.current = true
          setCounts((c) =>
            r.mode === MODE_IN
              ? { ...c, timedIn: c.timedIn + 1 }
              : { ...c, timedOut: c.timedOut + 1 },
          )
          navigator.vibrate?.(80)
          setResult({ kind: 'ok', title: toTitleCase(r.name), text: `${label} · ${when}` })
        } else {
          setResult({
            kind: 'already',
            title: toTitleCase(r.name),
            text: `${label} was already recorded earlier (${when}).`,
          })
        }
      } catch (err) {
        console.error('Hindi na-record ang scan:', err)
        navigator.vibrate?.([60, 60, 60])
        setFlash((n) => n + 1)
        setResult({ kind: 'error', title: 'Not recorded', text: attendanceErrorMessage(err) })
      } finally {
        setTimeout(() => {
          busyRef.current = false
        }, PAUSE_AFTER_SCAN_MS)
      }
    },
    [event],
  )

  /* Ang callback ay laging pinakabago, pero hindi nire-restart
     ang camera kapag nagbago ito */
  const decodedRef = useRef(handleDecoded)
  useEffect(() => {
    decodedRef.current = handleDecoded
  }, [handleDecoded])

  /* ---------- CAMERA ----------
     Maingat ang pagbukas at pagsara: nakapila ang lahat sa
     cameraQueue para hindi magsabay ang dalawang start/stop.
     (Sa StrictMode ay dalawang beses tumatakbo ang effect
     habang nagde-develop.) */
  useEffect(() => {
    let cancelled = false
    let scanner = null

    const run = cameraQueue.then(async () => {
      if (cancelled) return false
      scanner = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      })
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w, h) => {
              const side = Math.floor(Math.min(w, h) * 0.7)
              return { width: side, height: side }
            },
          },
          (text) => decodedRef.current(text),
          () => {
            /* Walang QR sa frame na ito — normal lang */
          },
        )
        if (!cancelled) setCameraReady(true)
        return true
      } catch (err) {
        console.error('Hindi mabuksan ang camera:', err)
        if (!cancelled) setCameraError(cameraErrorMessage(err))
        return false
      }
    })
    cameraQueue = run.then(() => {})

    return () => {
      cancelled = true
      cameraQueue = cameraQueue
        .then(() => run)
        .then(async (ok) => {
          try {
            if (ok) await scanner.stop()
            scanner?.clear()
          } catch {
            /* sarado na */
          }
        })
    }
  }, [regionId])

  const close = useCallback(() => onClose(changedRef.current), [onClose])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  /* Ano ang ipapakita sa result card */
  const shown =
    result ??
    (cameraError
      ? { kind: 'error', title: 'Camera unavailable', text: 'Fix the camera issue above, then reopen the scanner.' }
      : {
          kind: mode ? 'idle' : 'closed',
          title: mode ? `Ready to scan · ${MODE_LABEL[mode]}` : 'Scanning is closed',
          text: mode ? "Point the camera at the member's QR code." : closedMessage(event, phase),
        })
  const look = RESULT_LOOK[shown.kind] ?? RESULT_LOOK.idle
  const flashClass =
    { ok: styles.flashOk, already: styles.flashAlready, error: styles.flashError }[result?.kind] ??
    ''

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        {/* ---------- ITAAS: dilaw na header + camera ---------- */}
        <div className={styles.top}>
          <div className={styles.topRow}>
            <span className={styles.eyebrow}>
              <ScanIcon />
              Attendance Scanner
            </span>
            <button type="button" className={styles.close} onClick={close} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <h2 id="scanner-title" className={styles.heading}>
            {event.title}
          </h2>

          {/* Hindi na pinipindot — ipinapakita lang kung alin ang bukas ngayon */}
          <div className={styles.modes} aria-label="Current scan type">
            <ModePill label="Time In" active={mode === MODE_IN} />
            <ModePill label="Time Out" active={mode === MODE_OUT} />
          </div>

          <div className={styles.cameraCard}>
            <div className={styles.cameraFrame}>
              <div className={styles.camera}>
                {/* Inline ang width/height: sine-set ng html5-qrcode ang
                    position: relative sa element na ito pagbukas ng camera,
                    kaya hindi pwedeng umasa sa position: absolute dito */}
                <div id={regionId} className={styles.region} style={{ width: '100%', height: '100%' }} />

                {/* Ang lugar na binabasa (70% sa gitna, katumbas ng qrbox)
                    + gumagalaw na guhit habang handang mag-scan */}
                {cameraReady && (
                  <span
                    className={`${styles.target} ${mode ? '' : styles.targetClosed}`}
                    aria-hidden="true"
                  >
                    {mode && result?.kind !== 'busy' && <span className={styles.scanLine} />}
                  </span>
                )}

                {/* key = flash → umuulit ang animation bawat resulta */}
                {flash > 0 && (
                  <span key={flash} className={`${styles.flash} ${flashClass}`} aria-hidden="true" />
                )}

                {!cameraReady && (
                  <div className={styles.cameraMsg}>
                    {cameraError ? <CameraOffIcon /> : <span className={styles.cameraSpinner} />}
                    <span>{cameraError || 'Opening camera…'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- PERFORATION ---------- */}
        <div className={styles.perforation} aria-hidden="true">
          <span className={styles.notchLeft} />
          <span className={styles.notchRight} />
        </div>

        {/* ---------- IBABA: resulta + bilang ---------- */}
        <div className={styles.bottom}>
          <div className={`${styles.result} ${styles[look.cls]}`} role="status" aria-live="polite">
            <span className={styles.resultIcon}>{look.icon}</span>
            <span className={styles.resultText}>
              <strong>{shown.title}</strong>
              {shown.text}
            </span>
          </div>

          <div className={styles.tally}>
            <TallyCell label="Time In" icon={<InIcon />} value={counts.timedIn} total={totalJoined} />
            <TallyCell
              label="Time Out"
              icon={<OutIcon />}
              value={counts.timedOut}
              total={counts.timedIn}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AttendanceScanner