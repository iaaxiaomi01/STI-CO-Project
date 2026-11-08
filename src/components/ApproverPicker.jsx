import { useId } from 'react'
import { allowsManyApprovers, stageLabel } from '../lib/proposals.js'
import styles from './ApproverPicker.module.css'

/* ============================================================
   APPROVER PICKER — bahagi ng ProposalForm
   (PROPOSAL_APPROVER_PICKER.sql)

   Bawat stage ng review, pipili ang Officer kung SINO ang approver:
     Adviser                → ISA lang (dropdown)
     SAO, School Head, SA   → ISA O HIGIT PA (checkbox list)
   Kapag marami ang napili sa isang stage, LAHAT sila ay dapat
   umaksyon bago lumipat sa susunod na stage.

     <ApproverPicker
       stages={['adviser', 'sao', 'school_head']}   ← approverStages(hasBudget)
       options={{ adviser: [{ id, name }], ... }}    ← null habang kinukuha
       value={{ adviser: ['id'], sao: ['id', 'id'], ... }}
       onChange={(stage, ids) => ...}
       lockedStages={['adviser', 'sao']}             ← sa pag-revise
       revisionFrom="sao"
       disabled={saving}
       error=""                                       ← kapag hindi makuha ang listahan
     />

   Walang sariling state — ang ProposalForm ang may hawak ng value.
   ============================================================ */
function ApproverPicker({
  stages,
  options,
  value,
  onChange,
  lockedStages = [],
  revisionFrom = null,
  disabled = false,
  error = '',
}) {
  const headingId = useId()

  return (
    <div className={styles.picker} role="group" aria-labelledby={headingId}>
      <span id={headingId} className={styles.heading}>
        Approvers
      </span>
      <p className={styles.intro}>
        Choose who reviews this proposal at each step. Only the people you choose can act on
        it. For SAO, School Head and School Administrator you can choose more than one — all of
        them must act before it moves to the next step.
      </p>

      {stages.map((stage) => (
        <StageRow
          key={stage}
          stage={stage}
          choices={options?.[stage] ?? []}
          loading={!options}
          failed={Boolean(error)}
          selected={value[stage] ?? []}
          onChange={(ids) => onChange(stage, ids)}
          locked={lockedStages.includes(stage)}
          askedForRevision={revisionFrom === stage}
          disabled={disabled}
        />
      ))}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

function StageRow({
  stage,
  choices,
  loading,
  failed,
  selected,
  onChange,
  locked,
  askedForRevision,
  disabled,
}) {
  const label = stageLabel(stage)
  const many = allowsManyApprovers(stage)
  const empty = !loading && choices.length === 0
  const inactive = disabled || loading || locked || empty

  function toggle(id, checked) {
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id))
  }

  return (
    <div className={styles.stage}>
      <div className={styles.stageHead}>
        <span className={styles.stageLabel}>{label}</span>
        <span className={styles.stageRule}>
          {many ? 'One or more' : 'Choose one'}
          {many && selected.length > 0 && ` · ${selected.length} chosen`}
        </span>
      </div>

      {many ? (
        <div className={`${styles.list} ${inactive ? styles.listInactive : ''}`}>
          {loading ? (
            <span className={styles.placeholder}>{failed ? '—' : 'Loading…'}</span>
          ) : empty ? (
            <span className={styles.placeholder}>No active {label} yet</span>
          ) : (
            choices.map((o) => (
              <label key={o.id} className={styles.option}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={(e) => toggle(o.id, e.target.checked)}
                  disabled={inactive}
                />
                <span>{o.name}</span>
              </label>
            ))
          )}
        </div>
      ) : (
        <select
          className={styles.select}
          aria-label={label}
          value={selected[0] ?? ''}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          disabled={inactive}
        >
          <option value="">
            {loading
              ? failed
                ? '—'
                : 'Loading…'
              : empty
                ? `No active ${label} yet`
                : `Choose the ${label}…`}
          </option>
          {choices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}

      {locked ? (
        <span className={styles.hint}>
          {askedForRevision
            ? `Can't be changed — ${many ? 'these' : 'this'} ${label} asked for the revision and will review it again.`
            : `Can't be changed — already reviewed by this ${label}.`}
        </span>
      ) : empty ? (
        <span className={styles.errorHint}>
          There is no active {label} account yet, so this proposal can&apos;t be submitted.
          Please contact the school.
        </span>
      ) : many && selected.length > 1 ? (
        <span className={styles.hint}>
          {selected.length === 2 ? 'Both' : `All ${selected.length}`} must act before it moves
          on.
        </span>
      ) : null}
    </div>
  )
}

export default ApproverPicker
