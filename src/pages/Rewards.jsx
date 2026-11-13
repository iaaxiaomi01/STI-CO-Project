import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, Eye, EyeOff, HandCoins, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'
import {
  canEarnOg,
  canHandOutItems,
  canManageOgShop,
  cancelRedemption,
  claimRedemption,
  deleteShopItem,
  fetchMyBalance,
  fetchMyRedemptions,
  fetchMyTransactions,
  fetchOrgBalances,
  fetchOrgRedemptions,
  fetchShopItems,
  formatOgDate,
  isCharged,
  ogErrorMessage,
  personLabel,
  redeemItem,
  REDEMPTION_STATUSES,
  redemptionStatusLabel,
  saveShopItem,
  setShopItemActive,
} from '../lib/og.js'
import { isOgNotification, subscribeToNotifications } from '../lib/notifications.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { OgGem } from '../components/OgGem.jsx'
import CancelRedemptionDialog from '../components/CancelRedemptionDialog.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ShopItemForm from '../components/ShopItemForm.jsx'
import styles from './Rewards.module.css'

/* ============================================================
   REWARDS — ORGANIZATION GEMS (OG) AT REDEMPTION SHOP

   Iba-iba ang tab ayon sa role (lib/og.js para sa "can..."):

   Member  → Shop · Purchase History
   Officer → Shop · Purchase History · Hand out items
             (i-claim ang code ng member)
   Adviser → Manage shop · Hand out items · Members' OG

   Paano kumikita ng OG (OG_REWARD_FROM_PROPOSAL.sql):
     Officer naglagay ng OG reward sa proposal → approved →
     ginawa ang event → sarado na ang attendance (1 oras
     pagkatapos ng End Time) → KUSANG nare-release ang OG:
       may Time In AT Time Out = buong reward
       Time In lang            = wala

   Database ang nagbabantay sa lahat (OG_REWARDS_SHOP.sql).

   KAILAN NABABAWASAN (OG_DEDUCT_ON_CLAIM.sql, OG_FIRST_COME.sql):
     Redeem → sa item card mismo lalabas ang claim code at ang
              Cancel. HINDI pa bawas ang OG at stock, at WALANG
              reserve.
     Claim  → inilagay ng Officer/Adviser ang claim code sa
              "Hand out items" → DITO pa lang ibabawas ang OG ng
              member at ang stock ng item. First come first serve.

   ITSURA ("Org Shop" — UI lang, walang binago sa data o aksyon):
     - Balance bar: asul na may manipis na AWNING (dilaw at puti)
       sa itaas at ang LUMULUTANG NA DIAMOND (galing sa dating
       "Gem Vault"). ISANG LUGAR lang ng OG balance — wala nang
       ulit sa ibang tab.
     - Iba-iba ang design ng bawat button: Redeem (asul + kislap),
       Hand out (dilaw), + Add item (dilaw na pill + asul na bilog),
       Edit/Hide/Delete (pinagdugtong na grupo), Cancel (pulang text).
     - Shelf: nakasabit na PRICE TAG sa picture (ang tanging lugar
       ng presyo). Isang bagay lang ang nasa ibaba ng card ayon sa
       lagay: Redeem · Need X more OG · Limit reached · claim TICKET.
       Ubos na → "Sold out" na tatak sa picture lang.
     - Purchase History: parang RESIBO.
     - Hand out items: puting "counter" na may malaking field ng code
       (walang awning — isang awning lang sa page, sa balance bar).
     - Members' OG: talaan na may column header (walang ulit na
       "OG left" / "spent" sa bawat row).
   ============================================================ */

const TAB_SHOP = 'shop'
const TAB_HISTORY = 'history'
const TAB_CLAIMS = 'claims'
const TAB_MANAGE = 'manage'
const TAB_MEMBERS = 'members'

function tabsFor(profile) {
  const tabs = []
  if (canEarnOg(profile)) {
    tabs.push({ value: TAB_SHOP, label: 'Shop' })
    tabs.push({ value: TAB_HISTORY, label: 'Purchase History' })
  }
  if (canManageOgShop(profile)) {
    tabs.push({ value: TAB_MANAGE, label: 'Manage shop' })
  }
  if (canHandOutItems(profile)) tabs.push({ value: TAB_CLAIMS, label: 'Hand out items' })
  if (canManageOgShop(profile)) tabs.push({ value: TAB_MEMBERS, label: "Members' OG" })
  return tabs
}

