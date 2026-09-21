import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import { supabase } from '../lib/supabaseClient.js'
import { fullNameOf } from '../lib/profile.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import styles from './Members.module.css'

/* ============================================================
   MEMBERS — TOTOONG DATA mula sa public.profiles

   Walang .eq('organization_id', ...) dito, at sinadya iyon.
   Ang RLS sa Supabase na ang nagsasala:
     Officer / Adviser → profiles_read_orgmates: kapwa miyembro
                         lang ng SARILI niyang organisasyon
     SAO pataas        → profiles_read_staff: LAHAT

   Tandaan: lalabas lang dito ang mga naka-login na KAHIT ISANG
   BESES, dahil sa unang login ginagawa ang profile. Ang mga
   nasa student_records na hindi pa nag-login ay wala pa rito.
   ============================================================ */
function Members() {
  const { role } = useAuth()
  const { can } = getRoleConfig(role)

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true

    supabase
      .from('profiles')
      .select(
        `id, student_id, email, first_name, middle_name, last_name,
         program, year_level, is_active,
         roles ( name ),
         organizations ( name )`,
      )
      .order('last_name', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) {
          console.error('Hindi makuha ang members:', queryError)
          setError(queryError)
        } else {
          setMembers(data ?? [])
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  /* Paghahanap sa pangalan, student ID, email o kurso */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) =>
      [m.first_name, m.last_name, m.student_id, m.email, m.program]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q)),
    )
  }, [members, search])

  const showOrg = members.some(
    (m) => m.organizations?.name !== members[0]?.organizations?.name,
  )

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={
          can.create
            ? 'Pamahalaan ang listahan ng mga miyembro.'
            : 'Listahan ng mga miyembro ng organisasyon.'
        }
        action={
          can.create && <ActionButton>+ Magdagdag ng Miyembro</ActionButton>
        }
      />

      {loading && <p className={styles.status}>Kinukuha ang mga miyembro…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang listahan"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && members.length === 0 && (
        <EmptyState
          icon="▲"
          title="Wala pang nakatalang miyembro"
          message="Lalabas dito ang mga miyembro kapag nakapag-login na sila kahit isang beses."
        />
      )}

      {!loading && !error && members.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.search}
              placeholder="Hanapin ang pangalan, student ID, o kurso…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className={styles.count}>
              {filtered.length} sa {members.length}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pangalan</th>
                  <th>Student ID</th>
                  <th>Kurso</th>
                  <th>Year</th>
                  <th>Role</th>
                  {showOrg && <th>Organisasyon</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className={m.is_active ? '' : styles.inactive}>
                    <td>
                      <span className={styles.name}>{fullNameOf(m)}</span>
                      <span className={styles.email}>{m.email}</span>
                    </td>
                    <td>{m.student_id || '—'}</td>
                    <td>{m.program || '—'}</td>
                    <td>{m.year_level || '—'}</td>
                    <td>{m.roles?.name ?? '—'}</td>
                    {showOrg && <td>{m.organizations?.name ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

export default Members
