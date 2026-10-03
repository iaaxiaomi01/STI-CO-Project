import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  QR_REFRESH_SECONDS,
  attendanceErrorMessage,
  fetchEventAttendance,
  formatClock,
  issueAttendanceToken,
  qrValueFor,
} from '../lib/attendance.js'
import styles from './AttendanceDialog.module.css'

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
   ============================================================ */
function MyQrDialog({ event, profileId, onClose }) {
  const [token, setToken] = useState(null)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(QR_REFRESH_SECONDS)
  const [mine, setMine] = useState(null)

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

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="my-qr-title">
        <div className={styles.header}>
          <div>
            <h2 id="my-qr-title" className={styles.heading}>
              Ang QR mo
            </h2>
            <p className={styles.sub}>{event.title}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Isara">
            ×
          </button>
        </div>

        <div className={styles.qrBox}>
          {token ? (
            <QRCodeSVG value={qrValueFor(token)} size={260} level="M" marginSize={2} />
          ) : (
            <div className={styles.qrPlaceholder}>{error || 'Kinukuha ang QR…'}</div>
          )}
        </div>

        {token && (
          <>
            <div className={styles.timer} aria-hidden="true">
              <div
                className={styles.timerBar}
                style={{ width: `${(secondsLeft / QR_REFRESH_SECONDS) * 100}%` }}
              />
            </div>
            <p className={styles.timerText}>Papalitan ang QR sa loob ng {secondsLeft}s</p>
          </>
        )}

        <div className={styles.myStatus}>
          <div className={`${styles.statusCell} ${mine?.time_in ? styles.statusCellDone : ''}`}>
            <span className={styles.statusLabel}>Time In</span>
            <span className={styles.statusValue}>{timeIn}</span>
          </div>
          <div className={`${styles.statusCell} ${mine?.time_out ? styles.statusCellDone : ''}`}>
            <span className={styles.statusLabel}>Time Out</span>
            <span className={styles.statusValue}>{timeOut}</span>
          </div>
        </div>

        <p className={styles.help}>
          Ipakita ito sa Officer o Adviser sa pasukan at labasan. Huwag i-screenshot — hindi ito
          gagana pagkalipas ng ilang segundo.
        </p>
      </div>
    </div>
  )
}

export default MyQrDialog
