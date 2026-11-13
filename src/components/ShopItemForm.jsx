import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, ImagePlus, X } from 'lucide-react'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
import {
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_PRICE_MAX,
  ogErrorMessage,
} from '../lib/og.js'
import { OgGem } from './OgGem.jsx'
import styles from './ShopItemForm.module.css'

/* ============================================================
   SHOP ITEM FORM — Adviser

   Para sa bago (initial = null) at pag-edit. Hindi dito
   nagse-save: tinatawag ang onSubmit(values, { imageFile,
   removeImage }); kapag nag-throw, dito lalabas ang error.

   Stock at Limit: blangko = walang limit.

   Itsura (ShopItemForm.module.css — sariling disenyo, iba sa
   Event/Announcement form): dalawang hanay —
     Kaliwa → live na "Shop preview" ng item (kapareho ng card sa
              Rewards shop) at ang pag-upload ng picture
     Kanan  → mga field: Item name, Description, Price, Availability
              (Stock · Limit per member), at switch na "Show in the shop"
   ============================================================ */
function ShopItemForm({ initial = null, onSubmit, onCancel }) {
  const isEdit = Boolean(initial)

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [stock, setStock] = useState(initial?.stock == null ? '' : String(initial.stock))
  const [limitPerMember, setLimitPerMember] = useState(
    initial?.limit_per_member == null ? '' : String(initial.limit_per_member),
  )
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(initial?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const nameRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  /* Linisin ang object URL ng preview */
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

  /* Buong numero lang; blangko = null */
  function wholeNumber(value, { min, max, allowBlank }) {
    const s = String(value).trim()
    if (s === '') return allowBlank ? '' : null
    if (!/^\d+$/.test(s)) return null
    const n = Number(s)
    return n >= min && n <= max ? s : null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const clean = {
      name: name.trim(),
      description: description.trim(),
      price: wholeNumber(price, { min: 1, max: ITEM_PRICE_MAX, allowBlank: false }),
      stock: wholeNumber(stock, { min: 0, max: 100000, allowBlank: true }),
      limitPerMember: wholeNumber(limitPerMember, { min: 1, max: 1000, allowBlank: true }),
      isActive,
    }

    if (!clean.name) {
      setError('Please enter the item name.')
      return
    }
    if (clean.price === null) {
      setError(`Price must be a whole number from 1 to ${ITEM_PRICE_MAX.toLocaleString('en-PH')} OG.`)
      return
    }
    if (clean.stock === null) {
      setError('Stock must be a whole number (0 or more), or leave it blank for unlimited.')
      return
    }
    if (clean.limitPerMember === null) {
      setError('Limit per member must be 1 or more, or leave it blank for no limit.')
      return
    }

    setSaving(true)
    try {
      await onSubmit(clean, { imageFile, removeImage })
    } catch (err) {
      console.error('Hindi na-save ang item:', err)
      setError(ogErrorMessage(err))
      setSaving(false)
    }
  }

  /* ---------- LIVE PREVIEW (kung ano ang makikita sa shop) ---------- */
  const previewName = name.trim() || 'Item name'
  const previewDesc = description.trim()
  const priceNumber = /^\d+$/.test(price.trim()) ? Number(price.trim()) : null
  const previewFacts = (() => {
    const facts = []
    const s = stock.trim()
    if (s === '') facts.push('Unlimited stock')
    else if (/^\d+$/.test(s)) facts.push(Number(s) <= 0 ? 'Out of stock' : `${Number(s)} left`)
    const l = limitPerMember.trim()
    if (/^\d+$/.test(l) && Number(l) > 0) facts.push(`Limit ${Number(l)} per member`)
    return facts.join(' · ')
  })()

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
        aria-labelledby="shop-item-form-title"
      >
        {/* ---------- HEADER ---------- */}
        <header className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>Rewards shop</p>
            <h2 id="shop-item-form-title" className={styles.heading}>
              {isEdit ? 'Edit item' : 'Add item'}
            </h2>
            <p className={styles.subtitle}>
              {isEdit
                ? 'Update the details members see in the shop.'
                : 'Members can redeem this using their Organization Gems.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <div className={styles.layout}>
          {/* ---------- KALIWA: PREVIEW + PICTURE ---------- */}
          <aside className={styles.side}>
            <p className={styles.sideLabel}>Shop preview</p>

            <div className={`${styles.card} ${isActive ? '' : styles.cardHidden}`}>
              <div className={styles.cardMedia}>
                {preview ? (
                  <img className={styles.cardImage} src={preview} alt="Item picture preview" />
                ) : (
                  <div className={styles.cardPlaceholder} aria-hidden="true">
                    <OgGem size={44} />
                  </div>
                )}
                <span className={styles.cardPrice}>
                  <OgGem size={15} />
                  {priceNumber !== null ? priceNumber.toLocaleString('en-PH') : '—'} OG
                </span>
                {!isActive && (
                  <span className={styles.cardBadge}>
                    <EyeOff size={12} strokeWidth={2.6} aria-hidden="true" />
                    Hidden
                  </span>
                )}
              </div>
              <div className={styles.cardBody}>
                <p className={`${styles.cardName} ${name.trim() ? '' : styles.cardEmpty}`}>
                  {previewName}
                </p>
                {previewDesc && <p className={styles.cardDesc}>{previewDesc}</p>}
                {previewFacts && <p className={styles.cardFacts}>{previewFacts}</p>}
              </div>
            </div>

            {/* Picture */}
            <div className={styles.picture}>
              {preview ? (
                <div className={styles.pictureActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                  >
                    <ImagePlus size={15} strokeWidth={2.4} aria-hidden="true" />
                    Change picture
                  </button>
                  <button
                    type="button"
                    className={`${styles.ghostButton} ${styles.ghostDanger}`}
                    onClick={handleRemoveImage}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.uploadButton}
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                >
                  <ImagePlus size={16} strokeWidth={2.4} aria-hidden="true" />
                  Upload picture
                </button>
              )}
              <p className={styles.pictureHint}>Optional · JPG, PNG or WEBP · cropped to a square</p>

              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handlePickImage}
                hidden
              />
            </div>
          </aside>

          {/* ---------- KANAN: MGA FIELD ---------- */}
          <div className={styles.main}>
            {/* Item name */}
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span className={styles.label}>Item name</span>
                <span className={styles.counter}>
                  {name.length} / {ITEM_NAME_MAX}
                </span>
              </span>
              <input
                ref={nameRef}
                className={styles.input}
                value={name}
                maxLength={ITEM_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Org T-shirt"
                required
              />
            </label>

            {/* Description */}
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span className={styles.label}>
                  Description <span className={styles.optional}>(optional)</span>
                </span>
                <span className={styles.counter}>
                  {description.length} / {ITEM_DESCRIPTION_MAX}
                </span>
              </span>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={description}
                maxLength={ITEM_DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Size, color, or anything members should know"
                rows={3}
              />
            </label>

            {/* Price — may gem sa unahan at "OG" sa dulo */}
            <label className={styles.field}>
              <span className={styles.label}>Price</span>
              <span className={styles.affix}>
                <span className={styles.prefix} aria-hidden="true">
                  <OgGem size={16} />
                </span>
                <input
                  className={`${styles.input} ${styles.affixInput}`}
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="50"
                  required
                />
                <span className={styles.suffix}>OG</span>
              </span>
            </label>

            {/* Stock at Limit */}
            <fieldset className={styles.group}>
              <legend className={styles.label}>Availability</legend>
              <div className={styles.groupGrid}>
                <label className={styles.subField}>
                  <span className={styles.subLabel}>Stock</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="Unlimited"
                  />
                </label>
                <label className={styles.subField}>
                  <span className={styles.subLabel}>Limit per member</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={limitPerMember}
                    onChange={(e) => setLimitPerMember(e.target.value)}
                    placeholder="No limit"
                  />
                </label>
              </div>
              <p className={styles.hint}>
                Leave blank for no limit. Stock goes down by 1 only when an item is handed out
                (an Officer or you enter the member&apos;s claim code).
              </p>
            </fieldset>

            {/* Show in the shop — switch */}
            <label className={styles.switchRow}>
              <span className={styles.switchText}>
                <span className={styles.switchTitle}>
                  {isActive ? (
                    <Eye size={15} strokeWidth={2.4} aria-hidden="true" />
                  ) : (
                    <EyeOff size={15} strokeWidth={2.4} aria-hidden="true" />
                  )}
                  Show in the shop
                </span>
                <span className={styles.hint}>
                  Turn off to hide it. Hidden items can&apos;t be redeemed but their records are
                  kept.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className={styles.switchInput}
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={saving}
              />
              <span className={styles.switch} aria-hidden="true" />
            </label>

            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>

        {/* ---------- MGA BUTTON ---------- */}
        <footer className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {!saving && <OgGem size={16} />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default ShopItemForm