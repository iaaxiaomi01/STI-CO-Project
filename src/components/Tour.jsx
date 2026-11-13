import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './Tour.module.css'

/* ============================================================
   TOUR — walkthrough na may spotlight

   Dumidilim ang buong screen maliban sa itinuturo (spotlight
   na may dilaw na singsing), at may card sa tabi nito na may
   paliwanag at Back / Next.

   Walang library na kailangan. Ang mga steps ay galing sa
   config/tourSteps.js; ang MemberLayout ang nagbubukas nito.

   Paano nito hinahanap ang itinuturo:
     - document.querySelector(step.target), sinusubukan ulit
       hanggang FIND_TIMEOUT (para sa mga bagay na naglo-load pa)
     - kapag wala: optional → laktawan; kung hindi, ipapakita
       ang card sa gitna nang walang spotlight
     - card: sa kanan, ibaba, itaas o kaliwa ng target — o sa
       loob ng target kapag sobrang laki nito
     - habang bukas ang step, sinusundan ang posisyon bawat frame
       (gumagalaw ang sidebar sa phone, nag-i-scroll ang page)

   Keyboard: → Next · ← Back · Esc Skip
   ============================================================ */

const PAD = 8 // puwang ng spotlight sa paligid ng target
const GAP = 14 // layo ng card sa spotlight
const MARGIN = 12 // pinakamaliit na layo ng card sa gilid ng screen
const FIND_TIMEOUT = 1500
const FIND_INTERVAL = 60

function findTarget(selector) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  /* Nakatago (display: none) — parang wala */
  if (r.width === 0 && r.height === 0) return null
  return el
}

function sameRect(a, b) {
  if (!a || !b) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

/* Saan ilalagay ang card: sa kanan muna (sidebar), tapos sa
   ibaba, sa itaas, sa kaliwa. Kapag walang kasya, sa ibaba ng
   screen. */
function placeCard(rect, card, vw, vh) {
  if (!rect) {
    return { top: Math.max(MARGIN, (vh - card.h) / 2), left: Math.max(MARGIN, (vw - card.w) / 2) }
  }

  const box = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    right: rect.left + rect.width + PAD,
    bottom: rect.top + rect.height + PAD,
  }
  const midY = (box.top + box.bottom) / 2
  const midX = (box.left + box.right) / 2
  const fitTop = (top) => clamp(top, MARGIN, vh - card.h - MARGIN)
  const fitLeft = (left) => clamp(left, MARGIN, vw - card.w - MARGIN)

  if (box.right + GAP + card.w <= vw - MARGIN) {
    return { top: fitTop(midY - card.h / 2), left: box.right + GAP }
  }
  if (box.bottom + GAP + card.h <= vh - MARGIN) {
    return { top: box.bottom + GAP, left: fitLeft(midX - card.w / 2) }
  }
  if (box.top - GAP - card.h >= MARGIN) {
    return { top: box.top - GAP - card.h, left: fitLeft(midX - card.w / 2) }
  }
  if (box.left - GAP - card.w >= MARGIN) {
    return { top: fitTop(midY - card.h / 2), left: box.left - GAP - card.w }
  }
  /* Malaki ang target (hal. ang calendar) at walang kasya sa
     paligid: sa LOOB na lang, sa kanang ibaba ng nakikitang
     bahagi nito */
  const visibleBottom = Math.min(box.bottom, vh)
  const visibleRight = Math.min(box.right, vw)
  return {
    top: fitTop(visibleBottom - card.h - GAP),
    left: fitLeft(visibleRight - card.w - GAP),
  }
}