const php = (n) => (Number(n) || 0).toLocaleString('en-PH')

function Rewards() {
  const { profile } = useAuth()
  const location = useLocation()
  const tabs = tabsFor(profile)
  const earns = canEarnOg(profile)

  const [tab, setTab] = useState(() => {
    const wanted = location.state?.tab
    return tabs.some((t) => t.value === wanted) ? wanted : tabs[0]?.value
  })

  /* ---------- BALANCE (Member at Officer) ---------- */
  const [balance, setBalance] = useState(null)

  const reloadBalance = useCallback(async () => {
    if (!earns) return
    try {
      setBalance(await fetchMyBalance())
    } catch (err) {
      console.error('Hindi makuha ang OG balance:', err)
    }
  }, [earns])

  useEffect(() => {
    reloadBalance()
  }, [reloadBalance])

  /* REALTIME: may na-release na OG o na-cancel ang redemption mo →
     kunin ulit ang balance (at ang listahan ng tab) */
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!profile?.id || !earns) return undefined
    return subscribeToNotifications(profile.id, {
      onInsert: (row) => {
        if (!isOgNotification(row)) return
        reloadBalance()
        setVersion((v) => v + 1)
      },
    })
  }, [profile?.id, earns, reloadBalance])

  if (tabs.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeader title="Rewards" />
        <EmptyState
          icon="◆"
          title="Nothing to show here"
          message="Organization Gems are for organization members, officers and advisers."
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Rewards" />

      {earns && <BalanceBar balance={balance} orgName={profile?.organizations?.name} />}

      {tabs.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Rewards">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`${styles.tab} ${tab === t.value ? styles.tabActive : ''}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === TAB_SHOP && (
        <ShopTab key={version} profile={profile} balance={balance ?? 0} onChanged={reloadBalance} />
      )}
      {tab === TAB_HISTORY && <HistoryTab key={version} profile={profile} />}
      {tab === TAB_MANAGE && <ManageShopTab profile={profile} />}
      {tab === TAB_CLAIMS && <ClaimsTab profile={profile} />}
      {tab === TAB_MEMBERS && <MembersOgTab />}
    </div>
  )
}

/* ============================================================
   BALANCE BAR — asul na may awning at lumulutang na diamond
   (Member at Officer). Ang TANGING lugar ng OG balance.
   ============================================================ */
