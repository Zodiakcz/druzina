// Rolling: a context so any number on the sheet can roll, one toast with the result, and the
// advantage switch that applies to the next d20 roll only.
//
// The result is decided at once but revealed after a short tumble: the moment before you see
// the number matters at the table. Only the reveal vibrates, writes to the shared log and runs
// `onReveal`, so nobody else sees the result before the roller does. A new roll, a tap on the
// tumbling die, or leaving the page reveals a pending roll immediately, so none is ever lost.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { roll, type Mode } from '@/lib/dice'
import type { RollDetail } from '@/lib/types'
import { T } from '@/lib/cs'

const TUMBLE_MS = 1100
const TUMBLE_MS_REDUCED = 250

interface Result {
  id: number
  label: string
  formula: string
  total: number
  detail: RollDetail
  hidden: boolean
  onReveal?: (r: Result) => void
  revealed: boolean
}

interface RollOptions {
  /** Damage and other non-d20 rolls ignore the advantage switch and keep it for the next one. */
  d20?: boolean
  hidden?: boolean
  /** Runs when the result is shown (HP from a hit die, death save outcome). */
  onReveal?: (r: Result) => void
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
      const r = roll(formula, isD20 ? mode : 'normal')
      if (!r) return false
      if (isD20) setMode('normal')
      if (pending.current) reveal(pending.current)
      const res: Result = { id: ++seq.current, label, formula, ...r, hidden: !!opts.hidden, onReveal: opts.onReveal, revealed: false }
      pending.current = res
      setResult(res)
      return true
    },
    [mode, reveal]
  )

  const close = useCallback(() => setResult(null), [])

  return (
    <RollerCtx.Provider value={{ mode, setMode, rollAndLog }}>
      {children}
      {result && <RollToast key={result.id} result={result} onReveal={reveal} onClose={close} />}
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

function RollToast({ result, onReveal, onClose }: { result: Result; onReveal: (r: Result) => void; onClose: () => void }) {
  const [shown, setShown] = useState(result.revealed)
  const [face, setFace] = useState(() => result.detail.parts[0]?.die ?? 20)
  const die = result.detail.parts[0]?.die ?? 20

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
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [shown, onClose])

  const nat = shown ? result.detail.nat : undefined
  return (
    <button
      onClick={shown ? onClose : show}
      aria-live="polite"
      className={`fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-4 rounded-2xl border px-4 py-3 text-left shadow-2xl transition-colors duration-300 animate-[pop_.18s_ease-out] ${
        nat === 20 ? 'border-amber-400 bg-amber-950' : nat === 1 ? 'border-red-700 bg-red-950' : 'border-zinc-600 bg-zinc-900'
      }`}
    >
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
    </button>
  )
}

export function DetailText({ detail, formula }: { detail: RollDetail | null; formula: string }) {
  if (!detail) return <>{formula}</>
  const parts = detail.parts.map((p, i) => (
    <span key={i}>
      {i > 0 || p.negative ? (p.negative ? ' − ' : ' + ') : ''}
      {p.rolls.length > 1 || p.kept.length !== p.rolls.length ? '[' : ''}
      {p.rolls.map((v, j) => (
        <span key={j} className={p.kept.includes(j) ? '' : 'text-zinc-600 line-through'}>
          {j > 0 ? ', ' : ''}
          {v}
        </span>
      ))}
      {p.rolls.length > 1 || p.kept.length !== p.rolls.length ? ']' : ''}
    </span>
  ))
  return (
    <>
      {formula.replace(/d/gi, 'k')} → {parts}
      {detail.modifier !== 0 && ` ${detail.modifier > 0 ? '+' : '−'} ${Math.abs(detail.modifier)}`}
      {detail.mode === 'adv' && ` · ${T.advantage.toLowerCase()}`}
      {detail.mode === 'dis' && ` · ${T.disadvantage.toLowerCase()}`}
    </>
  )
}

/** The advantage switch plus a free formula field. */
export function DiceBar({ hidden, onHiddenChange }: { hidden?: boolean; onHiddenChange?: (v: boolean) => void }) {
  const { mode, setMode, rollAndLog } = useRoller()
  const [formula, setFormula] = useState('')
  const quick = [4, 6, 8, 10, 12, 20, 100]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-900 p-1 text-sm">
        {(['dis', 'normal', 'adv'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 ${mode === m ? (m === 'adv' ? 'bg-emerald-700 text-white' : m === 'dis' ? 'bg-red-800 text-white' : 'bg-zinc-700 text-white') : 'text-zinc-400'}`}
          >
            {m === 'adv' ? T.advantage : m === 'dis' ? T.disadvantage : 'Normálně'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((d) => (
          <button key={d} onClick={() => rollAndLog(`k${d}`, `1d${d}`, { hidden })} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 active:bg-zinc-700">
            k{d}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (rollAndLog(formula.trim(), formula, { hidden })) setFormula('')
        }}
      >
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="např. 2k6+3"
          inputMode="text"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
        />
        <button className="rounded-lg bg-amber-600 px-4 font-semibold text-zinc-950">Hodit</button>
      </form>
      {onHiddenChange && (
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={!!hidden} onChange={(e) => onHiddenChange(e.target.checked)} /> Skrytý hod (vidí jen PJ)
        </label>
      )}
    </div>
  )
}
