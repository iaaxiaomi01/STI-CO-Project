import styles from './OgGem.module.css'

/* ============================================================
   OG GEM — ang icon ng Organization Gems

   <OgGem />                → maliit na gem lang
   <OgAmount value={25} />  → gem + "25 OG"
   <OgAmount value={-20} signed /> → "−20 OG" (pula) / "+25 OG" (berde)

   SVG para matalas sa kahit anong laki, at sumusunod sa kulay
   ng theme (--color-primary).
   ============================================================ */
export function OgGem({ size = 16, className = '' }) {
  return (
    <svg
      className={`${styles.gem} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {/* katawan */}
      <path d="M6.2 3h11.6L22 9.2 12 21.5 2 9.2 6.2 3Z" className={styles.body} />
      {/* itaas na mukha */}
      <path d="M6.2 3h11.6L22 9.2H2L6.2 3Z" className={styles.top} />
      {/* kinang */}
      <path d="M8.6 9.2 12 3l3.4 6.2L12 21.5 8.6 9.2Z" className={styles.facet} />
    </svg>
  )
}

export function OgAmount({ value, signed = false, size = 16, className = '' }) {
  const n = Number(value) || 0
  const tone = signed ? (n > 0 ? styles.plus : n < 0 ? styles.minus : '') : ''
  const sign = signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : ''
  return (
    <span className={`${styles.amount} ${tone} ${className}`}>
      <OgGem size={size} />
      <span>
        {sign}
        {Math.abs(n).toLocaleString('en-PH')} OG
      </span>
    </span>
  )
}

export default OgGem
