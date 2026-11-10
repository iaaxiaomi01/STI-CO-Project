import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  HandCoins,
  History,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Trophy,
} from 'lucide-react'
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
import { OgAmount, OgGem } from '../components/OgGem.jsx'
import CancelRedemptionDialog from '../components/CancelRedemptionDialog.jsx'
import ShopItemForm from '../components/ShopItemForm.jsx'
import styles from './Rewards.module.css'

/* ============================================================
   REWARDS — ORGANIZATION GEMS (OG) AT REDEMPTION SHOP

   Iba-iba ang tab ayon sa role (lib/og.js para sa "can..."):

   Member  → Shop · OG history
   Officer → Shop · OG history ·
             Hand out items (i-claim ang code ng member)
   Adviser → Manage shop · Hand out items · Members' OG

   Paano kumikita ng OG (OG_REWARD_FROM_PROPOSAL.sql):
     Officer naglagay ng OG reward sa proposal → approved →
     ginawa ang event → sarado na ang attendance (1 oras
     pagkatapos ng End Time) → KUSANG nare-release ang OG:
       may Time In AT Time Out = buong reward
       Time In lang            = wala
     Wala nang "Event rewards" (Adviser) at "Release OG" (Officer).

   Database ang nagbabantay sa lahat (OG_REWARDS_SHOP.sql).

   KAILAN NABABAWASAN (OG_DEDUCT_ON_CLAIM.sql, OG_FIRST_COME.sql):
     Redeem → sa item card mismo lalabas ang claim code at ang
              Cancel. HINDI pa bawas ang OG at stock, at WALANG
              reserve. Wala nang "My redemptions".
     Claim  → inilagay ng Officer/Adviser ang claim code sa
              "Hand out items" → DITO pa lang ibabawas ang OG ng
              member at ang stock ng item. First come first serve:
              kapag naubos na ang OG o stock, hindi na maibibigay.
     Walang "Hand out" button sa bawat row — claim code lang ang
     paraan para maibigay ang item. Cancel na lang ang natira.

   ITSURA ("Gem Vault" — UI lang, walang binago sa data o aksyon):
     - OG mo: malaking gold na numero sa deep navy na "night sky"
       na may kumikinang na gem (BalanceCard)
     - tabs: pill dock na may icon
     - Shop: "shelf" na walang card; price tag sa larawan, at
       progress bar kung gaano ka na kalapit sa presyo
     - OG history: timeline · Members' OG: leaderboard ayon sa
       OG na nagastos (top 3 may medalya)
   ============================================================ */

