import styles from './ActionButton.module.css'

/* ============================================================
   ACTION BUTTON

   Ang pangunahing button sa kanang itaas ng isang page —
   "Gumawa ng Event", "Magpaskil", at iba pa.

   Gumagana na ang "+ Magpaskil" sa Announcements (may
   onClick na nagbubukas ng form). Ang iba — Events,
   Attendance, Members — ay wala pang onClick, kaya wala
   pang nangyayari kapag pinindot.

   Para gumana: papasahan mo lang ito ng onClick na
   magbubukas ng form.
   ============================================================ */
function ActionButton({ children, onClick, type = 'button' }) {
  return (
    <button type={type} className={styles.button} onClick={onClick}>
      {children}
    </button>
  )
}

export default ActionButton
