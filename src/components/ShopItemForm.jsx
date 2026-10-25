import { useEffect, useRef, useState } from 'react'
import { ACCEPTED_TYPES, ImageError, checkImageFile } from '../lib/image.js'
import {
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_PRICE_MAX,
  ogErrorMessage,
} from '../lib/og.js'
import base from './ProposalForm.module.css'
import eventStyles from './EventForm.module.css'
import styles from './ShopItemForm.module.css'

/* ============================================================
   SHOP ITEM FORM — Adviser

   Para sa bago (initial = null) at pag-edit. Hindi dito
   nagse-save: tinatawag ang onSubmit(values, { imageFile,
   removeImage }); kapag nag-throw, dito lalabas ang error.

   Stock at Limit: blangko = walang limit.
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

  return (
    <div
      className={base.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={`${base.modal} ${styles.modal}`}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-item-form-title"
      >
        <h2 id="shop-item-form-title" className={base.heading}>
          {isEdit ? 'Edit item' : 'Add item to the shop'}
        </h2>

        <label className={base.field}>
          <span className={base.label}>Item name</span>
          <input
            ref={nameRef}
            className={base.input}
            value={name}
            maxLength={ITEM_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className={base.field}>
          <span className={base.labelRow}>
            <span className={base.label}>
              Description <span className={eventStyles.optional}>(optional)</span>
            </span>
            <span className={base.counter}>
              {description.length} / {ITEM_DESCRIPTION_MAX}
            </span>
          </span>
          <textarea
            className={`${base.input} ${styles.textarea}`}
            value={description}
            maxLength={ITEM_DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>

        <div className={styles.grid3}>
          <label className={base.field}>
            <span className={base.label}>Price (OG)</span>
            <input
              className={base.input}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 50"
              required
            />
          </label>

          <label className={base.field}>
            <span className={base.label}>Stock</span>
            <input
              className={base.input}
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Unlimited"
            />
          </label>

          <label className={base.field}>
            <span className={base.label}>Limit / member</span>
            <input
              className={base.input}
              inputMode="numeric"
              value={limitPerMember}
              onChange={(e) => setLimitPerMember(e.target.value)}
              placeholder="No limit"
            />
          </label>
        </div>
        <p className={styles.fieldHint}>
          Leave Stock or Limit blank for no limit. Stock goes down by 1 for every redemption and
          goes back up when one is cancelled.
        </p>

        <div className={base.field}>
          <span className={base.label}>
            Picture <span className={eventStyles.optional}>(optional)</span>
          </span>

          {preview ? (
            <div className={`${eventStyles.preview} ${styles.preview}`}>
              <img src={preview} alt="Item picture preview" />
              <div className={eventStyles.previewActions}>
                <button
                  type="button"
                  className={base.secondary}
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                >
                  Change
                </button>
                <button
                  type="button"
                  className={eventStyles.removeButton}
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
              className={eventStyles.dropzone}
              onClick={() => fileRef.current?.click()}
              disabled={saving}
            >
              <span className={eventStyles.dropIcon} aria-hidden="true">＋</span>
              <span>Choose a picture</span>
              <span className={base.hint}>JPG, PNG or WEBP · cropped to a square</span>
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

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>
            <strong>Show in the shop</strong>
            <span className={base.hint}>
              Uncheck to hide it. Hidden items can't be redeemed but their records are kept.
            </span>
          </span>
        </label>

        {error && <p className={base.error}>{error}</p>}

        <div className={base.actions}>
          <button type="button" className={base.secondary} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={base.primary} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ShopItemForm
