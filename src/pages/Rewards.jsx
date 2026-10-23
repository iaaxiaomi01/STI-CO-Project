import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import {
  canEarnOg,
  canHandOutItems,
  canManageOgShop,
  canReleaseOg,
  claimRedemption,
  deleteShopItem,
  fetchEventRewards,
  fetchMyBalance,
  fetchMyRedemptions,
  fetchMyTransactions,
  fetchOrgBalances,
  fetchOrgRedemptions,
  fetchShopItems,
  formatOgDate,
  ogErrorMessage,
  personLabel,
  OG_REWARD_MAX,
  REDEMPTION_STATUSES,
  redemptionStatusLabel,
  releaseEventOg,
  rewardFor,
  saveShopItem,
  setEventReward,
  setShopItemActive,
} from '../lib/og.js'
import {
  computeStatus,
  eventStatusLabel,
  fetchEvents,
  formatEventDate,
  formatTime,
  nowKey,
} from '../lib/events.js'
import {
  PHASE_CLOSED,
  attendancePhase,
  attendanceWindows,
  fetchAttendanceCounts,
} from '../lib/attendance.js'
import { isOgNotification, subscribeToNotifications } from '../lib/notifications.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { OgAmount, OgGem } from '../components/OgGem.jsx'
import RedeemDialog from '../components/RedeemDialog.jsx'
import CancelRedemptionDialog from '../components/CancelRedemptionDialog.jsx'
import ShopItemForm from '../components/ShopItemForm.jsx'
import styles from './Rewards.module.css'

/* ============================================================
   REWARDS — ORGANIZATION GEMS (OG) AT REDEMPTION SHOP

   Iba-iba ang tab ayon sa role (lib/og.js para sa "can..."):

   Member  → Shop · My redemptions · OG history
   Officer → Shop · My redemptions · OG history ·
             Release OG (ibigay ang OG pagkatapos ng event) ·
             Hand out items (i-claim ang code ng member)
   Adviser → Manage shop · Event rewards (ilang OG bawat event) ·
             Hand out items · Members' OG

   Paano kumikita ng OG:
     Adviser nagtakda ng reward ng event → tapos ang event at
     sarado na ang attendance (1 oras pagkatapos ng End Time) →
     Officer pumindot ng "Release OG" →
       may Time In AT Time Out = buong reward
       Time In lang            = kalahati

   Database ang nagbabantay sa lahat (OG_REWARDS_SHOP.sql).
   ============================================================ */

const TAB_SHOP = 'shop'
const TAB_MINE = 'mine'
const TAB_HISTORY = 'history'
const TAB_RELEASE = 'release'
const TAB_CLAIMS = 'claims'
const TAB_MANAGE = 'manage'
const TAB_REWARDS = 'rewards'
const TAB_MEMBERS = 'members'

function tabsFor(profile) {
  const tabs = []
  if (canEarnOg(profile)) {
    tabs.push({ value: TAB_SHOP, label: 'Shop' })
    tabs.push({ value: TAB_MINE, label: 'My redemptions' })
    tabs.push({ value: TAB_HISTORY, label: 'OG history' })
  }
  if (canManageOgShop(profile)) {
    tabs.push({ value: TAB_MANAGE, label: 'Manage shop' })
    tabs.push({ value: TAB_REWARDS, label: 'Event rewards' })
  }
  if (canReleaseOg(profile)) tabs.push({ value: TAB_RELEASE, label: 'Release OG' })
  if (canHandOutItems(profile)) tabs.push({ value: TAB_CLAIMS, label: 'Hand out items' })
  if (canManageOgShop(profile)) tabs.push({ value: TAB_MEMBERS, label: "Members' OG" })
  return tabs
}

/* Oras ngayon sa Pilipinas — nag-a-update bawat 30 segundo */
function useNow() {
  const [now, setNow] = useState(() => nowKey())
  useEffect(() => {
    const timer = setInterval(() => setNow(nowKey()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])
  return now
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
      <>
        <PageHeader title="Rewards" />
        <EmptyState
          icon="◆"
          title="Nothing to show here"
          message="Organization Gems are for organization members, officers and advisers."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Rewards" />

      {earns && <BalanceCard balance={balance} orgName={profile?.organizations?.name} />}

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
        <ShopTab
          key={version}
          profile={profile}
          balance={balance ?? 0}
          onRedeemed={() => {
            reloadBalance()
          }}
          onOpenMine={() => setTab(TAB_MINE)}
        />
      )}
      {tab === TAB_MINE && (
        <MyRedemptionsTab key={version} profile={profile} onChanged={reloadBalance} />
      )}
      {tab === TAB_HISTORY && <HistoryTab key={version} profile={profile} balance={balance} />}
      {tab === TAB_MANAGE && <ManageShopTab profile={profile} />}
      {(tab === TAB_REWARDS || tab === TAB_RELEASE) && <EventRewardsTab profile={profile} />}
      {tab === TAB_CLAIMS && <ClaimsTab profile={profile} />}
      {tab === TAB_MEMBERS && <MembersOgTab />}
    </>
  )
}

