import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import { adminErrorMessage, fetchActiveOrganizations, setActingOrg } from '../lib/schoolAdmin.js'
import styles from './ActingOrgSwitcher.module.css'

/* ============================================================
   ACTING ORG SWITCHER — sa sidebar ng School Administrator

   Pumipili ang SA kung aling org ang hinahawakan niya. Habang
   nasa org na iyon, parang Adviser siya roon sa Events,
   Announcements, Attendance, Rewards at Org Profile.

   Ang napili ay naka-save sa database (profiles.organization_id
   ng SA — sa_set_acting_org()), kaya nananatili kahit
   mag-refresh o mag-logout. Pagkatapos magpalit, kinukuha ulit
   ang profile; ang MemberLayout ang bahalang i-reload ang page.
   ============================================================ */
function ActingOrgSwitcher() {
  const { profile, refreshProfile } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const current = profile?.organization_id ?? ''

  useEffect(() => {
    let active = true
    fetchActiveOrganizations()
      .then((list) => active && setOrgs(list))
      .catch((err) => {
        console.error('Hindi makuha ang mga org:', err)
        if (active) setError('Could not load organizations.')
      })
    return () => {
      active = false
    }
  }, [current])

  async function handleChange(e) {
    const next = e.target.value || null
    setSaving(true)
    setError('')
    try {
      await setActingOrg(next)
      await refreshProfile()
    } catch (err) {
      console.error('Hindi napalitan ang acting org:', err)
      setError(adminErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /* Kung na-deactivate ang hawak na org, hindi na ito kasama sa
     listahan — ipakita pa rin para hindi magmukhang "None" */
  const missing = current && !orgs.some((o) => o.id === current)

  return (
    <div className={styles.box}>
      <label className={styles.label} htmlFor="acting-org">
        Managing organization
      </label>
      <span className={styles.selectWrap}>
        <select
          id="acting-org"
          className={styles.select}
          value={current}
          onChange={handleChange}
          disabled={saving}
        >
          <option value="">None selected</option>
          {missing && <option value={current}>{profile?.organizations?.name ?? 'Current'}</option>}
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.icon} size={16} strokeWidth={2.6} aria-hidden="true" />
      </span>
      {saving && <p className={styles.hint}>Switching…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default ActingOrgSwitcher