/* Icon ng bawat tab */
const TAB_ICONS = {
  shop: ShoppingBag,
  history: History,
  manage: Store,
  claims: HandCoins,
  members: Trophy,
}

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

      {earns && <BalanceCard balance={balance} orgName={profile?.organizations?.name} />}

      {tabs.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Rewards">
          {tabs.map((t) => {
            const Icon = TAB_ICONS[t.value]
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                className={`${styles.tab} ${tab === t.value ? styles.tabActive : ''}`}
                onClick={() => setTab(t.value)}
              >
                {Icon && <Icon size={17} strokeWidth={2.3} aria-hidden="true" />}
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      {tab === TAB_SHOP && (
        <ShopTab
          key={version}
          profile={profile}
          balance={balance ?? 0}
          onChanged={reloadBalance}
        />
      )}
      {tab === TAB_HISTORY && <HistoryTab key={version} profile={profile} balance={balance} />}
      {tab === TAB_MANAGE && <ManageShopTab profile={profile} />}
      {tab === TAB_CLAIMS && <ClaimsTab profile={profile} />}
      {tab === TAB_MEMBERS && <MembersOgTab />}
    </div>
  )
}

/* ============================================================
   BALANCE — "night sky" na may kumikinang na gem
   (Member at Officer). Itsura lang ang mga sparkle.
   ============================================================ */
function BalanceCard({ balance, orgName }) {
  return (
    <section className={styles.balanceCard} aria-label="Your Organization Gems">
      {/* Mga kislap sa langit */}
      <span className={styles.sky} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>

      <div className={styles.balanceGem} aria-hidden="true">
        <span className={styles.gemGlow} />
        <OgGem size={92} className={styles.balanceGemSvg} />
        <Sparkles className={styles.gemSpark} size={22} strokeWidth={2.4} />
      </div>
      <div className={styles.balanceText}>
        <p className={styles.balanceLabel}>
          Your Organization Gems{orgName ? ` · ${orgName}` : ''}
        </p>
        <p className={styles.balanceValue}>
          {balance === null ? '…' : balance.toLocaleString('en-PH')}
          <span className={styles.balanceUnit}>OG</span>
        </p>
        <p className={styles.balanceHint}>
          Earn OG by completing your Time In and Time Out at events.
        </p>
      </div>
    </section>
  )
}

/* ============================================================
   SHOP — Member at Officer

   Walang "My redemptions" at walang confirm dialog. Pagpindot ng
   Redeem, sa card mismo lalabas ang CLAIM CODE at ang Cancel.
   Mananatili ito sa card hangga't hindi pa na-claim o na-cancel
   (isang claim code lang bawat item — OG_FIRST_COME.sql).

   Walang reserve, first come first serve: hindi pa bawas ang OG
   at stock hanggang ilagay ng Officer/Adviser ang code. Kapag
   naubos na ang OG o stock bago ma-claim, hindi na ito maibibigay.
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
    <ul className={styles.itemGrid}>
      {items.map((item) => {
        const pending = pendingByItem[item.id] ?? null
        const outOfStock = item.stock !== null && item.stock <= 0
        const used = myCount[item.id] ?? 0
        const limitReached = item.limit_per_member !== null && used >= item.limit_per_member
        const short = item.price - balance
        const busy = busyId === item.id

        let label = 'Redeem'
        if (outOfStock) label = 'Out of stock'
        else if (limitReached) label = 'Limit reached'
        else if (short > 0) label = `Need ${short.toLocaleString('en-PH')} more OG`
        const disabled = outOfStock || limitReached || short > 0

        /* Itsura lang: gaano ka na kalapit sa presyo (kapag kulang pa) */
        const showProgress = !pending && !outOfStock && !limitReached && short > 0
        const progress = item.price > 0 ? Math.min(100, (balance / item.price) * 100) : 100

        return (
          <li
            key={item.id}
            className={`${styles.itemCard} ${pending || !disabled ? styles.itemReady : ''}`}
          >
            <div className={styles.itemMedia}>
              <ItemImage item={item} />
              <OgAmount value={item.price} size={18} className={styles.itemPrice} />
            </div>
            <div className={styles.itemBody}>
              <h2 className={styles.itemName}>{item.name}</h2>
              {item.description && <p className={styles.itemDesc}>{item.description}</p>}
              <ItemFacts item={item} used={used} />
            </div>
            <div className={styles.itemFooter}>
              {pending ? (
                /* May claim code na — ipakita ito at ang Cancel */
                <div className={styles.claimBox}>
                  <span className={styles.codeSmallLabel}>Claim code</span>
                  <span className={styles.codeSmall}>{pending.claim_code}</span>
                  <span className={styles.claimBoxHint}>
                    Show this to an Officer or the Adviser. Your OG is deducted only when they
                    enter it.
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
              ) : (
                <>
                  {showProgress && (
                    <span className={styles.progress} aria-hidden="true">
                      <span style={{ width: `${progress}%` }} />
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.redeemBtn}
                    disabled={disabled || busy}
                    onClick={() => handleRedeem(item)}
                  >
                    {!disabled && <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />}
                    {busy ? 'Redeeming…' : label}
                  </button>
                </>
              )}
              {itemError.id === item.id && (
                <p className={styles.panelError} role="alert">
                  {itemError.text}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ItemImage({ item }) {
  return item.image_url ? (
    <img className={styles.itemImage} src={item.image_url} alt="" loading="lazy" />
  ) : (
    <div className={styles.itemPlaceholder} aria-hidden="true">
      <OgGem size={42} />
    </div>
  )
}

/* "3 left · Limit 1 per member" */
function ItemFacts({ item, used = null }) {
  const facts = []
  if (item.stock === null) facts.push('Unlimited stock')
  else if (item.stock <= 0) facts.push('Out of stock')
  else facts.push(`${item.stock} left`)

  if (item.limit_per_member !== null) {
    facts.push(
      !used
        ? `Limit ${item.limit_per_member} per member`
        : `You redeemed ${used} of ${item.limit_per_member}`,
    )
  }
  return <p className={styles.itemFacts}>{facts.join(' · ')}</p>
}

function StatusBadge({ status }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`] ?? ''}`}>
      {redemptionStatusLabel(status)}
    </span>
  )
}

/* "Claimed · handed out by Oscar Officer on …" / "Cancelled by … — reason" */
function RedemptionOutcome({ r }) {
  if (r.status === 'claimed') {
    return (
      <p className={styles.outcome}>
        Handed out by {r.claimed_by_name ?? 'an Officer'} · {formatOgDate(r.claimed_at)}
      </p>
    )
  }
  if (r.status === 'cancelled') {
    return (
      <p className={styles.outcome}>
        Cancelled by {r.cancelled_by === r.profile_id ? 'you' : r.cancelled_by_name ?? 'an Officer'}{' '}
        · {formatOgDate(r.cancelled_at)}
        {isCharged(r) && <> · {r.price.toLocaleString('en-PH')} OG returned</>}
        {r.cancel_reason && <span className={styles.reason}>“{r.cancel_reason}”</span>}
      </p>
    )
  }
  return null
}

/* ============================================================
   OG HISTORY — Member at Officer
   ============================================================ */
const KIND_ICON = { event_reward: Sparkles, redemption: ShoppingBag, refund: RotateCcw }

function HistoryTab({ profile, balance }) {
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

  if (loading) return <p className={styles.muted}>Loading your OG history…</p>
  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load your OG history"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="◆"
        title="Purchase History"
      />
    )
  }

  return (
    <>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totals.earned.toLocaleString('en-PH')}</span>
          <span className={styles.statLabel}>OG earned</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totals.spent.toLocaleString('en-PH')}</span>
          <span className={styles.statLabel}>OG spent</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{(balance ?? 0).toLocaleString('en-PH')}</span>
          <span className={styles.statLabel}>OG left</span>
        </div>
      </div>

      <ul className={styles.ledger}>
        {rows.map((t) => {
          const KindIcon = KIND_ICON[t.kind]
          return (
          <li key={t.id} className={styles.ledgerRow}>
            <span className={`${styles.ledgerIcon} ${styles[`kind_${t.kind}`] ?? ''}`} aria-hidden="true">
              {KindIcon ? <KindIcon size={17} strokeWidth={2.4} /> : '•'}
            </span>
            <span className={styles.ledgerText}>
              <span className={styles.ledgerDesc}>{t.description}</span>
              <span className={styles.ledgerWhen}>{formatOgDate(t.created_at)}</span>
            </span>
            <OgAmount value={t.amount} signed size={14} />
          </li>
          )
        })}
      </ul>
    </>
  )
}

