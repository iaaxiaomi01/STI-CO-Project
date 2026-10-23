import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
import { ROLE_KEYS, getRoleConfig } from '../config/roles.js'
import { fullNameOf } from '../lib/profile.js'
import { fetchPositions, setOfficerPosition } from '../lib/officerPositions.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Avatar from '../components/Avatar.jsx'
import PositionDialog from '../components/PositionDialog.jsx'
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

   OFFICER POSITION (OFFICER_POSITIONS.sql):
   Sa "Role" column, ang position ang lalabas kapag mayroon
   (hal. "President" imbes na "Officer"). Ang may
   can.assignPositions (Adviser, IT Admin) ay may "Set position"
   button sa bawat Member/Officer — tingnan ang PositionDialog.
   ============================================================ */

const MEMBER_COLUMNS = `
  id, student_id, email, first_name, middle_name, last_name,
  program, year_level, is_active, avatar_url,
  role_id, organization_id, position_id,
  roles ( name ),
  organizations ( name ),
  officer_positions ( id, name, sort_order )
`

/* Value ng "No organization" sa org filter (hindi uuid, kaya
   hindi magbabanggaan sa totoong organization_id) */
const NO_ORG = '__none__'

/* Member at Officer lang ang pwedeng bigyan ng position */
function canHavePosition(m) {
  return m.is_active && (m.role_id === 1 || m.role_id === 2) && Boolean(m.organization_id)
}