/* ============================================================
   BALANCE CARD
   ============================================================ */
function BalanceCard({ balance, orgName }) {
  return (
    <section className={styles.balanceCard} aria-label="Your Organization Gems">
      <div className={styles.balanceGem} aria-hidden="true">
        <OgGem size={40} className={styles.balanceGemSvg} />
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
   ============================================================ */
function ShopTab({ profile, balance, onRedeemed, onOpenMine }) {
  const [items, setItems] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redeeming, setRedeeming] = useState(null)
  const [notice, setNotice] = useState('')

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

  /* Ilan na ang na-redeem mo bawat item (hindi kasama ang cancelled) */
  const myCount = useMemo(() => {
    const c = {}
    mine.forEach((r) => {
      if (r.status !== 'cancelled' && r.item_id) c[r.item_id] = (c[r.item_id] ?? 0) + 1
    })
    return c
  }, [mine])

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
    return (
      <EmptyState
        icon="◆"
        title="The shop is empty for now"
      />
    )
  }

  return (
    <>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}{' '}
          <button type="button" className={styles.linkButton} onClick={onOpenMine}>
            View my redemptions →
          </button>
        </p>
      )}

      <ul className={styles.itemGrid}>
        {items.map((item) => {
          const outOfStock = item.stock !== null && item.stock <= 0
          const used = myCount[item.id] ?? 0
          const limitReached = item.limit_per_member !== null && used >= item.limit_per_member
          const short = item.price - balance

          let label = 'Redeem'
          if (outOfStock) label = 'Out of stock'
          else if (limitReached) label = 'Limit reached'
          else if (short > 0) label = `Need ${short.toLocaleString('en-PH')} more OG`
          const disabled = outOfStock || limitReached || short > 0

          return (
            <li key={item.id} className={styles.itemCard}>
              <ItemImage item={item} />
              <div className={styles.itemBody}>
                <h2 className={styles.itemName}>{item.name}</h2>
                {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                <ItemFacts item={item} used={used} />
              </div>
              <div className={styles.itemFooter}>
                <OgAmount value={item.price} size={18} className={styles.itemPrice} />
                <button
                  type="button"
                  className={styles.redeemBtn}
                  disabled={disabled}
                  onClick={() => setRedeeming(item)}
                >
                  {label}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {redeeming && (
        <RedeemDialog
          item={redeeming}
          balance={balance}
          onCancel={() => setRedeeming(null)}
          onDone={(result) => {
            setRedeeming(null)
            setNotice(`You redeemed "${result.item_name}". Your claim code is ${result.claim_code}.`)
            onRedeemed()
            load()
          }}
        />
      )}
    </>
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

/* ============================================================
   MY REDEMPTIONS — Member at Officer
   ============================================================ */
function MyRedemptionsTab({ profile, onChanged }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(async () => {
    try {
      setList(await fetchMyRedemptions(profile.id))
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang mga redemption:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className={styles.muted}>Loading your redemptions…</p>
  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load your redemptions"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }
  if (list.length === 0) {
    return (
      <EmptyState
        icon="◆"
        title="No redemptions yet"
      />
    )
  }

  const pending = list.filter((r) => r.status === 'pending').length

  return (
    <>
      {pending > 0 && (
        <p className={styles.summary}>
          <strong>{pending}</strong> {pending === 1 ? 'item' : 'items'} waiting to be picked up.
          Show the claim code to an Officer or the Adviser.
        </p>
      )}

      <ul className={styles.list}>
        {list.map((r) => (
          <li key={r.id} className={`${styles.card} ${styles.redemption}`}>
            <div className={styles.redemptionMain}>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>{r.item_name}</h2>
                <StatusBadge status={r.status} />
              </div>
              <p className={styles.meta}>
                <OgAmount value={-r.price} signed size={14} /> · Redeemed {formatOgDate(r.created_at)}
              </p>
              <RedemptionOutcome r={r} />
            </div>

            {r.status === 'pending' && (
              <div className={styles.redemptionSide}>
                <span className={styles.codeSmallLabel}>Claim code</span>
                <span className={styles.codeSmall}>{r.claim_code}</span>
                <button
                  type="button"
                  className={styles.textDanger}
                  onClick={() => setCancelling(r)}
                >
                  Cancel & get OG back
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {cancelling && (
        <CancelRedemptionDialog
          redemption={cancelling}
          ownRedemption
          onCancel={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null)
            load()
            onChanged()
          }}
        />
      )}
    </>
  )
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
        · {formatOgDate(r.cancelled_at)} · {r.price.toLocaleString('en-PH')} OG returned
        {r.cancel_reason && <span className={styles.reason}>“{r.cancel_reason}”</span>}
      </p>
    )
  }
  return null
}

/* ============================================================
   OG HISTORY — Member at Officer
   ============================================================ */
const KIND_ICON = { event_reward: '◆', redemption: '✉', refund: '↺' }

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
        title="OG's History"
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
        {rows.map((t) => (
          <li key={t.id} className={styles.ledgerRow}>
            <span className={`${styles.ledgerIcon} ${styles[`kind_${t.kind}`] ?? ''}`} aria-hidden="true">
              {KIND_ICON[t.kind] ?? '•'}
            </span>
            <span className={styles.ledgerText}>
              <span className={styles.ledgerDesc}>{t.description}</span>
              <span className={styles.ledgerWhen}>{formatOgDate(t.created_at)}</span>
            </span>
            <OgAmount value={t.amount} signed size={14} />
          </li>
        ))}
      </ul>
    </>
  )
}

/* ============================================================
   EVENT REWARDS — Adviser (nagtatakda) at Officer (nagre-release)

   Iisang listahan, magkaibang button:
     Adviser → kahon ng OG + "Save" hangga't hindi pa na-release
     Officer → "Release OG" kapag may reward at sarado na ang
               attendance
   ============================================================ */
const REWARD_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready to release' },
  { value: 'waiting', label: 'Not yet released' },
  { value: 'released', label: 'Released' },
  { value: 'none', label: 'No reward' },
]

function rewardState(ev, reward, now) {
  if (!reward) return 'none'
  if (reward.released_at) return 'released'
  return attendancePhase(ev, now) === PHASE_CLOSED ? 'ready' : 'waiting'
}

/* "2026-10-04 11:00" → "11:00 AM" */
function clockOfKey(key) {
  return formatTime(key.slice(11))
}

function EventRewardsTab({ profile }) {
  const isAdviser = canManageOgShop(profile)
  const isOfficer = canReleaseOg(profile)
  const now = useNow()

  const [events, setEvents] = useState([])
  const [rewards, setRewards] = useState({})
  const [att, setAtt] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(isOfficer ? 'ready' : 'all')

  const load = useCallback(async () => {
    try {
      const [evs, rw, counts] = await Promise.all([
        fetchEvents(),
        fetchEventRewards(),
        fetchAttendanceCounts().catch(() => ({})),
      ])
      setEvents(evs)
      setRewards(rw)
      setAtt(counts)
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang event rewards:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const withState = useMemo(
    () =>
      events
        .map((e) => ({
          ...e,
          status: computeStatus(e, now),
          reward: rewards[e.id] ?? null,
          rewardState: rewardState(e, rewards[e.id], now),
        }))
        /* Pinakabago muna */
        .sort((a, b) =>
          `${b.event_date} ${b.start_time}`.localeCompare(`${a.event_date} ${a.start_time}`),
        ),
    [events, rewards, now],
  )

  const counts = useMemo(() => {
    const c = { all: withState.length, ready: 0, waiting: 0, released: 0, none: 0 }
    withState.forEach((e) => {
      c[e.rewardState] += 1
    })
    return c
  }, [withState])

  const visible = filter === 'all' ? withState : withState.filter((e) => e.rewardState === filter)

  if (loading) return <p className={styles.muted}>Loading events…</p>
  if (error) {
    return (
      <EmptyState
        icon="!"
        title="Could not load events"
        message="There was a problem connecting to the database. Please try again later."
      />
    )
  }
  if (events.length === 0) {
    return (
      <EmptyState
        icon="◆"
        title="No events yet"
      />
    )
  }

  return (
    <>
      <div className={styles.filters} role="tablist" aria-label="Filter events">
        {REWARD_FILTERS.map((f) => (
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

      {visible.length === 0 ? (
        <p className={styles.muted}>No events here.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((ev) => (
            <EventRewardCard
              key={ev.id}
              event={ev}
              att={att[ev.id] ?? { timedIn: 0, timedOut: 0 }}
              isAdviser={isAdviser}
              isOfficer={isOfficer}
              onChanged={load}
            />
          ))}
        </ul>
      )}
    </>
  )
}

function EventRewardCard({ event, att, isAdviser, isOfficer, onChanged }) {
  const reward = event.reward
  const released = Boolean(reward?.released_at)

  const [amount, setAmount] = useState(reward ? String(reward.amount) : '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ tone: '', text: '' })

  /* Kapag nag-reload ang listahan */
  useEffect(() => {
    setAmount(reward ? String(reward.amount) : '')
  }, [reward])

  const complete = att.timedOut
  const inOnly = Math.max(0, att.timedIn - att.timedOut)
  const estimate = reward
    ? complete * rewardFor(reward.amount, true) + inOnly * rewardFor(reward.amount, false)
    : 0

  const dirty = amount.trim() !== (reward ? String(reward.amount) : '')

  async function handleSave(e) {
    e.preventDefault()
    const s = amount.trim()
    const n = s === '' ? 0 : Number(s)
    if (!/^\d*$/.test(s) || n > OG_REWARD_MAX) {
      setMessage({ tone: 'error', text: `Enter a whole number from 0 to ${OG_REWARD_MAX}.` })
      return
    }
    setBusy(true)
    setMessage({ tone: '', text: '' })
    try {
      await setEventReward(event.id, n)
      setMessage({
        tone: 'ok',
        text: n === 0 ? 'Reward removed.' : `Saved. This event now gives ${n} OG.`,
      })
      onChanged()
    } catch (err) {
      console.error('Hindi na-save ang reward:', err)
      setMessage({ tone: 'error', text: ogErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  async function handleRelease() {
    const ok = window.confirm(
      `Release the OG of "${event.title}"?\n\n` +
        `${complete} with complete attendance × ${reward.amount} OG\n` +
        `${inOnly} with Time In only × ${rewardFor(reward.amount, false)} OG\n\n` +
        'This can only be done once.',
    )
    if (!ok) return
    setBusy(true)
    setMessage({ tone: '', text: '' })
    try {
      const r = await releaseEventOg(event.id)
      setMessage({
        tone: 'ok',
        text: `Released ${Number(r.total).toLocaleString('en-PH')} OG to ${r.recipients} ${
          r.recipients === 1 ? 'person' : 'people'
        }.`,
      })
      onChanged()
    } catch (err) {
      console.error('Hindi na-release ang OG:', err)
      setMessage({ tone: 'error', text: ogErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const w = attendanceWindows(event)

  return (
    <li className={styles.card}>
      <div className={styles.row}>
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{event.title}</h2>
            <span className={`${styles.badge} ${styles[`badge_${event.status}`] ?? ''}`}>
              {eventStatusLabel(event.status)}
            </span>
          </div>
          <p className={styles.meta}>
            {formatEventDate(event.event_date)} · {formatTime(event.start_time)} –{' '}
            {formatTime(event.end_time)}
          </p>
          {att.timedIn > 0 && (
            <p className={styles.attendMeta}>
              Complete: <strong>{complete}</strong> · Time In only: <strong>{inOnly}</strong>
              {reward && !released && (
                <>
                  {' '}
                  · about <strong>{estimate.toLocaleString('en-PH')} OG</strong> to release
                </>
              )}
            </p>
          )}
        </div>

        <div className={styles.rewardBox}>
          {reward ? (
            <>
              <OgAmount value={reward.amount} size={18} />
              <span className={styles.rewardSub}>
                half: {rewardFor(reward.amount, false)} OG
              </span>
            </>
          ) : (
            <span className={styles.rewardNone}>No reward</span>
          )}
        </div>
      </div>

      {released && (
        <p className={styles.released}>
          ✓ Released by {reward.released_by_name ?? 'an Officer'} · {formatOgDate(reward.released_at)} ·{' '}
          {reward.recipients} {reward.recipients === 1 ? 'person' : 'people'} ·{' '}
          {Number(reward.total_released).toLocaleString('en-PH')} OG
        </p>
      )}

      {/* ---------- ADVISER: itakda ang reward ---------- */}
      {isAdviser && !released && (
        <form className={styles.rewardForm} onSubmit={handleSave}>
          <label className={styles.rewardLabel}>
            OG reward
            <input
              className={styles.rewardInput}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              aria-label={`OG reward for ${event.title}`}
            />
          </label>
          <button type="submit" className={styles.smallPrimary} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <span className={styles.hintSmall}>0 or blank removes the reward. Max {OG_REWARD_MAX}.</span>
        </form>
      )}

      {/* ---------- OFFICER: i-release ---------- */}
      {isOfficer && !released && (
        <div className={styles.cardActions}>
          {event.rewardState === 'ready' && (
            <button type="button" className={styles.releaseBtn} disabled={busy} onClick={handleRelease}>
              {busy ? 'Releasing…' : '◆ Release OG'}
            </button>
          )}
          {event.rewardState === 'waiting' && (
            <span className={styles.hintSmall}>
              Release opens at {clockOfKey(w.outCloses)} on {formatEventDate(event.event_date)} (after
              Time Out closes).
            </span>
          )}
          {event.rewardState === 'none' && (
            <span className={styles.hintSmall}>Waiting for the Adviser to set a reward.</span>
          )}
        </div>
      )}

      {message.text && (
        <p className={message.tone === 'error' ? styles.panelError : styles.panelOk} role="status">
          {message.text}
        </p>
      )}
    </li>
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
          + Add item
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
              <ItemImage item={item} />
              <div className={styles.itemBody}>
                <div className={styles.titleRow}>
                  <h2 className={styles.itemName}>{item.name}</h2>
                  {!item.is_active && <span className={styles.badge}>Hidden</span>}
                </div>
                {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                <ItemFacts item={item} />
              </div>
              <div className={styles.itemFooter}>
                <OgAmount value={item.price} size={18} className={styles.itemPrice} />
              </div>
              <div className={styles.manageActions}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setEditing(item)}
                  disabled={busyId === item.id}
                >
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

  const [busyId, setBusyId] = useState(null)
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

  async function claim(c) {
    const r = await claimRedemption(c)
    setResult({
      tone: 'ok',
      text: `✓ ${r.claim_code}: give “${r.item_name}” to ${personLabel(r.redeemer_name).name}.`,
    })
    await load()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setClaiming(true)
    setResult({ tone: '', text: '' })
    try {
      await claim(code)
      setCode('')
    } catch (err) {
      console.error('Hindi na-claim:', err)
      setResult({ tone: 'error', text: ogErrorMessage(err) })
    } finally {
      setClaiming(false)
    }
  }

  async function handleClaimRow(r) {
    const { name } = personLabel(r.redeemer_name)
    if (!window.confirm(`Hand out "${r.item_name}" to ${name} (${r.claim_code})?`)) return
    setBusyId(r.id)
    setResult({ tone: '', text: '' })
    try {
      await claim(r.claim_code)
    } catch (err) {
      console.error('Hindi na-claim:', err)
      setResult({ tone: 'error', text: ogErrorMessage(err) })
    } finally {
      setBusyId(null)
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
          Ask the member for the code on their phone. You can't hand out your own item.
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
            const isMine = r.profile_id === profile.id
            return (
              <li key={r.id} className={styles.person}>
                <span className={styles.codeChip}>{r.claim_code}</span>
                <span className={styles.personMain}>
                  <span className={styles.name}>{r.item_name}</span>
                  <span className={styles.personSub}>
                    {name} · {role} · {formatOgDate(r.created_at)}
                  </span>
                  <RedemptionOutcome r={r} />
                </span>
                <OgAmount value={r.price} size={14} />
                <StatusBadge status={r.status} />
                {r.status === 'pending' && (
                  <span className={styles.personActions}>
                    <button
                      type="button"
                      className={styles.manualBtn}
                      disabled={isMine || busyId === r.id}
                      title={isMine ? 'Ask another Officer or the Adviser' : undefined}
                      onClick={() => handleClaimRow(r)}
                    >
                      {isMine ? 'Your own' : busyId === r.id ? '…' : 'Hand out'}
                    </button>
                    <button
                      type="button"
                      className={styles.textDanger}
                      disabled={busyId === r.id}
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
   ============================================================ */
function MembersOgTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    fetchOrgBalances()
      .then((data) => {
        if (active) setRows(data)
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

  const total = rows.reduce((s, r) => s + r.balance, 0)
  const earned = rows.reduce((s, r) => s + r.earned, 0)

  return (
    <>
      <p className={styles.summary}>
        <strong>{rows.length}</strong> members · <strong>{earned.toLocaleString('en-PH')}</strong> OG
        earned in total · <strong>{total.toLocaleString('en-PH')}</strong> OG not yet spent
      </p>

      <ol className={styles.people}>
        {rows.map((r, i) => {
          const { name, role } = personLabel(`${r.first_name} ${r.last_name}`, r.role_id)
          return (
            <li key={r.profile_id} className={styles.person}>
              <span className={styles.num}>{i + 1}</span>
              <span className={styles.name}>{name}</span>
              <span className={styles.role}>{role}</span>
              <span className={styles.earned}>{r.earned.toLocaleString('en-PH')} earned</span>
              <OgAmount value={r.balance} size={14} />
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default Rewards
