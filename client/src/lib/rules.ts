// Numbers derived from the sheet. Never stored: compute them where they are shown.
import type { Ability, Sheet, Skill, State } from './types'

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  sleightOfHand: 'dex', stealth: 'dex', survival: 'wis',
}

export const mod = (score: number) => Math.floor((score - 10) / 2)

export const totalLevel = (s: Sheet) => s.classes.reduce((n, c) => n + c.level, 0)

export const profBonus = (s: Sheet) => 2 + Math.floor((Math.max(totalLevel(s), 1) - 1) / 4)

export const abilityMod = (s: Sheet, a: Ability) => mod(s.abilities[a])

export const saveBonus = (s: Sheet, a: Ability) => abilityMod(s, a) + (s.saves.includes(a) ? profBonus(s) : 0)

export function skillBonus(s: Sheet, k: Skill): number {
  const level = s.skills[k] ?? 0
  return abilityMod(s, SKILL_ABILITY[k]) + Math.floor(level * profBonus(s))
}

/** Passives are not d20 tests, so exhaustion does not touch them (2024). */
export const passive = (s: Sheet, k: Skill) => 10 + skillBonus(s, k)

export const initiative = (s: Sheet) => abilityMod(s, 'dex') + s.initiativeBonus

/** 2024 exhaustion: −2 per level to every d20 test (attacks, checks, saves, initiative). */
export const d20Penalty = (st: State) => -2 * st.exhaustion

export const effectiveSpeed = (s: Sheet, st: State) => Math.max(0, s.speed - 5 * st.exhaustion)

export function spellDc(s: Sheet): number | null {
  return s.spellcasting ? 8 + profBonus(s) + abilityMod(s, s.spellcasting.ability) : null
}

export function spellAttack(s: Sheet): number | null {
  return s.spellcasting ? profBonus(s) + abilityMod(s, s.spellcasting.ability) : null
}

export function classLine(s: Sheet): string {
  return s.classes
    .filter((c) => c.name)
    .map((c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`)
    .join(' / ')
}

/** Damage eats temporary HP first. HP never goes below 0. */
export function applyDamage(st: State, amount: number): Pick<State, 'hp' | 'temp'> {
  const fromTemp = Math.min(st.temp, amount)
  return { temp: st.temp - fromTemp, hp: Math.max(0, st.hp - (amount - fromTemp)) }
}

export function applyHealing(s: Sheet, st: State, amount: number): Partial<State> {
  const hp = Math.min(s.hpMax, Math.max(0, st.hp) + amount)
  // Any healing at 0 HP ends the dying state.
  return st.hp <= 0 && hp > 0 ? { hp, death: { ok: 0, fail: 0 } } : { hp }
}

/** Hit dice spent together: "2d8+1d10+6", the Con modifier once per die. */
export function hitDiceFormula(dice: { die: number; count: number }[], conMod: number): string {
  const n = dice.reduce((a, h) => a + h.count, 0)
  const bonus = n * conMod
  return dice.map((h) => `${h.count}d${h.die}`).join('+') + (bonus ? `${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}` : '')
}

export function shortRest(s: Sheet, st: State): Partial<State> {
  const resources = { ...st.resources }
  for (const r of s.resources) if (r.reset === 'short') resources[r.id] = 0
  return { resources, pactUsed: 0, active: [] }
}

/** 2024 long rest: full HP, all hit dice back, all slots, one level of exhaustion off. */
export function longRest(s: Sheet, st: State): Partial<State> {
  return {
    hp: s.hpMax,
    temp: 0,
    hitDiceUsed: {},
    slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactUsed: 0,
    resources: {},
    exhaustion: Math.max(0, st.exhaustion - 1),
    death: { ok: 0, fail: 0 },
    concentration: '',
    active: [],
  }
}
