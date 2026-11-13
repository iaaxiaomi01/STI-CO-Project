import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Building2,
  Check,
  Globe,
  ImagePlus,
  Info,
  ListChecks,
  Megaphone,
  Pencil,
  Send,
  Siren,
  Users,
} from 'lucide-react'
import {
  ANNOUNCEMENT_TYPES,
  AUDIENCES,
  MESSAGE_MAX,
  TITLE_MAX,
  announcementErrorMessage,
  audienceOf,
  fetchTargetOrganizations,
  selectedOrgsLabel,
} from '../lib/announcements.js'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
import styles from './AnnouncementForm.module.css'

/* Icon ng bawat Type — kapareho ng TYPE_ICONS sa pages/Announcements.jsx */
const TYPE_ICONS = {
  meeting: Users,
  reminder: Bell,
  urgent: Siren,
}

/* Icon ng bawat "Post to" (AUDIENCES) */
const AUDIENCE_ICONS = {
  own: Building2,
  all: Globe,
  selected: ListChecks,
}

/* ============================================================
   ANNOUNCEMENT FORM — modal para sa GUMAWA at MAG-EDIT

   Iisang form para sa dalawa:
     initial = null      → bagong announcement
     initial = { ... }   → ine-edit ang dati

   Laman: Title, Post to (kung may pagpipilian), Type, Message,
          Picture (optional)

   Hindi dito nagse-save. Ibinibigay lang ang laman sa
   onSubmit(values, { imageFile, removeImage }) — ang page ang
   tatawag sa database. Kapag nag-throw ang onSubmit, dito
   lalabas ang error.

   audience — para kanino ang BAGONG post:
     'own'    → sariling org lang (walang pagpipilian)
     'choose' → may pagpipilian: sariling org, lahat ng org, o
                mga piniling org (Officer/Adviser ng org na may
                can_announce_all). Kailangan ang ownOrgId para
                hindi isama ang sariling org sa listahan.
                Kapag WALANG ownOrgId (School Administrator), lahat
                ng org o piling org lang ang pagpipilian.
   Kapag nag-e-edit, hindi na mababago kung para kanino.
   ============================================================ */
