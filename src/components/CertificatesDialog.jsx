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
      setLoadError('Hindi makuha ang listahan. Subukan ulit.')
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
        existing ? `Napalitan ang certificate ni ${name}.` : `Na-upload ang certificate ni ${name}.`,
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
    if (!window.confirm(`Alisin ang certificate ni ${name}?`)) return

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
      setNotice(`Inalis ang certificate ni ${name}.`)
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
      setError('Hindi ma-download ang certificate. Subukan ulit.')
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
          Para lang sa mga nakakumpleto ng event (may Time In at Time Out). Tig-isang file bawat
          tao — {CERT_ACCEPTED_LABEL}, hanggang 10 MB.
        </p>

        {timeOutOpen && (
          <p className={styles.pending}>
            Bukas pa ang Time Out hanggang {formatTime(outCloses)}, kaya maaaring madagdagan pa ang
            listahan.
          </p>
        )}

        {loading && <p className={styles.muted}>Kinukuha ang listahan…</p>}
        {loadError && <p className={base.error}>{loadError}</p>}

        {!loading && !loadError && (
          <>
            {completers.length === 0 ? (
              <p className={styles.muted}>
                Walang nakakumpleto ng event na ito (walang may Time In at Time Out pareho).
              </p>
            ) : (
              <>
                <div className={styles.summary}>
                  <span>
                    <strong>{withCert}</strong> sa {completers.length} ang may certificate na
                  </span>
                  {withCert < completers.length && (
                    <span className={styles.summaryLeft}>
                      {completers.length - withCert} pa ang wala
                    </span>
                  )}
                </div>

                {completers.length >= SEARCH_FROM && (
                  <input
                    type="search"
                    className={`${base.input} ${styles.search}`}
                    placeholder="Hanapin ang pangalan…"
                    aria-label="Hanapin ang pangalan"
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
                  <p className={styles.muted}>Walang tumutugma sa &ldquo;{search.trim()}&rdquo;.</p>
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
                                  {cert.uploaded_by_name && ` · ni ${cert.uploaded_by_name}`}
                                </span>
                              </span>
                              <span className={styles.fileActions}>
                                <button
                                  type="button"
                                  className={styles.action}
                                  onClick={() => handleDownload(row)}
                                  disabled={anyBusy}
                                >
                                  {rowBusy && busy.action === 'download' ? 'Binubuksan…' : 'I-download'}
                                </button>
                                {!isSelf && (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.action}
                                      onClick={() => pickFileFor(row)}
                                      disabled={anyBusy}
                                    >
                                      {uploading ? 'Ina-upload…' : 'Palitan'}
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.action} ${styles.remove}`}
                                      onClick={() => handleDelete(row)}
                                      disabled={anyBusy}
                                    >
                                      {rowBusy && busy.action === 'delete' ? 'Inaalis…' : 'Alisin'}
                                    </button>
                                  </>
                                )}
                              </span>
                            </div>
                          ) : isSelf ? (
                            <p className={styles.selfNote}>
                              Ikaw ito — ibang Officer o ang Adviser ang mag-a-upload ng
                              certificate mo.
                            </p>
                          ) : (
                            <button
                              type="button"
                              className={styles.drop}
                              onClick={() => pickFileFor(row)}
                              disabled={anyBusy}
                            >
                              {uploading ? (
                                'Ina-upload…'
                              ) : (
                                <>
                                  <span aria-hidden="true">⤒</span> Mag-upload o i-drop dito ang
                                  certificate
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
            Isara
          </button>
        </div>
      </div>
    </div>
  )
}

export default CertificatesDialog
