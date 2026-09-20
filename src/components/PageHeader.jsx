import styles from './PageHeader.module.css'

/* ============================================================
   PAGE HEADER

   Ginagamit ng LAHAT ng member page para pare-pareho ang
   itsura ng pamagat. Kapag binago mo ang spacing o laki dito,
   sabay-sabay magbabago ang lima.

   Ang "action" ay para sa button sa kanan (halimbawa,
   "Magdagdag ng Event"). Optional lang — kung wala kang
   ipapasa, walang lalabas.
   ============================================================ */
function PageHeader({ title, subtitle, action }) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}

export default PageHeader
