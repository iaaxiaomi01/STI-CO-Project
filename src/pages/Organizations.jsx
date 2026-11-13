import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Megaphone, Pencil, Search } from 'lucide-react'
import { adminErrorMessage, fetchAllOrganizations, saveOrganization } from '../lib/schoolAdmin.js'
import NewOrganizationDialog, { NewOrganizationButton } from '../components/NewOrganization.jsx'
import EditOrganizationDialog from '../components/EditOrganization.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ui from './Organizations.module.css'

/* ============================================================
   ORGANIZATIONS — School Administrator lang

   Lahat ng org (pati inactive):
     + New organization → gumawa
     Edit               → LAHAT ng tungkol sa org, sa iisang dialog
                          (components/EditOrganization.jsx):
                            Details tab   — logo, pangalan, department,
                                            program, description, active,
                                            at "Post to all organizations"
                            Officer positions tab — ang dating nasa
                                            Org Profile

   Wala nang "Manage" / acting org: hindi na humahawak ang SA ng
   Events, Attendance at Rewards ng kahit anong org
   (SA_REMOVE_ACTING_ORG.sql). Wala na rin ang Org Profile at
   "Managing organization" sa sidebar ng SA — dito na lahat ng
   tungkol sa org. Ang Adviser ay may Org Profile pa rin.

   Walang delete: i-deactivate lang, para hindi mawala ang
   events, proposals at OG history ng org.

   Database: sa_list_organizations(), sa_save_organization()
   — SCHOOL_ADMIN_SUPERADMIN.sql
   Program: ADD_ORG_PROGRAM.sql
   Logo ng kahit anong org: SA_ORG_LOGO_ANY_ORG.sql
   Officer positions ng kahit anong org: SCHOOL_ADMIN_SUPERADMIN.sql (SA 7)
   ============================================================ */

const STATUS_ALL = ''
const STATUS_ACTIVE = 'active'
const STATUS_INACTIVE = 'inactive'

/* Mga pagpipilian sa Status dropdown */
const STATUS_OPTIONS = [
  { value: STATUS_ALL, label: 'All statuses' },
  { value: STATUS_ACTIVE, label: 'Active' },
  { value: STATUS_INACTIVE, label: 'Inactive' },
]

