import { useState } from 'react'
import styles from './Avatar.module.css'

/* ============================================================
   AVATAR — bilog na larawan, o unang letra ng pangalan

   Iisang component para sa Sidebar, Dashboard at Profile,
   para pare-pareho ang itsura at iisa ang aayusin.

     <Avatar src={profile?.avatar_url} name={fullName} size="lg" />

   Kapag walang src, o hindi ma-load ang larawan (nabura,
   walang internet), unang letra ng pangalan ang lalabas.
   ============================================================ */
function Avatar({ src, name = '', size = 'md', className = '' }) {
  /* Tinatandaan kung aling URL ang pumalya. Kapag nagpalit
     ng larawan (bagong src), susubukan ulit. */
  const [failedSrc, setFailedSrc] = useState(null)

  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <span
      className={`${styles.avatar} ${styles[size] ?? ''} ${className}`}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className={styles.image}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initial
      )}
    </span>
  )
}

export default Avatar