function Members() {
  const { role } = useAuth()
  const can = getRoleConfig(role).can

  /* Walang "Officers only" na filter ang SAO, School Head at
     School Administrator */
  const showOfficersFilter =
    role !== ROLE_KEYS.SAO && role !== ROLE_KEYS.SCHOOL_HEAD && role !== ROLE_KEYS.SCHOOL_ADMIN

  /* Organization filter: para sa SAO, School Head, School
     Administrator at IT Admin, na nakakakita ng LAHAT ng org
     (profiles_read_staff). Ang Officer at Adviser ay sariling org
     lang ang nakikita kaya hindi na kailangan. */
  const showOrgFilter =
    role === ROLE_KEYS.SAO ||
    role === ROLE_KEYS.SCHOOL_HEAD ||
    role === ROLE_KEYS.SCHOOL_ADMIN ||
    role === ROLE_KEYS.IT_ADMIN

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [officersOnly, setOfficersOnly] = useState(false)
  /* '' = lahat ng org, NO_ORG = walang org (hal. staff), o ang id ng org */
  const [orgFilter, setOrgFilter] = useState('')

  /* Para sa "Set position" */
  const [positions, setPositions] = useState([])
  const [editing, setEditing] = useState(null) // ang member na binibigyan ng position
  const [notice, setNotice] = useState('')

  const loadMembers = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select(MEMBER_COLUMNS)
      .order('last_name', { ascending: true })

    if (queryError) {
      console.error('Hindi makuha ang members:', queryError)
      setError(queryError)
    } else {
      setError(null)
      setMembers(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  /* Ang listahan ng position (RLS: sariling org ng Adviser; lahat
     para sa IT Admin). Kailangan lang kapag may "Set position". */
  useEffect(() => {
    if (!can.assignPositions) return
    fetchPositions()
      .then(setPositions)
      .catch((err) => console.error('Hindi makuha ang officer positions:', err))
  }, [can.assignPositions])

  /* position id → [mga may hawak] */
  const holdersByPosition = useMemo(() => {
    const map = new Map()
    members.forEach((m) => {
      if (m.position_id) map.set(m.position_id, [...(map.get(m.position_id) ?? []), m])
    })
    return map
  }, [members])

  /* Mga pagpipilian sa organization filter. Galing sa mismong
     listahan ng members, kaya ang lalabas lang ay ang mga org na may
     miyembrong naka-login na, kasama ang bilang ng bawat isa. */
  const orgOptions = useMemo(() => {
    const map = new Map()
    let noOrgCount = 0
    members.forEach((m) => {
      if (!m.organization_id) {
        noOrgCount += 1
        return
      }
      const entry = map.get(m.organization_id) ?? {
        id: m.organization_id,
        name: m.organizations?.name ?? 'Unnamed organization',
        count: 0,
      }
      entry.count += 1
      map.set(m.organization_id, entry)
    })
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    return { list, noOrgCount }
  }, [members])

  /* Paghahanap sa pangalan, student ID, email, kurso o position.
     Kapag "Officers only": ayon sa pagkakasunod-sunod ng position
     (President muna), tapos apelyido. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = members

    if (showOrgFilter && orgFilter) {
      list =
        orgFilter === NO_ORG
          ? list.filter((m) => !m.organization_id)
          : list.filter((m) => m.organization_id === orgFilter)
    }

    if (officersOnly) {
      list = list
        .filter((m) => m.role_id === 2)
        .sort(
          (a, b) =>
            (a.officer_positions?.sort_order ?? Infinity) -
              (b.officer_positions?.sort_order ?? Infinity) ||
            a.last_name.localeCompare(b.last_name),
        )
    }

    if (!q) return list
    return list.filter((m) =>
      [m.first_name, m.last_name, m.student_id, m.email, m.program, m.officer_positions?.name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q)),
    )
  }, [members, search, officersOnly, showOrgFilter, orgFilter])

  const showOrg = members.some(
    (m) => m.organizations?.name !== members[0]?.organizations?.name,
  )

  async function handleSavePosition(positionId) {
    const member = editing
    await setOfficerPosition(member.id, positionId)

    const name = fullNameOf(member)
    const position = positions.find((p) => p.id === positionId)
    setNotice(position ? `${name} is now ${position.name}.` : `${name} is now a Member.`)
    setEditing(null)
    await loadMembers()
  }

  return (
    <>
      <PageHeader title="Members" />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.status}>Loading members…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load the list"
          message="There was a problem connecting to the database. Please try again later."
        />
      )}

      {!loading && !error && members.length === 0 && (
        <EmptyState
          icon="▲"
          title="No members yet"
          message="Members will appear here once they have logged in at least once."
        />
      )}

      {!loading && !error && members.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.search}
              placeholder="Search by name, student ID, program, or position…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {showOrgFilter && (
              <select
                className={styles.orgSelect}
                aria-label="Filter by organization"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
              >
                <option value="">All organizations</option>
                {orgOptions.list.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.count})
                  </option>
                ))}
                {orgOptions.noOrgCount > 0 && (
                  <option value={NO_ORG}>No organization ({orgOptions.noOrgCount})</option>
                )}
              </select>
            )}
            {showOfficersFilter && (
              <label className={styles.filter}>
                <input
                  type="checkbox"
                  checked={officersOnly}
                  onChange={(e) => setOfficersOnly(e.target.checked)}
                />
                Officers only
              </label>
            )}
            <span className={styles.count}>
              {filtered.length} of {members.length}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Student ID</th>
                  <th>Program</th>
                  <th>Year</th>
                  <th>Role</th>
                  {showOrg && <th>Organization</th>}
                  {can.assignPositions && (
                    <th>
                      <span className={styles.srOnly}>Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className={m.is_active ? '' : styles.inactive}>
                    <td>
                      {/* Profile picture + pangalan. Kapag walang larawan,
                          unang letra ng pangalan ang lalabas (Avatar). */}
                      <div className={styles.person}>
                        <Avatar src={m.avatar_url} name={fullNameOf(m)} size="sm" />
                        <div>
                          <span className={styles.name}>{fullNameOf(m)}</span>
                          <span className={styles.email}>{m.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{m.student_id || '—'}</td>
                    <td>{m.program || '—'}</td>
                    <td>{m.year_level || '—'}</td>
                    {/* May position = Officer, kaya ang position na
                        mismo ang ipinapakita (hal. "President") */}
                    <td>
                      {m.officer_positions?.name ? (
                        <span className={styles.position} title="Officer">
                          {m.officer_positions.name}
                        </span>
                      ) : (
                        (m.roles?.name ?? '—')
                      )}
                    </td>
                    {showOrg && <td>{m.organizations?.name ?? '—'}</td>}
                    {can.assignPositions && (
                      <td className={styles.actionCell}>
                        {canHavePosition(m) && (
                          <button
                            type="button"
                            className={styles.rowButton}
                            onClick={() => {
                              setNotice('')
                              setEditing(m)
                            }}
                          >
                            Set position
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <PositionDialog
          member={editing}
          positions={positions.filter((p) => p.organization_id === editing.organization_id)}
          holdersByPosition={holdersByPosition}
          canManagePositions={role === ROLE_KEYS.ADVISER}
          onSave={handleSavePosition}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  )
}

export default Members