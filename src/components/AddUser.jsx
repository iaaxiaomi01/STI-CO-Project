import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, UserPlus } from 'lucide-react'
import { adminErrorMessage, assignableRoles, roleNeedsOrg } from '../lib/schoolAdmin.js'
import msLogo from '../assets/microsoft-logo.svg'
import styles from './AddUser.module.css'

/* ============================================================
   ADD USER — button at form (School Administrator)

   Hiwalay sa Edit dialog ng pages/Users.jsx para may sariling
   itsura ang pagdagdag ng bagong user. Pareho pa rin ang laman
   at logic ng dating form:
     Microsoft email, Last/First/Middle name, Student ID,
     Program, Year level, Role, Organization, Active
     → saveUser() (sa_save_user)

   Ang itsura: malinis at pormal — puting form, tatlong grupo
   na hinahati lang ng manipis na guhit (account, pangalan at
   detalye, role at org), at Active sa ibaba.
   ============================================================ */

export function AddUserButton({ onClick }) {
  return (
    <button type="button" className={styles.addButton} onClick={onClick}>
      <UserPlus size={18} strokeWidth={2.4} aria-hidden="true" />
      Add user
    </button>
  )
}

function AddUserDialog({ roles, orgs, onSave, onCancel }) {
  const [email, setEmail] = useState('')
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [program, setProgram] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [roleId, setRoleId] = useState('1')
  const [organizationId, setOrganizationId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)
  const errorRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  /* Nasa ibaba ang error; i-scroll para makita agad */
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [error])

  const needsOrg = roleNeedsOrg(roleId)

  /* Walang IT Administrator sa pagpipilian */
  const roleChoices = assignableRoles(roles, null)

  /* Aktibong org lang ang pagpipilian */
  const orgChoices = orgs.filter((o) => o.is_active)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (needsOrg && !organizationId) {
      setError('Choose an organization for this role.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        email,
        lastName,
        firstName,
        middleName,
        studentId,
        program,
        yearLevel,
        roleId,
        organizationId: needsOrg ? organizationId : null,
        isActive,
      })
    } catch (err) {
      console.error('Hindi na-save ang user:', err)
      setError(adminErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        onSubmit={handleSubmit}
      >
        <header className={styles.head}>
          <h2 id="add-user-title" className={styles.title}>
            Add user
          </h2>
        </header>

        <div className={styles.body}>
          <fieldset className={styles.fields} disabled={saving}>
            {/* Account */}
            <div className={styles.group}>
              <label className={styles.field}>
                <span className={styles.label}>Microsoft email</span>
                <span className={styles.emailBox}>
                  <img src={msLogo} alt="" className={styles.msLogo} />
                  <input
                    ref={firstRef}
                    type="email"
                    className={`${styles.input} ${styles.emailInput}`}
                    value={email}
                    placeholder="lastname.123456@sanpablo.sti.edu.ph"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </span>
                <span className={styles.hint}>They log in with this Microsoft account.</span>
              </label>
            </div>

            {/* Pangalan at detalye */}
            <div className={styles.group}>
              <div className={styles.row3}>
                <label className={styles.field}>
                  <span className={styles.label}>Last name</span>
                  <input
                    className={styles.input}
                    value={lastName}
                    maxLength={100}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>First name</span>
                  <input
                    className={styles.input}
                    value={firstName}
                    maxLength={100}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Middle name <span className={styles.optional}>(optional)</span>
                  </span>
                  <input
                    className={styles.input}
                    value={middleName}
                    maxLength={100}
                    onChange={(e) => setMiddleName(e.target.value)}
                  />
                </label>
              </div>

              <div className={styles.row3}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Student ID <span className={styles.optional}>(optional)</span>
                  </span>
                  <input
                    className={styles.input}
                    value={studentId}
                    maxLength={50}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Program <span className={styles.optional}>(optional)</span>
                  </span>
                  <input
                    className={styles.input}
                    value={program}
                    maxLength={100}
                    placeholder="BS in Information Technology"
                    onChange={(e) => setProgram(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Year level <span className={styles.optional}>(optional)</span>
                  </span>
                  <input
                    className={styles.input}
                    value={yearLevel}
                    maxLength={30}
                    placeholder="1Y1"
                    onChange={(e) => setYearLevel(e.target.value)}
                  />
                </label>
              </div>
            </div>

            {/* Role at organization */}
            <div className={styles.group}>
              <div className={styles.row2}>
                <Picker
                  id="add-user-role"
                  label="Role"
                  value={roleId}
                  onChange={setRoleId}
                  options={roleChoices.map((r) => ({ value: String(r.id), label: r.name }))}
                />

                <Picker
                  id="add-user-org"
                  label="Organization"
                  value={needsOrg ? organizationId : ''}
                  onChange={setOrganizationId}
                  disabled={!needsOrg}
                  placeholder={needsOrg ? 'Choose an organization' : 'None (staff role)'}
                  withTiles
                  options={orgChoices.map((o) => ({ value: o.id, label: o.name, logoUrl: o.logo_url }))}
                />
              </div>

              {Number(roleId) === 2 && (
                <p className={styles.note}>
                  They will be an Officer with no position. To give a position, use “Set
                  position” on their row in this list — it appears once they have logged in.
                </p>
              )}

              <label className={styles.active}>
                <input
                  type="checkbox"
                  className={styles.activeInput}
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className={styles.activeBox} aria-hidden="true">
                  <Check size={14} strokeWidth={3.2} />
                </span>
                <span>
                  <span className={styles.activeTitle}>Active</span>
                  <span className={styles.activeText}>
                    Inactive people cannot open the app. Their records and history are kept.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p ref={errorRef} className={styles.error} role="alert">
                {error}
              </p>
            )}
          </fieldset>
        </div>

        <footer className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.submit} disabled={saving}>
            {saving ? 'Saving…' : 'Add user'}
          </button>
        </footer>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------
   PICKER — dropdown ng Role at Organization (sa form na ito lang)

   Kapalit ng <select> para may itsura rin ang listahan: dilaw na
   kahon sa chevron, dilaw ang napili, at logo o unang letra ng
   org sa tabi ng pangalan.

   Keyboard: ↑ ↓ Home End, Enter/Space para pumili, Esc para
   isara (hindi nito isinasara ang buong form), unang letra para
   tumalon. Nakalutang ang listahan (position: fixed) para hindi
   maputol ng scroll ng form.
   ------------------------------------------------------------ */
function Picker({ id, label, value, onChange, options, placeholder, disabled, withTiles }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState(null)
  const [failed, setFailed] = useState(() => new Set())
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const uid = useId()
  const labelId = `${id}-label`
  const listId = `${id}-list`

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  function openList() {
    if (disabled || options.length === 0) return
    const r = triggerRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const up = below < 260 && r.top > below
    setPlace({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      maxHeight: Math.min(280, (up ? r.top : below) - 16),
    })
    setActive(Math.max(0, selectedIndex))
    setOpen(true)
  }

  function close(focus = true) {
    setOpen(false)
    if (focus) triggerRef.current?.focus()
  }

  function choose(i) {
    const o = options[i]
    if (!o) return
    if (o.value !== value) onChange(o.value)
    close()
  }

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (open) document.getElementById(`${uid}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, uid])

  /* Isara kapag pumindot sa labas, nag-scroll ang form, o nag-resize */
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onScroll(e) {
      if (!listRef.current?.contains(e.target)) setOpen(false)
    }
    function onResize() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  /* Sarado na kapag na-disable (hal. pinalitan ang role ng staff) */
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  function onTriggerKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    }
  }

  function onListKey(e) {
    const last = options.length - 1
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
        /* Listahan lang ang isasara, hindi ang buong form */
        e.preventDefault()
        e.stopPropagation()
        close()
        break
      case 'Tab':
        close(false)
        break
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const k = e.key.toLowerCase()
          for (let step = 1; step <= options.length; step += 1) {
            const i = (active + step) % options.length
            if (options[i].label.toLowerCase().startsWith(k)) {
              setActive(i)
              break
            }
          }
        }
    }
  }

  function tile(o) {
    const showLogo = o.logoUrl && !failed.has(o.logoUrl)
    return (
      <span className={styles.pickTile} aria-hidden="true">
        {showLogo ? (
          <img
            src={o.logoUrl}
            alt=""
            onError={() => setFailed((f) => new Set(f).add(o.logoUrl))}
          />
        ) : (
          o.label.charAt(0).toUpperCase()
        )}
      </span>
    )
  }

  return (
    <div ref={rootRef} className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`${styles.pick} ${open ? styles.pickOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${id}`}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
      >
        {withTiles && selected && tile(selected)}
        <span className={selected ? styles.pickValue : styles.pickPlaceholder}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={styles.pickArrow} aria-hidden="true">
          <ChevronDown size={16} strokeWidth={2.6} />
        </span>
      </button>

      {open && place && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${uid}-${active}`}
          className={`${styles.pickList} ${place.bottom !== undefined ? styles.pickListUp : ''}`}
          style={{
            left: place.left,
            width: place.width,
            top: place.top,
            bottom: place.bottom,
            maxHeight: place.maxHeight,
          }}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => {
            const isSel = i === selectedIndex
            return (
              <li
                key={o.value}
                id={`${uid}-${i}`}
                role="option"
                aria-selected={isSel}
                className={[
                  styles.pickOption,
                  i === active ? styles.pickActive : '',
                  isSel ? styles.pickSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                {withTiles && tile(o)}
                <span className={styles.pickText}>{o.label}</span>
                <Check className={styles.pickCheck} size={16} strokeWidth={3} aria-hidden="true" />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AddUserDialog