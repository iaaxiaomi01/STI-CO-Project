import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {
  MODE_IN,
  MODE_OUT,
  attendanceErrorMessage,
  formatClock,
  parseQrValue,
  scanAttendance,
} from '../lib/attendance.js'
import { toTitleCase } from '../lib/profile.js'
import styles from './AttendanceDialog.module.css'

/* ============================================================
   SCANNER — para sa Officer at Adviser

   Binubuksan ang camera ng phone. Pumili muna kung "Time In" o
   "Time Out", tapos itapat sa QR ng miyembro.

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

/* Iisang camera lang sa buong app; dito pumipila ang
   pagbukas at pagsara */
let cameraQueue = Promise.resolve()

function cameraErrorMessage(err) {
  if (!window.isSecureContext) {
    return 'Kailangan ng HTTPS para magamit ang camera. Buksan ang site gamit ang https:// (o localhost).'
  }
  const text = String(err?.name ?? err ?? '')
  if (text.includes('NotAllowed') || text.includes('Permission')) {
    return 'Walang pahintulot sa camera. Payagan ang camera sa settings ng browser, tapos buksan ulit ang scanner.'
  }
  if (text.includes('NotFound') || text.includes('DevicesNotFound')) {
    return 'Walang nakitang camera sa device na ito.'
  }
  if (text.includes('NotReadable')) {
    return 'Ginagamit ng ibang app ang camera. Isara muna iyon, tapos subukan ulit.'
  }
  return 'Hindi mabuksan ang camera. Subukan ulit.'
}

function AttendanceScanner({ event, totalJoined, initialCounts, onClose }) {
  const rawId = useId()
  const regionId = `qr-region-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const [mode, setMode] = useState(MODE_IN)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [result, setResult] = useState(null) // { kind, title, text }
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
  }, [mode])

  const handleDecoded = useCallback(
    async (text) => {
      if (busyRef.current) return

      const now = Date.now()
      if (text === lastRef.current.text && now - lastRef.current.at < SAME_QR_IGNORE_MS) return
      lastRef.current = { text, at: now }

      const token = parseQrValue(text)
      if (!token) {
        setResult({
          kind: 'error',
          title: 'Hindi ito QR ng attendance',
          text: 'Ipabukas sa miyembro ang "Ipakita ang QR" sa Attendance page.',
        })
        return
      }

      busyRef.current = true
      const currentMode = modeRef.current
      setResult({ kind: 'busy', title: 'Sinusuri…', text: '' })

      try {
        const r = await scanAttendance(token, event.id, currentMode)
        const label = MODE_LABEL[r.mode] ?? ''
        const when = formatClock(r.mode === MODE_OUT ? r.time_out : r.time_in)

        if (r.result === 'ok') {
          changedRef.current = true
          setCounts((c) =>
            r.mode === MODE_IN
              ? { ...c, timedIn: c.timedIn + 1 }
              : { ...c, timedOut: c.timedOut + 1 },
          )
          navigator.vibrate?.(80)
          setResult({ kind: 'ok', title: `✓ ${toTitleCase(r.name)}`, text: `${label} · ${when}` })
        } else {
          setResult({
            kind: 'already',
            title: toTitleCase(r.name),
            text: `Naka-${label} na kanina pa (${when}).`,
          })
        }
      } catch (err) {
        console.error('Hindi na-record ang scan:', err)
        navigator.vibrate?.([60, 60, 60])
        setResult({ kind: 'error', title: '✗ Hindi na-record', text: attendanceErrorMessage(err) })
      } finally {
        setTimeout(() => {
          busyRef.current = false
        }, PAUSE_AFTER_SCAN_MS)
      }
    },
    [event.id],
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

  const resultClass =
    {
      ok: styles.resultOk,
      already: styles.resultAlready,
      error: styles.resultError,
      busy: styles.resultBusy,
    }[result?.kind] ?? styles.resultIdle

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <div className={styles.header}>
          <div>
            <h2 id="scanner-title" className={styles.heading}>
              I-scan ang attendance
            </h2>
            <p className={styles.sub}>{event.title}</p>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Isara">
            ×
          </button>
        </div>

        <div className={styles.modes} role="radiogroup" aria-label="Uri ng scan">
          <button
            type="button"
            role="radio"
            aria-checked={mode === MODE_IN}
            className={`${styles.modeBtn} ${mode === MODE_IN ? styles.modeIn : ''}`}
            onClick={() => setMode(MODE_IN)}
          >
            Time In
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === MODE_OUT}
            className={`${styles.modeBtn} ${mode === MODE_OUT ? styles.modeOut : ''}`}
            onClick={() => setMode(MODE_OUT)}
          >
            Time Out
          </button>
        </div>

        <div className={styles.camera}>
          <div id={regionId} style={{ width: '100%', height: '100%' }} />
          {!cameraReady && (
            <div className={styles.cameraMsg}>{cameraError || 'Binubuksan ang camera…'}</div>
          )}
        </div>

        <div className={`${styles.result} ${resultClass}`} role="status" aria-live="polite">
          {result ? (
            <>
              <strong>{result.title}</strong>
              {result.text}
            </>
          ) : (
            <>Itapat ang camera sa QR ng miyembro. Mode ngayon: {MODE_LABEL[mode]}.</>
          )}
        </div>

        <div className={styles.tally}>
          <span>
            Time In: <strong>{counts.timedIn}</strong> / {totalJoined}
          </span>
          <span>
            Time Out: <strong>{counts.timedOut}</strong> / {counts.timedIn}
          </span>
        </div>
      </div>
    </div>
  )
}

export default AttendanceScanner
