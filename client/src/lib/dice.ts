// Dice formulas like "1d20+5", "2d6 + 1d4 - 1", "d12+3". The client rolls; the server only logs.
import type { DiePart, RollDetail } from './types'

export type Mode = RollDetail['mode']

type Term = { kind: 'dice'; count: number; die: number; negative: boolean } | { kind: 'mod'; value: number }

const MAX_DICE = 100

export function parseFormula(formula: string): Term[] | null {
  const clean = formula.toLowerCase().replace(/\s+/g, '').replace(/k/g, 'd').replace(/−/g, '-')
  if (!clean || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(clean)) return null
  const terms: Term[] = []
  let dice = 0
  for (const m of clean.matchAll(/([+-]?)(\d*d\d+|\d+)/g)) {
    const negative = m[1] === '-'
    if (m[2].includes('d')) {
      const [c, d] = m[2].split('d')
      const count = c === '' ? 1 : Number(c)
      const die = Number(d)
      if (count < 1 || die < 2 || die > 1000) return null
      dice += count
      terms.push({ kind: 'dice', count, die, negative })
    } else {
      terms.push({ kind: 'mod', value: negative ? -Number(m[2]) : Number(m[2]) })
    }
  }
  return dice > MAX_DICE ? null : terms
}

/** Uniform 1..sides without modulo bias. */
export function rollDie(sides: number, rand: (n: number) => number = cryptoInt): number {
  return rand(sides) + 1
}

function cryptoInt(n: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / n) * n
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % n
}

/**
 * Rolls a formula. Advantage or disadvantage applies to the first single d20 term
 * (the "1d20" of an attack, check or save); other dice are unaffected.
 */
export function roll(formula: string, mode: Mode = 'normal', rand?: (n: number) => number): { total: number; detail: RollDetail } | null {
  const terms = parseFormula(formula)
  if (!terms) return null
  const parts: DiePart[] = []
  let modifier = 0
  let total = 0
  let advApplied = false
  let nat: RollDetail['nat']
  for (const t of terms) {
    if (t.kind === 'mod') {
      modifier += t.value
      continue
    }
    const sign = t.negative ? -1 : 1
    if (t.die === 20 && t.count === 1 && mode !== 'normal' && !advApplied) {
      advApplied = true
      const rolls = [rollDie(20, rand), rollDie(20, rand)]
      const pick = mode === 'adv' ? (rolls[0] >= rolls[1] ? 0 : 1) : rolls[0] <= rolls[1] ? 0 : 1
      parts.push({ die: 20, rolls, kept: [pick], negative: t.negative })
      total += sign * rolls[pick]
      if (!t.negative && (rolls[pick] === 20 || rolls[pick] === 1)) nat ??= rolls[pick] as 20 | 1
      continue
    }
    const rolls = Array.from({ length: t.count }, () => rollDie(t.die, rand))
    parts.push({ die: t.die, rolls, kept: rolls.map((_, i) => i), negative: t.negative })
    total += sign * rolls.reduce((a, b) => a + b, 0)
    if (t.die === 20 && t.count === 1 && !t.negative && (rolls[0] === 20 || rolls[0] === 1)) nat ??= rolls[0] as 20 | 1
  }
  total += modifier
  return { total, detail: { parts, modifier, mode: advApplied ? mode : 'normal', ...(nat ? { nat } : {}) } }
}

/** "1d20+5" for a d20 test with the given bonus. */
export const d20 = (bonus: number) => (bonus === 0 ? '1d20' : `1d20${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`)

/** Formula from a dice pool ({6: 2, 8: 1} and a modifier → "2d6+1d8+3"), smallest die first. */
export function poolFormula(pool: Record<number, number>, modifier = 0): string {
  const dice = Object.keys(pool)
    .map(Number)
    .filter((d) => pool[d] > 0)
    .sort((a, b) => a - b)
    .map((d) => `${pool[d]}d${d}`)
  if (!dice.length) return ''
  const mod = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `-${Math.abs(modifier)}`
  return dice.join('+') + mod
}

/** "2d6+1d8-1" shown the Czech way with spaces: "2k6 + 1k8 − 1". */
export const prettyFormula = (f: string) => f.replace(/d/gi, 'k').replace(/\+/g, ' + ').replace(/-/g, ' − ')

/** Critical hit: double the dice, not the modifier ("1d12+3" → "2d12+3"). */
export function critFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_m, c: string, d: string) => `${(c === '' ? 1 : Number(c)) * 2}d${d}`)
}

/** Advantage and disadvantage from two sources: either alone wins, both cancel out. */
export function combineMode(a: Mode, b: Mode): Mode {
  if (a === 'normal') return b
  if (b === 'normal' || a === b) return a
  return 'normal'
}

/**
 * A formula with a flat bonus and extra dice added: "1d12+3" + 2 → "1d12+5",
 * "1d20+4" + "+1d4" → "1d20+1d4+4". Dice first, the flat part folded into one number.
 */
export function addToFormula(formula: string, flat: number, dice = ''): string {
  const terms = parseFormula(formula + dice)
  if (!terms) return formula
  let modifier = flat
  let out = ''
  for (const t of terms) {
    if (t.kind === 'mod') modifier += t.value
    else out += `${t.negative ? '-' : out ? '+' : ''}${t.count}d${t.die}`
  }
  if (!out) return String(modifier)
  return modifier ? `${out}${modifier > 0 ? '+' : '-'}${Math.abs(modifier)}` : out
}
