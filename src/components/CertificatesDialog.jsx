import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.js'
import {
  CERT_ACCEPT,
  CERT_ACCEPTED_LABEL,
  canUploadCertificateFor,
  certificateErrorMessage,
  completerLabel,
  deleteCertificate,
  downloadCertificate,
  fetchCompleters,
  fetchEventCertificates,
  uploadCertificate,
} from '../lib/certificates.js'
import { PHASE_OUT, attendancePhase, attendanceWindows, formatClock } from '../lib/attendance.js'
import { formatTime, nowKey } from '../lib/events.js'
import { formatFileSize } from '../lib/proposalFiles.js'
import base from './ProposalForm.module.css'
import styles from './CertificatesDialog.module.css'

/* ============================================================
   CERTIFICATES DIALOG — ang drop box ng certificate

   Para sa Officer at Adviser ng org, sa mga event na tapos na.

   Nakalista ang LAHAT ng nakakumpleto ng event (may Time In at
   Time Out). Bawat isa ay may sariling kahon:
     - "Mag-upload" o i-drag ang file papunta sa kahon nila
     - kapag may certificate na: I-download · Palitan · Alisin

   Hindi pwedeng i-upload ng Officer ang sarili niyang
   certificate — ibang Officer o ang Adviser ang gagawa.
   ============================================================ */

/* Lalabas lang ang search kapag mahaba na ang listahan */
const SEARCH_FROM = 8

