// Rolling: a context so any number on the sheet can roll, one toast with the result, and the
// advantage switch that applies to the next d20 roll only.
//
// The result is decided at once but revealed after a short tumble: the moment before you see
// the number matters at the table. Only the reveal vibrates, writes to the shared log and runs
// `onReveal`, so nobody else sees the result before the roller does. A new roll, a tap on the
// tumbling die, or leaving the page reveals a pending roll immediately, so none is ever lost.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { combineMode, roll, poolFormula, prettyFormula, type Mode } from '@/lib/dice'
import type { RollDetail } from '@/lib/types'
import { T } from '@/lib/cs'
import { DieIcon } from './ui'

const TUMBLE_MS = 1100
const TUMBLE_MS_REDUCED = 250

/** A button the toast offers after an attack lands: roll the damage or the crit. */
export interface FollowUp {
  label: string
  formula: string
  tag: 'damage' | 'crit'
  rollLabel: string
}

interface Result {
  id: number
  label: string
  formula: string
  total: number
  detail: RollDetail
  hidden: boolean
  onReveal?: (r: Result) => void
  followUps?: FollowUp[]
  revealed: boolean
}

interface RollOptions {
  /** Damage and other non-d20 rolls ignore the advantage switch and keep it for the next one. */
  d20?: boolean
  hidden?: boolean
  /** Runs when the result is shown (HP from a hit die, death save outcome). */
  onReveal?: (r: Result) => void
  /** What the roll is for; stored in the detail so the log can tell attack, damage and crit apart. */
  tag?: RollDetail['tag']
  /** Buttons shown in the toast once the roll is revealed (damage and crit after an attack). */
  followUps?: FollowUp[]
  /** Advantage from an active effect (Rage). Combined with the switch: both directions cancel out. */
  mode?: Mode
}

interface Ctx {
  mode: Mode
  setMode: (m: Mode) => void
  rollAndLog: (label: string, formula: string, opts?: RollOptions) => boolean
}

const RollerCtx = createContext<Ctx | null>(null)

export function useRoller() {
  const ctx = useContext(RollerCtx)
  if (!ctx) throw new Error('useRoller outside RollerProvider')
  return ctx
}

export function RollerProvider({ children, onRoll }: {
  children: ReactNode
  onRoll: (r: { kind: 'roll'; label: string; formula: string; total: number; detail: RollDetail; hidden: boolean }) => void
}) {
  const [mode, setMode] = useState<Mode>('normal')
  const [result, setResult] = useState<Result | null>(null)
  const seq = useRef(0)
  const pending = useRef<Result | null>(null)
  const onRollRef = useRef(onRoll)
  onRollRef.current = onRoll

  const reveal = useCallback((r: Result) => {
    if (r.revealed) return
    r.revealed = true
    if (pending.current === r) pending.current = null
    if (navigator.vibrate) navigator.vibrate(r.detail.nat === 20 ? [40, 60, 40] : 30)
    onRollRef.current({ kind: 'roll', label: r.label, formula: r.formula, total: r.total, detail: r.detail, hidden: r.hidden })
    r.onReveal?.(r)
  }, [])

  // Leaving the page mid-tumble still logs the roll.
  useEffect(() => () => {
    if (pending.current) reveal(pending.current)
  }, [reveal])

  const rollAndLog = useCallback(
    (label: string, formula: string, opts: RollOptions = {}) => {
      const isD20 = opts.d20 ?? /^\s*1?d20/i.test(formula)
      const r = roll(formula, isD20 ? combineMode(mode, opts.mode ?? 'normal') : 'normal')
      if (!r) return false
      if (isD20) setMode('normal')
      if (pending.current) reveal(pending.current)
      const detail: RollDetail = opts.tag ? { ...r.detail, tag: opts.tag } : r.detail
      const res: Result = {
        id: ++seq.current,
        label,
        formula,
        total: r.total,
        detail,
        hidden: !!opts.hidden,
        onReveal: opts.onReveal,
        followUps: opts.followUps,
        revealed: false,
      }
      pending.current = res
      setResult(res)
      return true
    },
    [mode, reveal]
  )

  const close = useCallback(() => setResult(null), [])
  const follow = useCallback((f: FollowUp) => rollAndLog(f.rollLabel, f.formula, { d20: false, tag: f.tag }), [rollAndLog])

  return (
    <RollerCtx.Provider value={{ mode, setMode, rollAndLog }}>
      {children}
      {result && <RollToast key={result.id} result={result} onReveal={reveal} onClose={close} onFollow={follow} />}
    </RollerCtx.Provider>
  )
}

function D20Icon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <polygon points="50,26 74,66 26,66" fill="currentColor" opacity=".85" />
      <path d="M50 4 L50 26 M8 28 L26 66 M92 28 L74 66 M8 72 L26 66 M92 72 L74 66 M50 96 L50 66" stroke="currentColor" strokeWidth="4" opacity=".5" />
    </svg>
  )
}

