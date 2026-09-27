import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import {
  authorName,
  authorRoleLabel,
  canManageProposal,
  createProposal,
  deleteProposal,
  fetchProposals,
  formatDateTime,
  updateProposal,
  wasEdited,
} from '../lib/proposals.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProposalForm from '../components/ProposalForm.jsx'
import ProposalLetter from '../components/ProposalLetter.jsx'
import styles from './Proposals.module.css'

/* ============================================================
   PROPOSALS — TOTOONG DATA mula sa public.proposals

   Officer → gumagawa ng proposal, at nag-e-edit/nagde-delete
             ng SARILI niyang proposal
   Adviser → nakikita ang lahat ng proposal sa org niya
   Member  → wala. Wala ito sa sidebar niya, at hinaharang
             din siya ng RLS sa database.

   Ang bawat proposal ay binubuksan bilang PORMAL NA SULAT
   (components/ProposalLetter.jsx), na pwedeng i-print.

   Ang RLS sa database ang totoong nagbabantay. Ang
   can.propose at canManageProposal() dito ay para lang itago
   ang mga button na hindi mo magagamit.
   ============================================================ */
function Proposals() {
  const { role, profile } = useAuth()
  const { can } = getRoleConfig(role)

  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  /* null = sarado ang form
     'new' = bagong proposal
     { ...proposal } = ine-edit */
  const [editing, setEditing] = useState(null)

  /* Aling proposal ang bukas bilang sulat */
  const [viewing, setViewing] = useState(null)

  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    try {
      setProposals(await fetchProposals())
      setError(null)
    } catch (err) {
      console.error('Hindi makuha ang proposals:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const closeForm = useCallback(() => setEditing(null), [])
  const closeLetter = useCallback(() => setViewing(null), [])

  async function handleSubmit(values) {
    if (editing === 'new') {
      const created = await createProposal(values)
      setProposals((list) => [created, ...list])
      setNotice('Naipasa ang proposal.')
    } else {
      const updated = await updateProposal(editing.id, values)
      setProposals((list) => list.map((p) => (p.id === updated.id ? updated : p)))
      setNotice('Na-save ang pagbabago.')
    }
    setEditing(null)
  }

  async function handleDelete(proposal) {
    const ok = window.confirm(
      `Burahin ang "${proposal.title}"? Hindi na ito maibabalik.`,
    )
    if (!ok) return

    setDeletingId(proposal.id)
    setNotice('')
    try {
      await deleteProposal(proposal.id)
      setProposals((list) => list.filter((p) => p.id !== proposal.id))
      setNotice('Nabura ang proposal.')
    } catch (err) {
      console.error('Hindi nabura ang proposal:', err)
      setNotice(
        err?.message === 'not-allowed'
          ? 'Wala kang pahintulot na burahin ang proposal na ito.'
          : 'Hindi nabura. Subukan ulit.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle={
          can.propose
            ? 'Gumawa ng proposal para sa organisasyon mo.'
            : 'Mga proposal na ipinasa ng mga Officer ng organisasyon.'
        }
        action={
          can.propose && (
            <ActionButton
              onClick={() => {
                setNotice('')
                setEditing('new')
              }}
            >
              + Gumawa ng Proposal
            </ActionButton>
          )
        }
      />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {loading && <p className={styles.status}>Kinukuha ang proposals…</p>}

      {!loading && error && (
        <EmptyState
          icon="!"
          title="Hindi makuha ang proposals"
          message="May problema sa pagkonekta sa database. Subukan ulit mamaya."
        />
      )}

      {!loading && !error && proposals.length === 0 && (
        <EmptyState
          icon="✉"
          title="Wala pang proposal"
          message={
            can.propose
              ? 'Pindutin ang "+ Gumawa ng Proposal" para gumawa ng unang sulat.'
              : 'Dito lalabas ang mga proposal na ipapasa ng mga Officer ng organisasyon mo.'
          }
        />
      )}

      {!loading && !error && proposals.length > 0 && (
        <ul className={styles.list}>
          {proposals.map((p) => {
            const manageable = canManageProposal(p, profile)
            const busy = deletingId === p.id

            return (
              <li key={p.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <h2 className={styles.title}>{p.title}</h2>

                  <p className={styles.meta}>
                    Proposed to: <strong>{p.proposed_to}</strong>
                  </p>
                  <p className={styles.meta}>
                    Proposed by: <strong>{authorName(p)}</strong> ·{' '}
                    {authorRoleLabel(p)}
                  </p>

                  <p className={styles.date}>
                    {formatDateTime(p.created_at)}
                    {wasEdited(p) && <span className={styles.edited}> · na-edit</span>}
                  </p>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.openButton}
                    onClick={() => setViewing(p)}
                  >
                    Buksan ang sulat
                  </button>

                  {manageable && (
                    <>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => {
                          setNotice('')
                          setEditing(p)
                        }}
                        disabled={busy}
                      >
                        I-edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.linkButton} ${styles.danger}`}
                        onClick={() => handleDelete(p)}
                        disabled={busy}
                      >
                        {busy ? 'Binubura…' : 'Burahin'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <ProposalForm
          initial={editing === 'new' ? null : editing}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {viewing && <ProposalLetter proposal={viewing} onClose={closeLetter} />}
    </>
  )
}

export default Proposals