function Tour({ steps, onClose, onStepChange }) {
  const [index, setIndex] = useState(0)
  /* undefined = hinahanap pa · null = walang target (gitna) */
  const [rect, setRect] = useState(undefined)
  const [cardPos, setCardPos] = useState(null)
  /* Walang slide sa unang lagay ng card, para hindi ito
     dumulas mula sa kaliwang itaas */
  const [animate, setAnimate] = useState(false)
  const [viewport, setViewport] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))

  const cardRef = useRef(null)
  const nextBtnRef = useRef(null)
  const directionRef = useRef(1)
  const onStepChangeRef = useRef(onStepChange)
  onStepChangeRef.current = onStepChange

  const step = steps[index]
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  const finish = useCallback(() => onClose?.(), [onClose])

  const goNext = useCallback(() => {
    directionRef.current = 1
    if (index >= steps.length - 1) finish()
    else setIndex(index + 1)
  }, [index, steps.length, finish])

  const goBack = useCallback(() => {
    directionRef.current = -1
    if (index > 0) setIndex(index - 1)
  }, [index])

  /* Ibalik ang focus sa dating pinindot (hal. ang ? button)
     pagsara ng tour */
  useEffect(() => {
    const previous = document.activeElement
    return () => {
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true })
    }
  }, [])

  /* Hanapin ang target ng step, tapos sundan ang posisyon nito */
  useEffect(() => {
    if (!step) return undefined
    onStepChangeRef.current?.(step)

    if (!step.target) {
      setRect(null)
      return undefined
    }

    setRect(undefined)
    let cancelled = false
    let frame = 0
    let timer = 0
    const startedAt = Date.now()

    function follow(el) {
      if (cancelled) return
      if (!el.isConnected) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      const next = { top: r.top, left: r.left, width: r.width, height: r.height }
      setRect((prev) => (sameRect(prev, next) ? prev : next))
      frame = requestAnimationFrame(() => follow(el))
    }

    function look() {
      if (cancelled) return
      const el = findTarget(step.target)
      if (el) {
        el.scrollIntoView({ block: step.sidebar ? 'nearest' : 'center', inline: 'nearest', behavior: 'smooth' })
        follow(el)
        return
      }
      if (Date.now() - startedAt < FIND_TIMEOUT) {
        timer = window.setTimeout(look, FIND_INTERVAL)
        return
      }
      /* Hindi nahanap */
      if (step.optional) {
        const next = index + directionRef.current
        if (next >= 0 && next < steps.length) setIndex(next)
        else setRect(null)
      } else {
        setRect(null)
      }
    }

    look()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [step, index, steps.length])

  /* Laki ng screen — para tama ang lagay ng card */
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* Ilagay ang card bago pa ipinta ng browser (walang kislap) */
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card || rect === undefined) return
    const size = { w: card.offsetWidth, h: card.offsetHeight }
    const pos = placeCard(rect, size, viewport.w, viewport.h)
    setCardPos((prev) =>
      prev && Math.abs(prev.top - pos.top) < 0.5 && Math.abs(prev.left - pos.left) < 0.5 ? prev : pos,
    )
  }, [rect, viewport, index])

  useEffect(() => {
    if (!cardPos || animate) return undefined
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(frame)
  }, [cardPos, animate])

  /* Focus sa Next kada palit ng step (para sa keyboard) */
  useEffect(() => {
    if (rect === undefined) return
    nextBtnRef.current?.focus({ preventScroll: true })
  }, [index, rect === undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Keyboard */
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish, goNext, goBack])

  if (!step) return null

  const searching = rect === undefined
  const titleId = `tour-title-${step.id}`
  const bodyId = `tour-body-${step.id}`

  return createPortal(
    <div className={styles.root}>
      {/* Humaharang sa pag-click sa page habang may tour */}
      <div className={styles.blocker} aria-hidden="true" />

      {rect ? (
        <div
          className={styles.spotlight}
          aria-hidden="true"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className={styles.backdrop} aria-hidden="true" />
      )}

      <div
        ref={cardRef}
        className={`${styles.card} ${animate ? styles.cardAnimated : ''} ${
          searching || !cardPos ? styles.cardHidden : ''
        }`}
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <div className={styles.head}>
          <p className={styles.counter}>
            {index + 1} of {steps.length}
          </p>
          <button type="button" className={styles.skip} onClick={finish}>
            Skip tour
            <X size={14} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </div>

        <h2 id={titleId} className={styles.title}>
          {step.title}
        </h2>
        <p id={bodyId} className={styles.body}>
          {step.body}
        </p>

        <div className={styles.footer}>
          <div className={styles.progress} aria-hidden="true">
            <span
              className={styles.progressFill}
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className={styles.buttons}>
            {!isFirst && (
              <button type="button" className={styles.back} onClick={goBack}>
                Back
              </button>
            )}
            <button ref={nextBtnRef} type="button" className={styles.next} onClick={goNext}>
              {isLast ? 'Finish' : isFirst ? "Let's go" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Tour
