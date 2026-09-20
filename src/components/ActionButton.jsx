import styles from './ActionButton.module.css'

/* ============================================================
   ACTION BUTTON

   Ang pangunahing button sa kanang itaas ng isang page —
   "Gumawa ng Event", "Magpaskil", at iba pa.

   ⚠️  HINDI PA GUMAGANA ANG MGA ITO. Walang database, kaya
   wala pang pagsasave-an. Nandito sila para makita mo ang
   itsura ng page ng Officer at maramdaman ang pagkakaiba
   sa Member.

   Kapag may data layer na, papasahan mo lang ito ng onClick
   na magbubukas ng form.
   ============================================================ */
function ActionButton({ children, onClick, type = 'button' }) {
  return (
    <button type={type} className={styles.button} onClick={onClick}>
      {children}
    </button>
  )
}

export default ActionButton