function RollToast({ result, onReveal, onClose, onFollow }: {
  result: Result
  onReveal: (r: Result) => void
  onClose: () => void
  onFollow: (f: FollowUp) => void
}) {
  const [shown, setShown] = useState(result.revealed)
  const [face, setFace] = useState(() => result.detail.parts[0]?.die ?? 20)
  const die = result.detail.parts[0]?.die ?? 20
  const followUps = result.followUps ?? []

  const show = useCallback(() => {
    onReveal(result)
    setShown(true)
  }, [onReveal, result])

  // Tumble: random faces of the main die, then the real result.
  useEffect(() => {
    if (shown) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * die)), 70)
    const done = setTimeout(show, reduced ? TUMBLE_MS_REDUCED : TUMBLE_MS)
    return () => {
      clearInterval(spin)
      clearTimeout(done)
    }
  }, [shown, die, show])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(onClose, followUps.length ? 14000 : 6000)
    return () => clearTimeout(t)
  }, [shown, onClose, followUps.length])

  const nat = shown ? result.detail.nat : undefined
  // On a natural 20 the crit comes first and is the highlighted one.
  const ordered = nat === 20 ? [...followUps].sort((a, b) => Number(b.tag === 'crit') - Number(a.tag === 'crit')) : followUps
  return (
    <div
      onClick={shown ? onClose : show}
      aria-live="polite"
      className={`fixed inset-x-3 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md cursor-pointer rounded-2xl border px-4 py-3 text-left shadow-2xl transition-colors duration-300 animate-[pop_.18s_ease-out] ${
        nat === 20 ? 'border-amber-400 bg-amber-950' : nat === 1 ? 'border-red-700 bg-red-950' : 'border-zinc-600 bg-zinc-900'
      }`}
    >
      <div className="flex items-center gap-4">
        {shown ? (
          <span
            key="total"
            className={`min-w-[3ch] text-center text-4xl font-bold tabular-nums animate-[reveal_.35s_cubic-bezier(.2,1.6,.4,1)] ${
              nat === 20 ? 'text-amber-300' : nat === 1 ? 'text-red-300' : 'text-zinc-50'
            }`}
          >
            {result.total}
          </span>
        ) : (
          <span className="relative flex h-12 min-w-[3ch] items-center justify-center">
            <D20Icon className="absolute h-12 w-12 animate-[tumble_.55s_linear_infinite] text-amber-500/70" />
            <span className="relative text-lg font-bold tabular-nums text-zinc-100">{face}</span>
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-zinc-100">{result.label}</span>
          <span className="block text-xs text-zinc-400">
            {shown ? <DetailText detail={result.detail} formula={result.formula} /> : `${result.formula.replace(/d/gi, 'k')} …`}
          </span>
          {nat === 20 && <span className="text-xs font-semibold text-amber-300">Přirozená 20!</span>}
          {nat === 1 && <span className="text-xs font-semibold text-red-300">Přirozená 1</span>}
        </span>
      </div>
      {shown && ordered.length > 0 && (
        <div className="mt-2 flex gap-2">
          {ordered.map((f) => {
            const hot = nat === 20 && f.tag === 'crit'
            return (
              <button
                key={f.tag}
                onClick={(e) => {
                  e.stopPropagation()
                  onFollow(f)
                }}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm font-semibold ${
                  f.tag === 'crit'
                    ? hot
                      ? 'border-orange-400 bg-orange-600 text-zinc-950'
                      : 'border-orange-700 bg-orange-950/60 text-orange-200'
                    : 'border-red-700 bg-red-950/60 text-red-100'
                }`}
              >
                {f.label} {prettyFormula(f.formula)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Both d20s of an advantage roll, the kept one bold and coloured, the other struck through. */
export function DetailText({ detail, formula }: { detail: RollDetail | null; formula: string }) {
  if (!detail) return <>{formula}</>
  const adv = detail.mode === 'adv'
  const dis = detail.mode === 'dis'
  const parts = detail.parts.map((p, i) => {
    const pair = (adv || dis) && p.die === 20 && p.rolls.length === 2 && p.kept.length === 1
    return (
      <span key={i}>
        {i > 0 || p.negative ? (p.negative ? ' − ' : ' + ') : ''}
        {pair ? (
          p.rolls.map((v, j) =>
            p.kept.includes(j) ? (
              <b key={j} className={`font-bold ${adv ? 'text-emerald-400' : 'text-red-400'}`}>
                {j > 0 ? ' ' : ''}
                {v}
              </b>
            ) : (
              <span key={j} className="text-zinc-500 line-through">
                {j > 0 ? ' ' : ''}
                {v}
              </span>
            )
          )
        ) : (
          <>
            {p.rolls.length > 1 || p.kept.length !== p.rolls.length ? '[' : ''}
            {p.rolls.map((v, j) => (
              <span key={j} className={p.kept.includes(j) ? '' : 'text-zinc-600 line-through'}>
                {j > 0 ? ', ' : ''}
                {v}
              </span>
            ))}
            {p.rolls.length > 1 || p.kept.length !== p.rolls.length ? ']' : ''}
          </>
        )}
      </span>
    )
  })
  return (
    <>
      {(adv || dis) && (
        <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${adv ? 'bg-emerald-700 text-white' : 'bg-red-800 text-white'}`}>
          {(adv ? T.advantage : T.disadvantage).toLowerCase()}
        </span>
      )}
      {formula.replace(/d/gi, 'k')} → {parts}
      {detail.modifier !== 0 && ` ${detail.modifier > 0 ? '+' : '−'} ${Math.abs(detail.modifier)}`}
    </>
  )
}

/** Compact Nevýhoda / Normálně / Výhoda switch; applies to the next d20 only. */
export function AdvBar({ className = '' }: { className?: string }) {
  const { mode, setMode } = useRoller()
  return (
    <div className={`grid grid-cols-3 gap-0.5 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-xs shadow-lg ${className}`}>
      {(['dis', 'normal', 'adv'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`rounded-md px-2 py-1.5 font-semibold ${
            mode === m ? (m === 'adv' ? 'bg-emerald-700 text-white' : m === 'dis' ? 'bg-red-800 text-white' : 'bg-zinc-700 text-white') : 'text-zinc-400'
          }`}
        >
          {m === 'adv' ? T.advantage : m === 'dis' ? T.disadvantage : T.normalRoll}
        </button>
      ))}
    </div>
  )
}

const DICE = [4, 6, 8, 10, 12, 20, 100]

/** Pool builder: tap dice to add them, adjust the modifier, roll. */
export function DiceTray({ hidden, onHiddenChange, onRolled }: {
  hidden?: boolean
  onHiddenChange?: (v: boolean) => void
  onRolled?: () => void
}) {
  const { rollAndLog } = useRoller()
  const [pool, setPool] = useState<Record<number, number>>({})
  const [mod, setMod] = useState(0)
  const formula = poolFormula(pool, mod)
  const empty = !formula
  const go = () => {
    if (empty) return
    if (rollAndLog(prettyFormula(formula), formula, { hidden })) onRolled?.()
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {DICE.map((d) => (
          <button
            key={d}
            onClick={() => setPool((p) => ({ ...p, [d]: Math.min(20, (p[d] ?? 0) + 1) }))}
            className="relative rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-100 active:bg-zinc-700"
          >
            k{d}
            {pool[d] > 0 && (
              <span className="absolute -right-1 -top-1.5 min-w-[1.25rem] rounded-full bg-amber-500 px-1 text-[11px] font-bold leading-5 text-zinc-950">{pool[d]}</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800">
          <button onClick={() => setMod((m) => m - 1)} aria-label="Modifikátor −1" className="px-3.5 py-2 text-lg leading-none text-zinc-100">
            −
          </button>
          <span className="min-w-[2.5ch] text-center font-semibold tabular-nums text-zinc-100">{mod > 0 ? `+${mod}` : mod < 0 ? `−${Math.abs(mod)}` : '0'}</span>
          <button onClick={() => setMod((m) => m + 1)} aria-label="Modifikátor +1" className="px-3.5 py-2 text-lg leading-none text-zinc-100">
            +
          </button>
        </div>
        <div className="min-w-0 flex-1 truncate text-center text-base font-semibold tabular-nums text-amber-200">
          {empty ? <span className="text-zinc-600">vyber kostky</span> : prettyFormula(formula)}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            setPool({})
            setMod(0)
          }}
          disabled={empty && mod === 0}
          className="rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300 disabled:opacity-40"
        >
          {T.clearPool}
        </button>
        <button onClick={go} disabled={empty} className="flex-1 rounded-lg bg-amber-600 py-2.5 font-semibold text-zinc-950 disabled:opacity-40">
          {T.rollIt}
        </button>
      </div>
      {onHiddenChange && (
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={!!hidden} onChange={(e) => onHiddenChange(e.target.checked)} /> {T.hiddenRoll}
        </label>
      )}
    </div>
  )
}

/** Fixed bar above the bottom tab nav: advantage switch on the left, round d20 button opening the tray on the right. */
export function DiceFab() {
  const [open, setOpen] = useState(false)
  // Open, the tray sits above the result toast (z-40) so a fresh result never hides it.
  return (
    <>
      {open && <div className="fixed inset-0 z-[44] bg-black/50" onClick={() => setOpen(false)} />}
      <div className={`pointer-events-none fixed inset-x-0 bottom-[calc(44px+env(safe-area-inset-bottom))] ${open ? 'z-[45]' : 'z-30'}`}>
        <div className="mx-auto flex max-w-2xl flex-col items-end gap-2 px-3 pb-2">
          {open && (
            <div className="pointer-events-auto w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl animate-[pop_.18s_ease-out]">
              <DiceTray onRolled={() => setOpen(false)} />
            </div>
          )}
          <div className="flex w-full items-center justify-between gap-2">
            <AdvBar className="pointer-events-auto" />
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={T.diceTray}
              aria-expanded={open}
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-zinc-950 shadow-xl active:bg-amber-500"
            >
              <DieIcon className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
