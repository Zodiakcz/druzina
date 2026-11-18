// Rolling: a context so any number on the sheet can roll, one toast with the result, and the
// advantage switch that applies to the next d20 roll only.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { roll, type Mode } from '@/lib/dice'
import type { RollDetail } from '@/lib/types'
import { T } from '@/lib/cs'

interface Result {
  id: number
  label: string
  formula: string
  total: number
  detail: RollDetail
}

interface RollOptions {
  /** Damage and other non-d20 rolls ignore the advantage switch and keep it for the next one. */
  d20?: boolean
  hidden?: boolean
}

interface Ctx {
  mode: Mode
  setMode: (m: Mode) => void
  rollAndLog: (label: string, formula: string, opts?: RollOptions) => Result | null
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

  const rollAndLog = useCallback(
    (label: string, formula: string, opts: RollOptions = {}) => {
      const isD20 = opts.d20 ?? /^\s*1?d20/i.test(formula)
      const r = roll(formula, isD20 ? mode : 'normal')
      if (!r) return null
      if (isD20) setMode('normal')
      const res = { id: ++seq.current, label, formula, ...r }
      setResult(res)
      if (navigator.vibrate) navigator.vibrate(30)
      onRoll({ kind: 'roll', label, formula, total: r.total, detail: r.detail, hidden: !!opts.hidden })
      return res
    },
    [mode, onRoll]
  )

  const close = useCallback(() => setResult(null), [])

  return (
    <RollerCtx.Provider value={{ mode, setMode, rollAndLog }}>
      {children}
      {result && <RollToast key={result.id} result={result} onClose={close} />}
    </RollerCtx.Provider>
  )
}

function RollToast({ result, onClose }: { result: Result; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])
  const nat = result.detail.nat
  return (
    <button
      onClick={onClose}
      className={`fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-4 rounded-2xl border px-4 py-3 text-left shadow-2xl animate-[pop_.18s_ease-out] ${
        nat === 20 ? 'border-amber-400 bg-amber-950' : nat === 1 ? 'border-red-700 bg-red-950' : 'border-zinc-600 bg-zinc-900'
      }`}
    >
      <span className={`min-w-[3ch] text-center text-4xl font-bold tabular-nums ${nat === 20 ? 'text-amber-300' : nat === 1 ? 'text-red-300' : 'text-zinc-50'}`}>
        {result.total}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-zinc-100">{result.label}</span>
        <span className="block text-xs text-zinc-400">
          <DetailText detail={result.detail} formula={result.formula} />
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