/* ============================================================
   MANAGE SHOP — Adviser
   ============================================================ */
function ManageShopTab({ profile }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) /* null | 'new' | item */
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

  async function handleDelete(item) {
    const ok = window.confirm(
      `Delete "${item.name}"?\n\nPast redemptions of this item are kept. ` +
        'To keep it but stop redemptions, use Hide instead.',
    )
    if (!ok) return
    setBusyId(item.id)
    setActionError('')
    try {
      await deleteShopItem(item)
      await load()
    } catch (err) {
      console.error('Hindi nabura ang item:', err)
      setActionError(ogErrorMessage(err))
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
        <p className={styles.summaryInline}>
          <strong>{shown}</strong> shown · <strong>{items.length - shown}</strong> hidden
        </p>
        <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
          <Plus size={17} strokeWidth={2.6} aria-hidden="true" />
          Add item
        </button>
      </div>

      {actionError && <p className={styles.panelError}>{actionError}</p>}

      {items.length === 0 ? (
        <EmptyState
          icon="◆"
          title="Your shop has no items yet"
        />
      ) : (
        <ul className={styles.itemGrid}>
          {items.map((item) => (
            <li
              key={item.id}
              className={`${styles.itemCard} ${item.is_active ? '' : styles.itemHidden}`}
            >
              <div className={styles.itemMedia}>
                <ItemImage item={item} />
                <OgAmount value={item.price} size={18} className={styles.itemPrice} />
              </div>
              <div className={styles.itemBody}>
                <div className={styles.titleRow}>
                  <h2 className={styles.itemName}>{item.name}</h2>
                  {!item.is_active && <span className={styles.badge}>Hidden</span>}
                </div>
                {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                <ItemFacts item={item} />
              </div>
              <div className={styles.manageActions}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setEditing(item)}
                  disabled={busyId === item.id}
                >
                  <Pencil size={14} strokeWidth={2.4} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => handleToggle(item)}
                  disabled={busyId === item.id}
                >
                  {item.is_active ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  className={styles.textDanger}
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                >
                  <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </li>
          ))}
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
    </>
  )
}

/* ============================================================
   HAND OUT ITEMS — Officer at Adviser

   Claim code LANG ang paraan para maibigay ang item — wala nang
   "Hand out" button sa bawat row. Kapag inilagay ang code, dito
   pa lang ibabawas ang OG ng member at ang stock ng item.
   Cancel na lang ang natira sa bawat row.
   ============================================================ */
const CLAIM_FILTERS = [{ value: 'all', label: 'All' }, ...REDEMPTION_STATUSES]

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
          `✓ ${r.claim_code}: give “${r.item_name}” to ${personLabel(r.redeemer_name).name}.` +
          (deducted > 0 ? ` ${deducted.toLocaleString('en-PH')} OG was deducted.` : ''),
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
      <form className={styles.claimForm} onSubmit={handleSubmit}>
        <label className={styles.claimLabel} htmlFor="claim-code">
          Claim code
        </label>
        <div className={styles.claimRow}>
          <input
            id="claim-code"
            className={styles.claimInput}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="OG-XXXXXX"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
          />
          <button type="submit" className={styles.claimBtn} disabled={claiming || !code.trim()}>
            {claiming ? 'Checking…' : 'Hand out'}
          </button>
        </div>
        <p className={styles.hintSmall}>
          Ask the member for the code on their phone. Their OG and the item's stock are deducted
          only when you enter the code. You can't hand out your own item.
        </p>
      </form>

      {result.text && (
        <p className={result.tone === 'error' ? styles.panelError : styles.claimOk} role="status">
          {result.text}
        </p>
      )}

      <div className={styles.filters} role="tablist" aria-label="Filter redemptions">
        {CLAIM_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`${styles.filter} ${filter === f.value ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span className={styles.filterCount}>{counts[f.value] ?? 0}</span>
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
        <ul className={styles.people}>
          {visible.map((r) => {
            const { name, role } = personLabel(r.redeemer_name, r.redeemer_role_id)
            return (
              <li key={r.id} className={styles.person}>
                <span className={styles.personMain}>
                  <span className={styles.name}>{r.item_name}</span>
                  <span className={styles.personSub}>
                    {name} · {role} · {formatOgDate(r.created_at)}
                  </span>
                  <RedemptionOutcome r={r} />
                </span>
                <OgAmount value={r.price} size={14} />
                <StatusBadge status={r.status} />
                {/* Cancel lang — ang pagbibigay ay sa claim code sa itaas */}
                {r.status === 'pending' && (
                  <span className={styles.personActions}>
                    <button
                      type="button"
                      className={styles.textDanger}
                      onClick={() => setCancelling(r)}
                    >
                      Cancel
                    </button>
                  </span>
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

/* ============================================================
   MEMBERS' OG — Adviser

   Leaderboard ng org mo LANG — ang org_og_balances() ay kumukuha
   lang sa org ng Adviser (o sa acting org ng School Admin).

   RANKING: kung sino ang PINAKAMARAMING OG NA NAGASTOS ang una.
   Walang "OG earned" na ipinapakita.

   Walang "spent" column sa database, kaya kinukuwenta ito rito.
   event_reward, redemption at refund lang ang laman ng ledger:
     balance = earned − redemptions + refunds
     spent   = earned − balance
   Kaya kasama ang refund (na-cancel na lumang redemption) —
   hindi ito bilang na nagastos.
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

  return (
    <>
      <p className={styles.summary}>
        <strong>{rows.length}</strong> members · <strong>{spent.toLocaleString('en-PH')}</strong> OG
        spent in total · <strong>{left.toLocaleString('en-PH')}</strong> OG not yet spent · ranked
        by OG spent
      </p>

      <ol className={styles.people}>
        {rows.map((r, i) => {
          const { name, role } = personLabel(fullName(r), r.role_id)
          /* Medalya sa top 3 — kapag may nagastos na talaga */
          const medal = r.spent > 0 ? (['rank1', 'rank2', 'rank3'][i] ?? '') : ''
          return (
            <li key={r.profile_id} className={`${styles.person} ${styles[medal] ?? ''}`}>
              <span className={styles.num}>{i + 1}</span>
              <span className={styles.name}>{name}</span>
              <span className={styles.role}>{role}</span>
              <span className={styles.left}>{r.balance.toLocaleString('en-PH')} OG left</span>
              <span className={styles.spent}>
                <OgAmount value={r.spent} size={14} />
                <span className={styles.spentLabel}>spent</span>
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default Rewards