function CertificatesDialog({ event, onClose }) {
  const { profile } = useAuth()

  const [completers, setCompleters] = useState([])
  const [certs, setCerts] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')

  /* { profileId, action: 'upload' | 'delete' | 'download' } */
  const [busy, setBusy] = useState(null)

  /* Kaninong kahon ang tinatapatan ng file na dina-drag */
  const [dragOver, setDragOver] = useState(null)

  /* Iisang <input type="file"> para sa lahat; dito nakatanda
     kung para kanino ang pipiliing file */
  const fileInput = useRef(null)
  const targetRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [list, map] = await Promise.all([
        fetchCompleters(event.id),
        fetchEventCertificates(event.id),
      ])
      setCompleters(list)
      setCerts(map)
      setLoadError('')
    } catch (err) {
      console.error('Hindi makuha ang listahan ng certificate:', err)
      setLoadError('Could not load the list. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [event.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  /* Bukas pa ang Time Out? Maaaring madagdagan pa ang listahan. */
  const timeOutOpen = attendancePhase(event, nowKey()) === PHASE_OUT
  const outCloses = attendanceWindows(event).outCloses.slice(11)

  const query = search.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!query) return completers
    return completers.filter((c) => completerLabel(c).name.toLowerCase().includes(query))
  }, [completers, query])

  const withCert = completers.filter((c) => certs[c.profile_id]).length

  /* ---------- MGA AKSYON ---------- */

  async function handleUpload(row, file) {
    if (!file || busy) return
    const { name } = completerLabel(row)
    setError('')
    setNotice('')
    setBusy({ profileId: row.profile_id, action: 'upload' })
    try {
      const existing = certs[row.profile_id] ?? null
      const saved = await uploadCertificate(event, row.profile_id, file, existing)
      setCerts((current) => ({ ...current, [row.profile_id]: saved }))
      setNotice(
        existing ? `Replaced ${name}'s certificate.` : `Uploaded ${name}'s certificate.`,
      )
    } catch (err) {
      console.error('Hindi na-upload ang certificate:', err)
      setError(`${name}: ${certificateErrorMessage(err)}`)
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(row) {
    const cert = certs[row.profile_id]
    if (!cert || busy) return
    const { name } = completerLabel(row)
    if (!window.confirm(`Remove ${name}'s certificate?`)) return

    setError('')
    setNotice('')
    setBusy({ profileId: row.profile_id, action: 'delete' })
    try {
      await deleteCertificate(cert)
      setCerts((current) => {
        const next = { ...current }
        delete next[row.profile_id]
        return next
      })
      setNotice(`Removed ${name}'s certificate.`)
    } catch (err) {
      console.error('Hindi naalis ang certificate:', err)
      setError(`${name}: ${certificateErrorMessage(err)}`)
    } finally {
      setBusy(null)
    }
  }

  async function handleDownload(row) {
    const cert = certs[row.profile_id]
    if (!cert || busy) return
    setError('')
    setBusy({ profileId: row.profile_id, action: 'download' })
    try {
      await downloadCertificate(cert)
    } catch (err) {
      console.error('Hindi ma-download ang certificate:', err)
      setError('Could not download the certificate. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  function pickFileFor(row) {
    targetRef.current = row
    fileInput.current?.click()
  }

  function onFilePicked(e) {
    const file = e.target.files?.[0]
    const row = targetRef.current
    /* Para mapili ulit ang parehong file mamaya */
    e.target.value = ''
    targetRef.current = null
    if (file && row) handleUpload(row, file)
  }

  /* ---------- DRAG & DROP ---------- */

  function dropProps(row, allowed) {
    if (!allowed) return {}
    return {
      onDragOver: (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        if (dragOver !== row.profile_id) setDragOver(row.profile_id)
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null)
      },
      onDrop: (e) => {
        e.preventDefault()
        setDragOver(null)
        handleUpload(row, e.dataTransfer.files?.[0])
      },
    }
  }

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className={`${base.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificates-title"
      >
        <h2 id="certificates-title" className={base.heading}>
          Certificates
        </h2>
        <p className={base.note}>
          <strong>{event.title}</strong>
          <br />
          Only for attendees who completed the event (with Time In and Time Out). One file per
          person — {CERT_ACCEPTED_LABEL}, up to 10 MB.
        </p>

        {timeOutOpen && (
          <p className={styles.pending}>
            Time Out is still open until {formatTime(outCloses)}, so more people may still be added to
            the list.
          </p>
        )}

        {loading && <p className={styles.muted}>Loading the list…</p>}
        {loadError && <p className={base.error}>{loadError}</p>}

        {!loading && !loadError && (
          <>
            {completers.length === 0 ? (
              <p className={styles.muted}>
                No one has completed this event (no one has both Time In and Time Out).
              </p>
            ) : (
              <>
                <div className={styles.summary}>
                  <span>
                    <strong>{withCert}</strong> of {completers.length} have a certificate
                  </span>
                  {withCert < completers.length && (
                    <span className={styles.summaryLeft}>
                      {completers.length - withCert} still without
                    </span>
                  )}
                </div>

                {completers.length >= SEARCH_FROM && (
                  <input
                    type="search"
                    className={`${base.input} ${styles.search}`}
                    placeholder="Search by name…"
                    aria-label="Search by name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}

                {error && (
                  <p className={base.error} role="alert">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className={styles.notice} role="status">
                    {notice}
                  </p>
                )}

                {visible.length === 0 ? (
                  <p className={styles.muted}>No matches for &ldquo;{search.trim()}&rdquo;.</p>
                ) : (
                  <ol className={styles.list}>
                    {visible.map((row) => {
                      const { name, role } = completerLabel(row)
                      const cert = certs[row.profile_id]
                      const isSelf = !canUploadCertificateFor(row.profile_id, profile)
                      const rowBusy = busy?.profileId === row.profile_id
                      const uploading = rowBusy && busy.action === 'upload'
                      const anyBusy = Boolean(busy)

                      return (
                        <li
                          key={row.profile_id}
                          className={`${styles.row} ${
                            dragOver === row.profile_id ? styles.rowDrag : ''
                          }`}
                          {...dropProps(row, !isSelf && !anyBusy)}
                        >
                          <div className={styles.person}>
                            <span className={styles.name}>{name}</span>
                            <span className={styles.role}>{role}</span>
                            <span className={styles.times}>
                              In {formatClock(row.time_in)} · Out {formatClock(row.time_out)}
                            </span>
                          </div>

                          {cert ? (
                            <div className={styles.fileBox}>
                              <span className={styles.fileIcon} aria-hidden="true">
                                ✓
                              </span>
                              <span className={styles.fileInfo}>
                                <span className={styles.fileName} title={cert.file_name}>
                                  {cert.file_name}
                                </span>
                                <span className={styles.fileMeta}>
                                  {formatFileSize(cert.file_size)}
                                  {cert.uploaded_by_name && ` · by ${cert.uploaded_by_name}`}
                                </span>
                              </span>
                              <span className={styles.fileActions}>
                                <button
                                  type="button"
                                  className={styles.action}
                                  onClick={() => handleDownload(row)}
                                  disabled={anyBusy}
                                >
                                  {rowBusy && busy.action === 'download' ? 'Opening…' : 'Download'}
                                </button>
                                {!isSelf && (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.action}
                                      onClick={() => pickFileFor(row)}
                                      disabled={anyBusy}
                                    >
                                      {uploading ? 'Uploading…' : 'Replace'}
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.action} ${styles.remove}`}
                                      onClick={() => handleDelete(row)}
                                      disabled={anyBusy}
                                    >
                                      {rowBusy && busy.action === 'delete' ? 'Removing…' : 'Remove'}
                                    </button>
                                  </>
                                )}
                              </span>
                            </div>
                          ) : isSelf ? (
                            <p className={styles.selfNote}>
                              This is you — another Officer or the Adviser will upload
                              your certificate.
                            </p>
                          ) : (
                            <button
                              type="button"
                              className={styles.drop}
                              onClick={() => pickFileFor(row)}
                              disabled={anyBusy}
                            >
                              {uploading ? (
                                'Uploading…'
                              ) : (
                                <>
                                  <span aria-hidden="true">⤒</span> Upload or drop the
                                  certificate here
                                </>
                              )}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </>
            )}
          </>
        )}

        <input
          ref={fileInput}
          type="file"
          accept={CERT_ACCEPT}
          className={base.hiddenInput}
          onChange={onFilePicked}
        />

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onClose} disabled={Boolean(busy)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default CertificatesDialog
