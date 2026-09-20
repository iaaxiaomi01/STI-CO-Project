import styles from './EmptyState.module.css'

/* ============================================================
   EMPTY STATE

   Ipinapakita kapag wala pang laman ang isang seksyon.
   Ginagamit ngayon bilang placeholder, pero HUWAG mo itong
   burahin kapag totoo na ang data — kakailanganin mo pa rin
   ito para sa "wala pang event na naka-schedule".

   Isa ito sa madalas na nakakalimutan ng mga baguhan: ang
   blangkong page ay mukhang sira. Ang may mensahe ay mukhang
   sinadya.
   ============================================================ */
function EmptyState({ icon, title, message }) {
  return (
    <div className={styles.empty}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}

      <h2 className={styles.title}>{title}</h2>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  )
}

export default EmptyState