function AnnouncementForm({ initial, audience = 'own', ownOrgId, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  /* Listahan ng org para sa "Selected organizations" */
  const canChoose = !isEdit && audience === 'choose'

  /* School Administrator: walang sariling org → walang "My
     organization only" */
  const noOwnOrg = canChoose && !ownOrgId
  const audienceOptions = noOwnOrg ? AUDIENCES.filter((a) => a.value !== 'own') : AUDIENCES

  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState(initial?.type ?? 'meeting')
  const [message, setMessage] = useState(initial?.message ?? '')
  const [postTo, setPostTo] = useState(noOwnOrg ? 'all' : 'own')
  const [orgIds, setOrgIds] = useState([])
  const [orgOptions, setOrgOptions] = useState(null) // null = kinukuha pa
  const [orgLoadError, setOrgLoadError] = useState(false)

  /* Picture: ang bagong pinili (file + preview), o ang dati */
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(initial?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!canChoose) return undefined
    let active = true
    fetchTargetOrganizations(ownOrgId)
      .then((list) => active && setOrgOptions(list))
      .catch((err) => {
        console.error('Hindi makuha ang mga org:', err)
        if (active) setOrgLoadError(true)
      })
    return () => {
      active = false
    }
  }, [canChoose, ownOrgId])

  function toggleOrg(id) {
    setOrgIds((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    )
  }

  /* Esc para isara — pero hindi habang nagse-save */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  /* Linisin ang object URL ng preview kapag napalitan o nagsara */
  useEffect(() => {
    if (!imageFile) return undefined
    const url = URL.createObjectURL(imageFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function handlePickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      checkImageFile(file)
      setError('')
      setImageFile(file)
      setRemoveImage(false)
    } catch (err) {
      setError(err instanceof ImageError ? err.message : 'Could not read the image.')
    }
  }

  function handleRemoveImage() {
    setImageFile(null)
    setPreview(null)
    setRemoveImage(Boolean(initial?.image_url))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cleanTitle = title.trim()
    const cleanMessage = message.trim()

    if (!cleanTitle || !cleanMessage) {
      setError('Title and message are required.')
      return
    }

    if (canChoose && postTo === 'selected' && orgIds.length === 0) {
      setError('Choose at least one organization.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(
        {
          title: cleanTitle,
          message: cleanMessage,
          type,
          audience: canChoose ? postTo : 'own',
          orgIds: canChoose && postTo === 'selected' ? orgIds : [],
        },
        { imageFile, removeImage },
      )
    } catch (err) {
      console.error('Hindi na-save ang announcement:', err)
      setError(announcementErrorMessage(err))
      setSaving(false)
    }
  }

  /* Subtitle sa ilalim ng heading */
  const subtitle = isEdit
    ? 'Your changes will be shown to the same audience.'
    : 'Share news and updates with your members.'

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={styles.modal}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-form-title"
      >
        {/* ---------- HEADER (nakadikit sa itaas habang nag-i-scroll) ---------- */}
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            {isEdit ? <Pencil size={21} strokeWidth={2.3} /> : <Megaphone size={22} strokeWidth={2.2} />}
          </span>
          <div className={styles.headText}>
            <h2 id="announcement-form-title" className={styles.heading}>
              {isEdit ? 'Edit announcement' : 'New announcement'}
            </h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>

        <div className={styles.body}>
          {/* ---------- TITLE ---------- */}
          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.label}>Title</span>
              <span className={styles.counter}>
                {title.length} / {TITLE_MAX}
              </span>
            </span>
            <input
              ref={titleRef}
              className={styles.input}
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. General Assembly this Friday"
              required
            />
          </label>

          {/* ---------- TYPE (mga card na pinipindot) ---------- */}
          <fieldset className={styles.field}>
            <legend className={styles.label}>Type</legend>
            <div className={styles.typeGrid}>
              {ANNOUNCEMENT_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t.value] ?? Megaphone
                return (
                  <label
                    key={t.value}
                    className={`${styles.typeOption} ${styles[`type_${t.value}`] ?? ''}`}
                  >
                    <input
                      type="radio"
                      name="announcement-type"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => setType(t.value)}
                      disabled={saving}
                    />
                    <span className={styles.typeIcon} aria-hidden="true">
                      <Icon size={17} strokeWidth={2.3} />
                    </span>
                    <span className={styles.typeLabel}>{t.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* ---------- POST TO (bagong post lang, kung may pagpipilian) ---------- */}
          {canChoose && (
            <fieldset className={styles.audienceCard}>
              <legend className={styles.cardTitle}>
                <Send size={14} strokeWidth={2.5} aria-hidden="true" />
                Post to
              </legend>

              <div className={styles.audienceGrid}>
                {audienceOptions.map((a) => {
                  const Icon = AUDIENCE_ICONS[a.value] ?? Globe
                  return (
                    <label key={a.value} className={styles.audienceOption}>
                      <input
                        type="radio"
                        name="announcement-audience"
                        value={a.value}
                        checked={postTo === a.value}
                        onChange={() => setPostTo(a.value)}
                        disabled={saving}
                      />
                      <Icon size={16} strokeWidth={2.3} aria-hidden="true" />
                      <span>{a.label}</span>
                    </label>
                  )
                })}
              </div>

              {postTo === 'selected' && (
                <div className={styles.orgBlock}>
                  <div className={styles.labelRow}>
                    <span className={styles.subLabel}>Organizations</span>
                    <span className={styles.counter}>{orgIds.length} selected</span>
                  </div>

                  {orgLoadError && (
                    <p className={styles.error}>Could not load organizations.</p>
                  )}
                  {!orgLoadError && orgOptions === null && (
                    <p className={styles.hint}>Loading organizations…</p>
                  )}
                  {orgOptions && (
                    <div className={styles.orgList}>
                      {orgOptions.map((o) => (
                        <label key={o.id} className={styles.orgOption}>
                          <input
                            type="checkbox"
                            checked={orgIds.includes(o.id)}
                            onChange={() => toggleOrg(o.id)}
                            disabled={saving}
                          />
                          <span className={styles.orgCheck} aria-hidden="true">
                            <Check size={12} strokeWidth={3.2} />
                          </span>
                          <span className={styles.orgName}>{o.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {!noOwnOrg && (
                    <p className={styles.hint}>Your organization will also see this.</p>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {/* Edit: hindi na mababago kung para kanino */}
          {isEdit && audienceOf(initial) !== 'own' && (
            <p className={styles.note}>
              <Info size={16} strokeWidth={2.4} className={styles.noteIcon} aria-hidden="true" />
              <span>
                {audienceOf(initial) === 'all' ? (
                  <>
                    Visible to <strong>all organizations</strong>.
                  </>
                ) : (
                  <>
                    Visible to: <strong>{selectedOrgsLabel(initial)}</strong>
                  </>
                )}
              </span>
            </p>
          )}

          {/* ---------- MESSAGE ---------- */}
          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.label}>Message</span>
              <span className={styles.counter}>
                {message.length} / {MESSAGE_MAX}
              </span>
            </span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={message}
              maxLength={MESSAGE_MAX}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the details of your announcement…"
              rows={7}
              required
            />
          </label>

          {/* ---------- PICTURE (optional) ---------- */}
          <div className={styles.field}>
            <span className={styles.label}>
              Picture <span className={styles.optional}>(optional)</span>
            </span>

            {preview ? (
              <div className={styles.preview}>
                <img src={preview} alt="Announcement picture preview" />
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className={`${styles.smallButton} ${styles.removeButton}`}
                    onClick={handleRemoveImage}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.uploadButton}
                onClick={() => fileRef.current?.click()}
                disabled={saving}
              >
                <span className={styles.uploadIcon} aria-hidden="true">
                  <ImagePlus size={18} strokeWidth={2.3} />
                </span>
                <span className={styles.uploadText}>
                  <strong>Choose a picture</strong>
                  <span>JPG, PNG or WEBP · up to 10 MB</span>
                </span>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handlePickImage}
              hidden
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {/* ---------- MGA BUTTON (nakadikit sa ibaba) ---------- */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {!saving && !isEdit && <Send size={16} strokeWidth={2.4} aria-hidden="true" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AnnouncementForm