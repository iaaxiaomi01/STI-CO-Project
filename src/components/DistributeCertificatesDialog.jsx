import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ImagePlus, Plus, Send, Trash2, X } from 'lucide-react'
import {
  MAX_SIGNATORIES,
  TEMPLATE_ACCEPT,
  canUploadCertificateFor,
  certificateErrorMessage,
  completerLabel,
  deleteCertificateTemplate,
  downloadTemplateImage,
  fetchAdviserNames,
  fetchCertificateSettings,
  fetchCertificateTemplates,
  fetchOrgForCertificate,
  saveCertificateSettings,
  templateLayout,
  updateTemplateLayout,
  uploadCertificate,
  uploadCertificateTemplate,
} from '../lib/certificates.js'
import {
  BUILT_IN_DESIGNS,
  CERT_TITLES,
  certificatePdf,
  drawCertificate,
  imageFromBlob,
  loadLogo,
} from '../lib/certificateDesigns.js'
import { formatEventDateRange } from '../lib/events.js'
import styles from './DistributeCertificatesDialog.module.css'

/* ============================================================
   DISTRIBUTE CERTIFICATES — CERTIFICATE_TEMPLATES.sql

   Bubukas mula sa Certificates dialog (Officer at Adviser).

     1. TEMPLATE  — handang disenyo (Classic, Modern, Elegant,
                    Minimal), o sariling disenyo ng org. Pwedeng
                    mag-upload ng bagong disenyo (blangkong
                    certificate na PNG/JPG). Sa sariling disenyo,
                    naaayos kung saan isusulat ang pangalan, kulay,
                    at kung may detalye at pirma.
     2. PAMAGAT   — hal. "Certificate of Participation"
     3. PIRMA     — hanggang 3 (pangalan at posisyon). Default: ang
                    Adviser ng org.
     4. KANINO    — sa wala pang certificate, o sa lahat (papalitan
                    ang dati).

   Live preview gamit ang pangalan ng unang tatanggap.

   "Distribute" → gagawa ng PDF para sa bawat isa, at ia-upload sa
   drop box (uploadCertificate). May notification ang bawat
   tatanggap (galing sa database, tulad ng manual na upload).
   Ang huling ginamit (template, pamagat, pirma) ay itinatabi para
   nakalagay na sa susunod.

   Hindi kasama ang SARILI mong certificate — ibang Officer o ang
   Adviser ang magbibigay nito (patakaran ng database).

   Props:
     event, completers, certs ({ [profile_id]: row }), profile
     onDistributed(newCerts, summary) — tapos na (kahit may pumalya)
     onClose
   ============================================================ */

const PREVIEW_FALLBACK_NAME = 'Juan Dela Cruz'

function blankSignatory() {
  return { name: '', position: '' }
}