function Organizations() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(STATUS_ALL)

  /* null = sarado, 'new' = bago, { ...org } = ine-edit */
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try {
      setOrgs(await fetchAllOrganizations())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang mga org:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter((o) => {
      if (status === STATUS_ACTIVE && !o.is_active) return false
      if (status === STATUS_INACTIVE && o.is_active) return false
      if (!q) return true
      return [o.name, o.department, o.program, o.description]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q))
    })
  }, [orgs, search, status])

  const specialOrg = orgs.find((o) => o.can_announce_all) ?? null

  async function handleSave(values) {
    const isNew = editing === 'new'
    await saveOrganization(isNew ? null : editing.id, values)
    setEditing(null)
    setNotice(
      isNew
        ? `${values.name.trim()} was created. Open “Edit” to add its logo and officer positions.`
        : `${values.name.trim()} was saved.`,
    )
    await load()
  }

  /* Agad nase-save ang logo (hindi hinihintay ang Save), kaya
     ina-update na rin ang table sa likod ng dialog */
  function handleLogoChanged(updated) {
    setOrgs((all) => all.map((o) => (o.id === updated.id ? { ...o, logo_url: updated.logo_url } : o)))
    setEditing((cur) =>
      cur && cur !== 'new' && cur.id === updated.id ? { ...cur, logo_url: updated.logo_url } : cur,
    )
  }

  return (
    <div className={ui.page}>
      {/* ---------- ULO + SEARCH (iisang panel) ---------- */}
      <section className={ui.panel}>
        <div className={ui.panelHead}>
          <h1 className={ui.title}>Organizations</h1>
          <NewOrganizationButton
            onClick={() => {
              setNotice('')
              setEditing('new')
            }}
          />
        </div>

        {!loading && !error && (
          <div className={ui.toolbar}>
            <label className={ui.search}>
              <Search className={ui.searchIcon} size={18} strokeWidth={2.4} aria-hidden="true" />
              <input
                type="search"
                className={ui.searchInput}
                placeholder="Search by name, department, program or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <div className={ui.controls}>
              <StatusDropdown value={status} onChange={setStatus} />

              <span className={ui.count}>
                <b>{filtered.length}</b> of {orgs.length}
              </span>
            </div>
          </div>
        )}
      </section>

      {notice && (
        <p className={ui.notice} role="status">
          {notice}
        </p>
      )}

      {loading && (
        <p className={ui.loading}>
          <span className={ui.spinner} aria-hidden="true" />
          Loading organizations…
        </p>
      )}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load the list"
          message={adminErrorMessage(error)}
        />
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon="◈"
              title={orgs.length === 0 ? 'No organizations yet' : 'No match'}
              message={
                orgs.length === 0
                  ? 'Create the first organization with “+ New organization”.'
                  : 'Try a different search or status.'
              }
            />
          ) : (
            /* Bawat org ay isang card: logo · pangalan · status,
               bilang ng Members / Officers / Advisers, at Edit */
            <ul className={ui.grid}>
              {filtered.map((o) => {
                /* "Information Technology · BSIT" */
                const subline =
                  [o.department, o.program].filter(Boolean).join(' · ') || 'No department'
                return (
                  <li key={o.id} className={`${ui.card} ${o.is_active ? '' : ui.inactive}`}>
                    {/* Mga abstract na hugis sa likod (palamuti lang) */}
                    <span className={ui.shapes} aria-hidden="true" />

                    {/* Malaking bilog sa gitna: logo, at singsing na hinati
                        ayon sa Members · Officers · Advisers */}
                    <Emblem org={o} />

                    <h2 className={ui.name}>{o.name}</h2>
                    <p className={ui.subline}>{subline}</p>

                    <div className={ui.badges}>
                      <span className={`${ui.badge} ${o.is_active ? ui.badgeOn : ui.badgeOff}`}>
                        {o.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {o.can_announce_all && (
                        <span className={`${ui.badge} ${ui.badgeSpecial}`}>
                          <Megaphone size={12} strokeWidth={2.6} aria-hidden="true" />
                          Posts to all
                        </span>
                      )}
                    </div>

                    <dl className={ui.stats}>
                      <div className={`${ui.stat} ${ui.statMembers}`}>
                        <dt>Members</dt>
                        <dd>{o.member_count}</dd>
                      </div>
                      <div className={`${ui.stat} ${ui.statOfficers}`}>
                        <dt>Officers</dt>
                        <dd>{o.officer_count}</dd>
                      </div>
                      <div className={`${ui.stat} ${ui.statAdvisers}`}>
                        <dt>Advisers</dt>
                        <dd>{o.adviser_count}</dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      className={ui.edit}
                      onClick={() => {
                        setNotice('')
                        setEditing(o)
                      }}
                    >
                      <span className={ui.editIcon} aria-hidden="true">
                        <Pencil size={14} strokeWidth={2.6} />
                      </span>
                      Edit
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {editing === 'new' && (
        <NewOrganizationDialog
          specialOrg={specialOrg}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {editing && editing !== 'new' && (
        <EditOrganizationDialog
          org={editing}
          specialOrg={specialOrg}
          onSave={handleSave}
          onLogoChanged={handleLogoChanged}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   Emblem — logo ng org sa gitna ng singsing.
   Ang singsing ay hinati ayon sa bilang:
     navy = Members · dilaw = Officers · asul = Advisers
   Itsura lang; galing ang bilang sa member_count, officer_count
   at adviser_count. Kapag 0 lahat, abong singsing lang.

   PANSININ: sa sa_list_organizations(), kasama na ang Officers sa
   member_count (role 1 at 2). Kaya ang navy na bahagi ay
   member_count − officer_count lang, para hindi doble ang bilang
   ng Officers sa singsing. Hindi nito binabago ang numerong
   ipinapakita sa ilalim ng card.
   ------------------------------------------------------------ */
function Emblem({ org }) {
  const members = Number(org.member_count) || 0
  const officers = Number(org.officer_count) || 0
  const parts = [
    { key: 'members', value: Math.max(0, members - officers) },
    { key: 'officers', value: officers },
    { key: 'advisers', value: Number(org.adviser_count) || 0 },
  ]
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  const shown = parts.filter((p) => p.value > 0)
  /* Maliit na puwang sa pagitan ng mga bahagi (kapag higit sa isa) */
  const gap = shown.length > 1 ? 1.2 : 0

  let start = 0
  const arcs = shown.map((p) => {
    const length = (p.value / total) * 100
    const arc = { key: p.key, start, length: Math.max(0, length - gap) }
    start += length
    return arc
  })

  return (
    <div className={ui.emblem} aria-hidden="true">
      <svg className={ui.ring} viewBox="0 0 120 120">
        <circle className={ui.track} cx="60" cy="60" r="54" pathLength="100" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            className={`${ui.arc} ${ui[a.key]}`}
            cx="60"
            cy="60"
            r="54"
            pathLength="100"
            strokeDasharray={`${a.length} ${100 - a.length}`}
            strokeDashoffset={-a.start}
          />
        ))}
      </svg>
      <span className={ui.logo}>
        {org.logo_url ? <img src={org.logo_url} alt="" /> : org.name.charAt(0)}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------
   Status dropdown (All statuses · Active · Inactive)

   Dati ay <select> ng browser. Ngayon ay sariling listahan para
   madisenyuhan — pareho ang pagpipilian at ang setStatus.
     Pindot / Enter / Space / ↓ ↑  → bukas
     ↓ ↑ Home End                  → lipat
     Enter / Space                 → pili
     Esc / pindot sa labas / Tab   → sara
   ------------------------------------------------------------ */
function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const uid = useId()
  const listId = `${uid}-list`

  const selectedIndex = Math.max(
    0,
    STATUS_OPTIONS.findIndex((o) => o.value === value),
  )
  const selected = STATUS_OPTIONS[selectedIndex]

  function openList() {
    setActive(selectedIndex)
    setOpen(true)
  }

  function close(focusButton = true) {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  function choose(i) {
    const o = STATUS_OPTIONS[i]
    if (!o) return
    if (o.value !== value) onChange(o.value)
    close()
  }

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  /* Isara kapag pumindot sa labas */
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function onButtonKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    }
  }

  function onListKey(e) {
    const last = STATUS_OPTIONS.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => Math.min(last, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        close(false)
        break
      default:
    }
  }

  return (
    <div ref={rootRef} className={`${ui.dropdown} ${open ? ui.dropdownOpen : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className={ui.dropButton}
        aria-label={`Filter by status: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
      >
        <span className={ui.dot} data-status={selected.value || 'all'} aria-hidden="true" />
        <span className={ui.dropValue}>{selected.label}</span>
        <ChevronDown className={ui.dropChevron} size={16} strokeWidth={2.6} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          className={ui.dropList}
          role="listbox"
          aria-label="Filter by status"
          aria-activedescendant={`${uid}-${active}`}
          tabIndex={-1}
          onKeyDown={onListKey}
        >
          {STATUS_OPTIONS.map((o, i) => {
            const isSelected = o.value === value
            return (
              <li
                key={o.value || 'all'}
                id={`${uid}-${i}`}
                role="option"
                aria-selected={isSelected}
                className={[
                  ui.dropOption,
                  isSelected ? ui.dropSelected : '',
                  i === active ? ui.dropActive : '',
                ].join(' ')}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className={ui.dot} data-status={o.value || 'all'} aria-hidden="true" />
                <span className={ui.dropText}>{o.label}</span>
                <Check className={ui.dropCheck} size={15} strokeWidth={3} aria-hidden="true" />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Organizations