function BalanceBar({ balance, orgName }) {
  return (
    <section className={styles.balanceBar} aria-label="Your Organization Gems">
      <span className={styles.awning} aria-hidden="true" />
      <div className={styles.balanceInner}>
        {/* Ang lumulutang na diamond (galing sa dating "Gem Vault"):
            glow sa likod, kislap sa kanto, at dahan-dahang pag-angat */}
        <div className={styles.balanceGem} aria-hidden="true">
          <span className={styles.gemGlow} />
          <OgGem size={68} className={styles.balanceGemSvg} />
          <Sparkles className={styles.gemSpark} size={18} strokeWidth={2.4} />
        </div>
        <div className={styles.balanceText}>
          <p className={styles.balanceValue}>
            {balance === null ? '…' : php(balance)}
            <span className={styles.balanceUnit}>OG</span>
          </p>
          <p className={styles.balanceLabel}>
            Your Organization Gems{orgName ? ` · ${orgName}` : ''}
          </p>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   MGA PIRASO NG ITEM CARD (Shop at Manage shop)
   ============================================================ */

/* Picture o gem kapag walang picture */
function ItemImage({ item }) {
  return item.image_url ? (
    <img className={styles.itemImage} src={item.image_url} alt="" loading="lazy" />
  ) : (
    <span className={styles.itemPlaceholder} aria-hidden="true">
      <OgGem size={46} />
    </span>
  )
}

/* Nakasabit na price tag — ang TANGING lugar ng presyo sa card */
function PriceTag({ price }) {
  return (
    <span className={styles.tagHanger}>
      <span className={styles.tagString} aria-hidden="true" />
      <span className={styles.tag}>
        <span className={styles.tagHole} aria-hidden="true" />
        <span className={styles.tagPrice}>{php(price)}</span>
        <span className={styles.tagUnit}>OG</span>
      </span>
    </span>
  )
}

/* "15 left · Limit 1 per member" — walang inuulit na nasa ibang
   bahagi ng card (Sold out = tatak; Limit reached = ibaba) */
function itemFacts(item, { hideStock = false, hideLimit = false } = {}) {
  const facts = []
  if (!hideStock) {
    if (item.stock === null) facts.push('Unlimited stock')
    else if (item.stock > 0) facts.push(`${php(item.stock)} left`)
  }
  if (!hideLimit && item.limit_per_member !== null) {
    facts.push(`Limit ${item.limit_per_member} per member`)
  }
  return facts.join(' · ')
}

/* ============================================================
   SHOP — Member at Officer

   Pagpindot ng Redeem, sa card mismo lalabas ang CLAIM TICKET
   (code + Cancel). Isang claim code lang bawat item
   (OG_FIRST_COME.sql). Walang reserve: hindi pa bawas ang OG at
   stock hanggang ilagay ng Officer/Adviser ang code.

   ============================================================ */
function ShopTab({ profile, balance, onChanged }) {
  const [items, setItems] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /* Aling item ang may ginagawa (redeem o cancel) at ang error nito */
  const [busyId, setBusyId] = useState(null)
  const [itemError, setItemError] = useState({ id: null, text: '' })

  const load = useCallback(async () => {
    try {
      const [list, my] = await Promise.all([fetchShopItems(), fetchMyRedemptions(profile.id)])
      setItems(list)
      setMine(my)
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang shop:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  /* Ilan na ang na-redeem mo bawat item (hindi kasama ang cancelled),
     at ang claim code na hindi pa na-claim (kung meron) */
  const { myCount, pendingByItem } = useMemo(() => {
    const count = {}
    const pending = {}
    mine.forEach((r) => {
      if (!r.item_id) return
      if (r.status !== 'cancelled') count[r.item_id] = (count[r.item_id] ?? 0) + 1
      if (r.status === 'pending' && !pending[r.item_id]) pending[r.item_id] = r
    })
    return { myCount: count, pendingByItem: pending }
  }, [mine])

  async function handleRedeem(item) {
    setBusyId(item.id)
    setItemError({ id: null, text: '' })
    try {
      await redeemItem(item.id)
      await load()
    } catch (err) {
      console.error('Hindi na-redeem:', err)
      setItemError({ id: item.id, text: ogErrorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(item, redemption) {
    setBusyId(item.id)
    setItemError({ id: null, text: '' })
    try {
      await cancelRedemption(redemption.id)
      await load()
      /* Lumang claim code lang (nabawasan na noon) ang may ibinabalik */
      if (isCharged(redemption)) onChanged()
    } catch (err) {
      console.error('Hindi na-cancel:', err)
      setItemError({ id: item.id, text: ogErrorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className={styles.muted}>Loading the shop…</p>

  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load the shop"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }

  if (items.length === 0) {
    return <EmptyState icon="◆" title="The shop is empty for now" />
  }

  return (
    <ul className={styles.shelf}>
      {items.map((item) => {
        const pending = pendingByItem[item.id] ?? null
        const outOfStock = item.stock !== null && item.stock <= 0
        const used = myCount[item.id] ?? 0
        const limitReached = item.limit_per_member !== null && used >= item.limit_per_member
        const short = item.price - balance
        const busy = busyId === item.id

        /* Isang lagay lang ang ipinapakita sa ibaba ng card */
        let state = 'ready'
        if (pending) state = 'pending'
        else if (outOfStock) state = 'soldout'
        else if (limitReached) state = 'limit'
        else if (short > 0) state = 'short'

        const progress = item.price > 0 ? Math.min(100, (balance / item.price) * 100) : 100
        const facts = itemFacts(item, { hideLimit: state === 'limit' })

        return (
          <li
            key={item.id}
            className={`${styles.card} ${state === 'soldout' ? styles.cardSoldOut : ''}`}
          >
            <div className={styles.media}>
              <ItemImage item={item} />
              <PriceTag price={item.price} />
              {state === 'soldout' && <span className={styles.stamp}>Sold out</span>}
            </div>

            <div className={styles.cardBody}>
              <h2 className={styles.cardName}>{item.name}</h2>
              {item.description && <p className={styles.cardDesc}>{item.description}</p>}
              {facts && <p className={styles.cardFacts}>{facts}</p>}
            </div>

            {state === 'ready' && (
              <div className={styles.cardFoot}>
                <button
                  type="button"
                  className={styles.redeemBtn}
                  disabled={busy}
                  onClick={() => handleRedeem(item)}
                >
                  {!busy && <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />}
                  {busy ? 'Redeeming…' : 'Redeem'}
                </button>
              </div>
            )}

            {state === 'short' && (
              <div className={styles.cardFoot}>
                <span className={styles.progress} aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </span>
                <p className={styles.footNote}>Need {php(short)} more OG</p>
              </div>
            )}

            {state === 'limit' && (
              <div className={styles.cardFoot}>
                <p className={styles.footPill}>
                  Limit reached ({used} of {item.limit_per_member})
                </p>
              </div>
            )}

            {state === 'pending' && (
              /* Claim ticket — putol-putol na linya at butas sa gilid */
              <div className={styles.ticket}>
                <div className={styles.ticketTop}>
                  <span className={styles.ticketCode} aria-label="Claim code">
                    {pending.claim_code}
                  </span>
                  <button
                    type="button"
                    className={styles.textDanger}
                    disabled={busy}
                    onClick={() => handleCancel(item, pending)}
                  >
                    {busy ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
                <p className={styles.ticketHint}>
                  Show this code to an Officer. Your OG is deducted once they enter it.
                </p>
              </div>
            )}

            {itemError.id === item.id && (
              <p className={styles.cardError} role="alert">
                {itemError.text}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ============================================================
   PURCHASE HISTORY — Member at Officer, parang RESIBO

   Wala nang "OG left" dito — nasa balance bar na sa itaas.
   Earned at Spent lang ang total sa dulo.
   ============================================================ */
function shortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  })
}

function longDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function HistoryTab({ profile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    fetchMyTransactions(profile.id, profile.organization_id)
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((err) => {
        console.error('Hindi makuha ang OG history:', err)
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile.id, profile.organization_id])

  const totals = useMemo(() => {
    let earned = 0
    let spent = 0
    rows.forEach((t) => {
      if (t.kind === 'event_reward') earned += t.amount
      else spent -= t.amount /* redemption (−) at refund (+) */
    })
    return { earned, spent }
  }, [rows])

  if (loading) return <p className={styles.muted}>Loading your history…</p>

  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load your history"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="◆"
        title="No history yet"
        message="Your event rewards and redeemed items will show up here."
      />
    )
  }

  /* Pinakabago ang nauuna (order by created_at desc) */
  const newest = rows[0]?.created_at
  const oldest = rows[rows.length - 1]?.created_at

  return (
    <div className={styles.receiptWrap}>
      <article className={styles.receipt} aria-label="OG statement">
        <div className={styles.receiptHead}>
          <h2 className={styles.receiptTitle}>OG Statement</h2>
          <p className={styles.receiptRange}>
            {longDate(oldest)}
            {longDate(oldest) !== longDate(newest) && <> – {longDate(newest)}</>}
          </p>
        </div>

        <ul className={styles.receiptRows}>
          {rows.map((t) => (
            <li key={t.id} className={styles.receiptRow}>
              <time className={styles.receiptDate} dateTime={t.created_at} title={formatOgDate(t.created_at)}>
                {shortDate(t.created_at)}
              </time>
              <span className={styles.receiptDesc}>{t.description}</span>
              <span
                className={`${styles.receiptAmount} ${t.amount >= 0 ? styles.plus : styles.minus}`}
              >
                {t.amount >= 0 ? '+' : '−'}
                {php(Math.abs(t.amount))}
              </span>
            </li>
          ))}
        </ul>

        <dl className={styles.receiptTotals}>
          <div>
            <dt>Earned</dt>
            <dd className={styles.plus}>+{php(totals.earned)}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd className={styles.minus}>−{php(totals.spent)}</dd>
          </div>
        </dl>
      </article>
    </div>
  )
}

/* ============================================================
   MANAGE SHOP — Adviser

   Kaparehong shelf ng Shop. Sa ibaba ng card: Edit · Hide/Show ·
   Delete. Ang Delete ay may ConfirmDialog na (dati
   window.confirm() ng browser).
   ============================================================ */
function ManageShopTab({ profile }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) /* null | 'new' | item */
  const [deleting, setDeleting] = useState(null) /* item na hinihintay ang "Delete" */
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await fetchShopItems())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang shop:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggle(item) {
    setBusyId(item.id)
    setActionError('')
    try {
      await setShopItemActive(item, !item.is_active)
      await load()
    } catch (err) {
      console.error('Hindi nabago ang item:', err)
      setActionError(ogErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  /* Galing sa ConfirmDialog. Kapag nag-throw, doon lalabas ang error. */
  async function handleDelete() {
    const item = deleting
    if (!item) return
    setBusyId(item.id)
    setActionError('')
    try {
      await deleteShopItem(item)
      setDeleting(null)
      await load()
    } catch (err) {
      console.error('Hindi nabura ang item:', err)
      throw new Error(ogErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className={styles.muted}>Loading the shop…</p>
  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load the shop"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }

  const shown = items.filter((i) => i.is_active).length

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.toolbarText}>
          <strong>{shown}</strong> shown · <strong>{items.length - shown}</strong> hidden
        </p>
        {/* Kahugis ng "Create Event" at "+ Post", pero DILAW ang katawan
            at ASUL ang bilog — kulay ng Organization Gems */}
        <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
          <span className={styles.addIcon} aria-hidden="true">
            <Plus size={18} strokeWidth={2.8} />
          </span>
          Add item
        </button>
      </div>

      {actionError && <p className={styles.panelError}>{actionError}</p>}

      {items.length === 0 ? (
        <EmptyState icon="◆" title="Your shop has no items yet" />
      ) : (
        <ul className={styles.shelf}>
          {items.map((item) => {
            const busy = busyId === item.id
            const outOfStock = item.stock !== null && item.stock <= 0
            const facts = itemFacts(item)
            return (
              <li
                key={item.id}
                className={`${styles.card} ${item.is_active ? '' : styles.cardHidden}`}
              >
                <div className={styles.media}>
                  <ItemImage item={item} />
                  <PriceTag price={item.price} />
                  {!item.is_active && (
                    <span className={styles.hiddenBadge}>
                      <EyeOff size={12} strokeWidth={2.6} aria-hidden="true" />
                      Hidden
                    </span>
                  )}
                  {item.is_active && outOfStock && <span className={styles.stamp}>Sold out</span>}
                </div>

                <div className={styles.cardBody}>
                  <h2 className={styles.cardName}>{item.name}</h2>
                  {item.description && <p className={styles.cardDesc}>{item.description}</p>}
                  {facts && <p className={styles.cardFacts}>{facts}</p>}
                </div>

                <div className={styles.manageActions}>
                  <button
                    type="button"
                    className={styles.manageBtn}
                    onClick={() => setEditing(item)}
                    disabled={busy}
                  >
                    <Pencil size={14} strokeWidth={2.4} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.manageBtn}
                    onClick={() => handleToggle(item)}
                    disabled={busy}
                  >
                    {item.is_active ? (
                      <EyeOff size={14} strokeWidth={2.4} aria-hidden="true" />
                    ) : (
                      <Eye size={14} strokeWidth={2.4} aria-hidden="true" />
                    )}
                    {item.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.manageBtn} ${styles.manageDanger}`}
                    onClick={() => {
                      setActionError('')
                      setDeleting(item)
                    }}
                    disabled={busy}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <ShopItemForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (values, options) => {
            await saveShopItem(
              profile.organization_id,
              editing === 'new' ? null : editing,
              values,
              options,
            )
            setEditing(null)
            await load()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          tone="danger"
          title="Delete item?"
          item={deleting.name}
          message="Past redemptions of this item are kept. To keep it but stop redemptions, use Hide instead."
          confirmLabel="Delete"
          busyLabel="Deleting…"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}

/* ============================================================
   HAND OUT ITEMS — Officer at Adviser, parang COUNTER ng tindahan
   (puti, para hindi kapareho ng asul na balance bar sa itaas)

   Claim code LANG ang paraan para maibigay ang item. Kapag
   inilagay ang code, dito pa lang ibabawas ang OG ng member at
   ang stock ng item. Cancel na lang ang nasa bawat row.

   Status badge: sa "All" lang ipinapakita — sa ibang filter,
   pare-pareho na ang status kaya inuulit lang nito ang filter.
   ============================================================ */
const CLAIM_FILTERS = [...REDEMPTION_STATUSES, { value: 'all', label: 'All' }]

function ClaimsTab({ profile }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pending')

  const [code, setCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [result, setResult] = useState({ tone: '', text: '' })

  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(async () => {
    try {
      setList(await fetchOrgRedemptions())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang mga redemption ng org:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setClaiming(true)
    setResult({ tone: '', text: '' })
    try {
      const r = await claimRedemption(code)
      const deducted = Number(r.deducted) || 0
      setResult({
        tone: 'ok',
        text:
          `${r.claim_code}: give “${r.item_name}” to ${personLabel(r.redeemer_name).name}.` +
          (deducted > 0 ? ` ${php(deducted)} OG was deducted.` : ''),
      })
      setCode('')
      await load()
    } catch (err) {
      console.error('Hindi na-claim:', err)
      setResult({ tone: 'error', text: ogErrorMessage(err) })
    } finally {
      setClaiming(false)
    }
  }

  const counts = useMemo(() => {
    const c = { all: list.length, pending: 0, claimed: 0, cancelled: 0 }
    list.forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1
    })
    return c
  }, [list])

  const visible = filter === 'all' ? list : list.filter((r) => r.status === filter)

  return (
    <>
      {/* ---------- COUNTER ---------- */}
      <form className={styles.counter} onSubmit={handleSubmit}>
        <div className={styles.counterInner}>
          <label className={styles.counterLabel} htmlFor="claim-code">
            Enter the member’s claim code
          </label>
          <div className={styles.counterRow}>
            <input
              id="claim-code"
              className={styles.counterInput}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="OG-XXXXXX"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
            />
            <button
              type="submit"
              className={styles.counterBtn}
              disabled={claiming || !code.trim()}
            >
              {!claiming && <HandCoins size={18} strokeWidth={2.4} aria-hidden="true" />}
              {claiming ? 'Checking…' : 'Hand out'}
            </button>
          </div>
          <p className={styles.counterHint}>
            Their OG and the item’s stock are deducted only when you enter the code. You can’t
            hand out your own item.
          </p>
        </div>
      </form>

      {result.text && (
        <p
          className={result.tone === 'error' ? styles.panelError : styles.claimOk}
          role="status"
        >
          {result.tone !== 'error' && <Check size={16} strokeWidth={3} aria-hidden="true" />}
          {result.text}
        </p>
      )}

      <div className={styles.chips} role="tablist" aria-label="Filter redemptions">
        {CLAIM_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`${styles.chip} ${filter === f.value ? styles.chipActive : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span className={styles.chipCount}>{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading && <p className={styles.muted}>Loading redemptions…</p>}
      {!loading && error && (
        <EmptyState
          icon="!"
          title="Could not load redemptions"
          message="There was a problem connecting to the database. Please try again later."
        />
      )}
      {!loading && !error && visible.length === 0 && (
        <p className={styles.muted}>
          {filter === 'pending' ? 'No items waiting to be handed out.' : 'Nothing here yet.'}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className={styles.list}>
          {visible.map((r) => {
            const { name, role } = personLabel(r.redeemer_name, r.redeemer_role_id)
            return (
              <li key={r.id} className={styles.listRow}>
                <span className={styles.listMain}>
                  <span className={styles.listTitle}>{r.item_name}</span>
                  <span className={styles.listSub}>
                    {name} · {role} · {formatOgDate(r.created_at)}
                  </span>
                  <RedemptionOutcome r={r} />
                </span>
                <span className={styles.listPrice}>
                  <OgGem size={14} />
                  {php(r.price)}
                </span>
                {filter === 'all' && (
                  <span className={`${styles.badge} ${styles[`badge_${r.status}`] ?? ''}`}>
                    {redemptionStatusLabel(r.status)}
                  </span>
                )}
                {r.status === 'pending' && (
                  <button
                    type="button"
                    className={styles.textDanger}
                    onClick={() => setCancelling(r)}
                  >
                    Cancel
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {cancelling && (
        <CancelRedemptionDialog
          redemption={cancelling}
          ownRedemption={cancelling.profile_id === profile.id}
          onCancel={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null)
            load()
          }}
        />
      )}
    </>
  )
}

/* "Handed out by … · date" / "Cancelled by … · date" */
function RedemptionOutcome({ r }) {
  if (r.status === 'claimed') {
    return (
      <span className={styles.listOutcome}>
        Handed out by {r.claimed_by_name ?? 'an Officer'} · {formatOgDate(r.claimed_at)}
      </span>
    )
  }
  if (r.status === 'cancelled') {
    return (
      <span className={styles.listOutcome}>
        Cancelled by{' '}
        {r.cancelled_by === r.profile_id ? 'the member' : (r.cancelled_by_name ?? 'an Officer')} ·{' '}
        {formatOgDate(r.cancelled_at)}
        {isCharged(r) && <> · {php(r.price)} OG returned</>}
        {r.cancel_reason && <span className={styles.reason}>“{r.cancel_reason}”</span>}
      </span>
    )
  }
  return null
}

/* ============================================================
   MEMBERS' OG — Adviser

   Talaan ng org mo LANG — ang org_og_balances() ay kumukuha lang
   sa org ng Adviser.

   RANKING: kung sino ang PINAKAMARAMING OG NA NAGASTOS ang una.

   Walang "spent" column sa database, kaya kinukuwenta ito rito:
     balance = earned − redemptions + refunds
     spent   = earned − balance

   May column header na ("OG left", "OG spent"), kaya hindi na
   inuulit ang mga salitang iyon sa bawat row.

   Itsura: asul na header; mapusyaw na gold/silver/bronze at guhit
   sa gilid ang top 3; maliit na gold na bar sa ilalim ng "OG spent"
   (gaano kalaki kumpara sa pinakamataas).
   ============================================================ */
function fullName(r) {
  return `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
}

function rankBySpent(rows) {
  return rows
    .map((r) => ({ ...r, spent: Math.max(0, r.earned - r.balance) }))
    .sort((a, b) => b.spent - a.spent || fullName(a).localeCompare(fullName(b)))
}

function MembersOgTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    fetchOrgBalances()
      .then((data) => {
        if (active) setRows(rankBySpent(data))
      })
      .catch((err) => {
        console.error('Hindi makuha ang OG ng members:', err)
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) return <p className={styles.muted}>Loading members…</p>
  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load members"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }
  if (rows.length === 0) {
    return <EmptyState icon="▲" title="No members yet" message="" />
  }

  const spent = rows.reduce((s, r) => s + r.spent, 0)
  const left = rows.reduce((s, r) => s + r.balance, 0)
  /* Para sa maliit na bar sa ilalim ng "OG spent" (pinakamataas = puno) */
  const maxSpent = rows[0]?.spent ?? 0

  return (
    <div className={styles.ledger}>
      <div className={styles.ledgerSummary}>
        <p>
          <strong>{rows.length}</strong> members
        </p>
        <p>
          <strong>{php(spent)}</strong> OG spent
        </p>
        <p>
          <strong>{php(left)}</strong> OG not yet spent
        </p>
      </div>

      <div className={styles.ledgerTable} role="table" aria-label="Members ranked by OG spent">
        <div className={`${styles.ledgerRow} ${styles.ledgerHead}`} role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Member</span>
          <span role="columnheader" className={styles.num}>
            OG left
          </span>
          <span role="columnheader" className={styles.num}>
            OG spent
          </span>
        </div>
        {rows.map((r, i) => {
          const { name, role } = personLabel(fullName(r), r.role_id)
          /* Gold/silver/bronze sa top 3 — kapag may nagastos na talaga */
          const medal = r.spent > 0 ? (['rank1', 'rank2', 'rank3'][i] ?? '') : ''
          return (
            <div
              key={r.profile_id}
              className={`${styles.ledgerRow} ${medal ? styles[`row_${medal}`] : ''}`}
              role="row"
            >
              <span role="cell" className={`${styles.rank} ${styles[medal] ?? ''}`}>
                {i + 1}
              </span>
              <span role="cell" className={styles.ledgerName}>
                {name}
                <span className={styles.ledgerRole}>{role}</span>
              </span>
              <span role="cell" className={`${styles.num} ${styles.ledgerLeft}`}>
                {php(r.balance)}
              </span>
              <span role="cell" className={`${styles.num} ${styles.ledgerSpent}`}>
                {php(r.spent)}
                <span className={styles.spentBar} aria-hidden="true">
                  <span style={{ width: `${maxSpent > 0 ? (r.spent / maxSpent) * 100 : 0}%` }} />
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Rewards