function DistributeCertificatesDialog({ event, completers, certs, profile, onDistributed, onClose }) {
  const orgId = event.organization_id

  /* ---------- MGA KAILANGAN ---------- */
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [org, setOrg] = useState({ name: '', logo_url: null })
  const [logo, setLogo] = useState(null)
  const [templates, setTemplates] = useState([])
  /* { [template id]: { image, url } } — larawan ng sariling disenyo */
  const [images, setImages] = useState({})
  const imageUrls = useRef([])

  /* ---------- MGA PINILI ---------- */
  const [design, setDesign] = useState('classic') // key ng handang disenyo o 'custom:<id>'
  const [title, setTitle] = useState(CERT_TITLES[0])
  const [signatories, setSignatories] = useState([blankSignatory()])
  const [scope, setScope] = useState('missing') // 'missing' | 'all'
  /* Layout ng napiling sariling disenyo (hindi pa naka-save) */
  const [layout, setLayout] = useState(null)

  /* ---------- KALAGAYAN ---------- */
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null) // { done, total }
  const stopRef = useRef(false)
  const fileRef = useRef(null)
  const previewRef = useRef(null)

  const customId = design.startsWith('custom:') ? design.slice(7) : null
  const customTemplate = customId ? templates.find((t) => t.id === customId) ?? null : null
  const working = Boolean(progress) || uploading

  /* Kunin ang larawan ng isang sariling disenyo (minsan lang) */
  const loadImage = useCallback(async (template) => {
    const blob = await downloadTemplateImage(template)
    const image = await imageFromBlob(blob)
    const url = URL.createObjectURL(blob)
    imageUrls.current.push(url)
    setImages((current) => ({ ...current, [template.id]: { image, url } }))
  }, [])

  useEffect(
    () => () => {
      imageUrls.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  /* Pagbukas: org, logo, mga sariling disenyo, huling ginamit, Adviser */
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [orgRow, list, saved, advisers] = await Promise.all([
          fetchOrgForCertificate(orgId),
          fetchCertificateTemplates(),
          fetchCertificateSettings(orgId),
          fetchAdviserNames(orgId).catch(() => []),
        ])
        if (!active) return
        setOrg(orgRow)
        setTemplates(list)

        if (saved) {
          const savedCustom = saved.template.startsWith('custom:')
            ? list.some((t) => `custom:${t.id}` === saved.template)
            : true
          setDesign(savedCustom ? saved.template : 'classic')
          setTitle(saved.title || CERT_TITLES[0])
          const sigs = (saved.signatories ?? []).map((s) => ({
            name: s.name ?? '',
            position: s.position ?? '',
          }))
          setSignatories(sigs.length ? sigs : [blankSignatory()])
        } else if (advisers.length) {
          setSignatories([{ name: advisers[0], position: 'Adviser' }])
        }

        setLoading(false)

        /* Hindi kailangang hintayin — lalabas ang mga ito pagdating */
        loadLogo(orgRow.logo_url).then((img) => active && setLogo(img))
        list.forEach((t) =>
          loadImage(t).catch((err) => console.warn('Hindi ma-load ang disenyo:', err)),
        )
      } catch (err) {
        console.error('Hindi makuha ang templates:', err)
        if (active) {
          setLoadError('Could not load the certificate templates. Please try again.')
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [orgId, loadImage])

  /* Bagong napiling sariling disenyo → kunin ang layout nito */
  useEffect(() => {
    setLayout(customTemplate ? templateLayout(customTemplate) : null)
  }, [customTemplate])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !working) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [working, onClose])

  /* ---------- KANINO ---------- */
  const eligible = useMemo(
    () => completers.filter((c) => canUploadCertificateFor(c.profile_id, profile)),
    [completers, profile],
  )
  const missing = eligible.filter((c) => !certs[c.profile_id])
  const targets = scope === 'all' ? eligible : missing
  const selfIncluded = eligible.length < completers.length

  /* ---------- DATOS NG CERTIFICATE ---------- */
  const baseData = useMemo(
    () => ({
      design: customId ? 'custom' : design,
      background: customId ? images[customId]?.image ?? null : null,
      layout: layout ?? undefined,
      logo,
      orgName: org.name ?? '',
      title: title.trim() || CERT_TITLES[0],
      eventTitle: event.title,
      dateText: formatEventDateRange(event),
      location: event.location ?? '',
      signatories,
    }),
    [customId, design, images, layout, logo, org.name, title, event, signatories],
  )

  const previewName = targets[0]
    ? completerLabel(targets[0]).name
    : eligible[0]
      ? completerLabel(eligible[0]).name
      : PREVIEW_FALLBACK_NAME

  /* Live preview */
  useEffect(() => {
    if (loading || !previewRef.current) return
    drawCertificate(previewRef.current, { ...baseData, recipient: previewName })
  }, [loading, baseData, previewName])

  /* ---------- SARILING DISENYO ---------- */
  async function handlePickDesign(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const created = await uploadCertificateTemplate(orgId, file)
      setTemplates((list) => [created, ...list])
      await loadImage(created)
      setDesign(`custom:${created.id}`)
    } catch (err) {
      console.error('Hindi na-upload ang disenyo:', err)
      setError(certificateErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteDesign(template) {
    if (!window.confirm(`Delete the design "${template.name}"? Certificates already given stay.`)) {
      return
    }
    setError('')
    setUploading(true)
    try {
      await deleteCertificateTemplate(template)
      setTemplates((list) => list.filter((t) => t.id !== template.id))
      if (design === `custom:${template.id}`) setDesign('classic')
    } catch (err) {
      console.error('Hindi nabura ang disenyo:', err)
      setError(certificateErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  function setLayoutField(field, value) {
    setLayout((current) => ({ ...current, [field]: value }))
  }

  /* ---------- PIRMA ---------- */
  function setSignatory(i, field, value) {
    setSignatories((list) => list.map((s, j) => (j === i ? { ...s, [field]: value } : s)))
  }

  /* ---------- DISTRIBUTE ---------- */
  async function handleDistribute() {
    setError('')
    if (!title.trim()) {
      setError('Please enter the certificate title.')
      return
    }
    if (customId && !images[customId]) {
      setError('The design is still loading. Please wait a moment.')
      return
    }
    if (targets.length === 0) {
      setError('Everyone on the list already has a certificate.')
      return
    }

    stopRef.current = false
    setProgress({ done: 0, total: targets.length })

    /* Itabi ang settings (hindi kritikal kapag pumalya) */
    try {
      await saveCertificateSettings(orgId, { template: design, title, signatories })
      if (customTemplate && layout) {
        const saved = await updateTemplateLayout(customTemplate.id, layout)
        setTemplates((list) => list.map((t) => (t.id === saved.id ? saved : t)))
      }
    } catch (err) {
      console.warn('Hindi naitabi ang settings ng certificate:', err)
    }

    const canvas = document.createElement('canvas')
    const made = {}
    const failed = []
    let done = 0

    for (const row of targets) {
      if (stopRef.current) break
      const { name } = completerLabel(row)
      try {
        const blob = await certificatePdf({ ...baseData, recipient: name }, canvas)
        const file = new File([blob], `Certificate - ${name}.pdf`.replace(/[\\/:*?"<>|]/g, ''), {
          type: 'application/pdf',
        })
        made[row.profile_id] = await uploadCertificate(
          event,
          row.profile_id,
          file,
          certs[row.profile_id] ?? null,
        )
      } catch (err) {
        console.error('Hindi nagawa ang certificate ni', name, err)
        failed.push({ name, message: certificateErrorMessage(err) })
      }
      done += 1
      setProgress({ done, total: targets.length })
    }

    setProgress(null)
    onDistributed(made, {
      given: Object.keys(made).length,
      failed,
      stopped: stopRef.current,
      selfIncluded,
    })
  }

  /* ---------- ITSURA ----------
     Sa document.body (portal), para hindi maapektuhan ng itsura ng
     Certificates dialog na nasa ilalim nito. */
  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !working) onClose()
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="distribute-title"
      >
        <div className={styles.head}>
          <div>
            <h2 id="distribute-title" className={styles.heading}>
              Distribute certificates
            </h2>
            <p className={styles.sub}>{event.title}</p>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            disabled={working}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {loading && <p className={styles.muted}>Loading templates…</p>}
        {loadError && <p className={styles.error}>{loadError}</p>}

        {!loading && !loadError && (
          <div className={styles.body}>
            {/* ---------- PREVIEW ---------- */}
            <div className={styles.previewCol}>
              <canvas ref={previewRef} className={styles.preview} aria-label="Certificate preview" />
              <p className={styles.caption}>Preview · {previewName}</p>
            </div>

            {/* ---------- SETTINGS ---------- */}
            <div className={styles.settings}>
              <section>
                <h3 className={styles.label}>Template</h3>
                <div className={styles.designs} role="radiogroup" aria-label="Template">
                  {BUILT_IN_DESIGNS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      role="radio"
                      aria-checked={design === d.key}
                      className={`${styles.design} ${design === d.key ? styles.designOn : ''}`}
                      onClick={() => setDesign(d.key)}
                      disabled={working}
                    >
                      <span
                        className={styles.swatch}
                        style={{
                          background: d.swatch[0],
                          borderColor: d.swatch[1],
                          boxShadow: `inset 0 -10px 0 ${d.swatch[2]}`,
                        }}
                        aria-hidden="true"
                      />
                      {d.label}
                    </button>
                  ))}

                  {templates.map((t) => {
                    const key = `custom:${t.id}`
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={design === key}
                        className={`${styles.design} ${design === key ? styles.designOn : ''}`}
                        onClick={() => setDesign(key)}
                        disabled={working}
                        title={t.name}
                      >
                        <span className={styles.swatch} aria-hidden="true">
                          {images[t.id] && <img src={images[t.id].url} alt="" />}
                        </span>
                        <span className={styles.designName}>{t.name}</span>
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    className={`${styles.design} ${styles.upload}`}
                    onClick={() => fileRef.current?.click()}
                    disabled={working}
                  >
                    <span className={styles.swatch} aria-hidden="true">
                      <ImagePlus size={20} strokeWidth={2.2} />
                    </span>
                    {uploading ? 'Uploading…' : 'Upload your own'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={TEMPLATE_ACCEPT}
                    hidden
                    onChange={handlePickDesign}
                  />
                </div>
                <p className={styles.hint}>
                  Your own design: a blank certificate picture (PNG or JPG, landscape, up to 5
                  MB). The name and details are written on it.
                </p>

                {customTemplate && layout && (
                  <div className={styles.layoutBox}>
                    <label className={styles.inline}>
                      <span>Name position</span>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.01"
                        value={layout.nameY}
                        onChange={(e) => setLayoutField('nameY', Number(e.target.value))}
                        disabled={working}
                      />
                    </label>
                    <label className={styles.inline}>
                      <span>Text color</span>
                      <input
                        type="color"
                        value={layout.nameColor}
                        onChange={(e) => setLayoutField('nameColor', e.target.value)}
                        disabled={working}
                      />
                    </label>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={layout.showDetails}
                        onChange={(e) => setLayoutField('showDetails', e.target.checked)}
                        disabled={working}
                      />
                      Write the event, date and place
                    </label>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={layout.showSignatories}
                        onChange={(e) => setLayoutField('showSignatories', e.target.checked)}
                        disabled={working}
                      />
                      Write the signatures
                    </label>
                    <button
                      type="button"
                      className={styles.linkDanger}
                      onClick={() => handleDeleteDesign(customTemplate)}
                      disabled={working}
                    >
                      <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                      Delete this design
                    </button>
                  </div>
                )}
              </section>

              <section>
                <label className={styles.label} htmlFor="cert-title">
                  Title
                </label>
                <input
                  id="cert-title"
                  className={styles.input}
                  list="cert-title-options"
                  value={title}
                  maxLength={60}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={working}
                />
                <datalist id="cert-title-options">
                  {CERT_TITLES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </section>

              <section>
                <h3 className={styles.label}>Signatures</h3>
                {signatories.map((s, i) => (
                  <div key={i} className={styles.signRow}>
                    <input
                      className={styles.input}
                      placeholder="Name"
                      aria-label={`Signature ${i + 1} name`}
                      value={s.name}
                      maxLength={80}
                      onChange={(e) => setSignatory(i, 'name', e.target.value)}
                      disabled={working}
                    />
                    <input
                      className={styles.input}
                      placeholder="Position, e.g. Adviser"
                      aria-label={`Signature ${i + 1} position`}
                      value={s.position}
                      maxLength={80}
                      onChange={(e) => setSignatory(i, 'position', e.target.value)}
                      disabled={working}
                    />
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() =>
                        setSignatories((list) =>
                          list.length > 1 ? list.filter((_, j) => j !== i) : [blankSignatory()],
                        )
                      }
                      disabled={working}
                      aria-label={`Remove signature ${i + 1}`}
                    >
                      <X size={16} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
                {signatories.length < MAX_SIGNATORIES && (
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => setSignatories((list) => [...list, blankSignatory()])}
                    disabled={working}
                  >
                    <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
                    Add signature
                  </button>
                )}
              </section>

              <section>
                <h3 className={styles.label}>Give to</h3>
                <label className={styles.check}>
                  <input
                    type="radio"
                    name="cert-scope"
                    checked={scope === 'missing'}
                    onChange={() => setScope('missing')}
                    disabled={working}
                  />
                  Only those without a certificate yet ({missing.length})
                </label>
                <label className={styles.check}>
                  <input
                    type="radio"
                    name="cert-scope"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                    disabled={working}
                  />
                  Everyone, replacing existing certificates ({eligible.length})
                </label>
                {selfIncluded && (
                  <p className={styles.hint}>
                    Your own certificate is not included — another Officer or the Adviser gives it.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {progress && (
          <div className={styles.progress} role="status" aria-live="polite">
            <span>
              Making certificates… {progress.done} of {progress.total}
            </span>
            <span className={styles.bar}>
              <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </span>
          </div>
        )}

        <div className={styles.actions}>
          {progress ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                stopRef.current = true
              }}
            >
              Stop
            </button>
          ) : (
            <button type="button" className={styles.secondary} onClick={onClose} disabled={working}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className={styles.primary}
            onClick={handleDistribute}
            disabled={working || loading || Boolean(loadError) || targets.length === 0}
          >
            {progress ? (
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Send size={16} strokeWidth={2.4} aria-hidden="true" />
            )}
            {targets.length === 0 ? 'Everyone has a certificate' : `Distribute to ${targets.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default DistributeCertificatesDialog
