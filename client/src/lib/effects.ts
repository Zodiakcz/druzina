// Switchable effects (Rage, Reckless Attack, Bless): what is on, and what it adds to a roll.
// Deliberately small: a bonus, advantage, a resistance reminder. No durations, no rounds; the
// player switches an effect off, a rest clears it.
import type { Ability, Effect, EffectMod, EffectOn, Sheet, State } from './types'
import { parseFormula, type Mode } from './dice.ts'
import { ABILITY } from './cs.ts'

export const activeEffects = (s: Sheet, st: State): Effect[] =>
  (s.effects ?? []).filter((e) => (st.active ?? []).includes(e.id))

/** What the active effects add to one kind of roll or number. */
export interface Boost {
  /** Flat bonus. */
  flat: number
  /** Extra dice as a formula tail, "+1d4". */
  dice: string
  mode: Mode
  /** Effects that changed something, for the label and the log. */
  names: string[]
}

export function boost(s: Sheet, st: State, on: EffectOn, ability?: Ability | ''): Boost {
  let flat = 0
  let dice = ''
  let adv = false
  let dis = false
  const names = new Set<string>()
  for (const e of activeEffects(s, st)) {
    for (const m of modsOf(s, e)) {
      if (m.on !== on || (m.ability && m.ability !== ability)) continue
      let used = false
      for (const t of parseFormula(m.bonus) ?? []) {
        if (t.kind === 'mod') {
          flat += t.value
          used ||= t.value !== 0
        } else {
          dice += `${t.negative ? '-' : '+'}${t.count}d${t.die}`
          used = true
        }
      }
      if (m.mode === 'adv') adv = used = true
      if (m.mode === 'dis') dis = used = true
      if (used) names.add(e.name)
    }
  }
  return { flat, dice, mode: adv && dis ? 'normal' : adv ? 'adv' : dis ? 'dis' : 'normal', names: [...names] }
}

/** "Sekera: útok" → "Sekera: útok (Zuřivost)" when an effect changed the roll. */
export const labelWith = (label: string, b: Boost) => (b.names.length ? `${label} (${b.names.join(', ')})`.slice(0, 80) : label)

/**
 * Switching an effect on spends a use of its resource (when one is left) and, for Rage,
 * ends concentration. Switching it off only switches it off.
 */
export function toggleEffect(s: Sheet, st: State, id: string): Partial<State> {
  const active = st.active ?? []
  if (active.includes(id)) return { active: active.filter((x) => x !== id) }
  const e = s.effects.find((x) => x.id === id)
  if (!e) return {}
  const patch: Partial<State> = { active: [...active, id] }
  const r = s.resources.find((x) => x.id === e.resourceId)
  const used = r ? st.resources[r.id] ?? 0 : 0
  if (r && used < r.max) patch.resources = { ...st.resources, [r.id]: used + 1 }
  if (e.noSpells && st.concentration) patch.concentration = ''
  return patch
}

/** A resource pip was tapped: spending a use also switches on the effect it feeds. */
export function spendResource(s: Sheet, st: State, resourceId: string, used: number): Partial<State> {
  const patch: Partial<State> = { resources: { ...st.resources, [resourceId]: used } }
  if (used <= (st.resources[resourceId] ?? 0)) return patch
  const e = (s.effects ?? []).find((x) => x.resourceId === resourceId && !(st.active ?? []).includes(x.id))
  if (!e) return patch
  patch.active = [...(st.active ?? []), e.id]
  if (e.noSpells && st.concentration) patch.concentration = ''
  return patch
}

/** Rage damage by barbarian level (2014 and 2024 agree). */
export function rageDamage(s: Sheet): number {
  const lvl = s.classes.filter((c) => /barbar/i.test(c.name)).reduce((n, c) => n + c.level, 0)
  return lvl >= 16 ? 4 : lvl >= 9 ? 3 : 2
}

type Draft = Omit<Effect, 'id' | 'resourceId' | 'preset'>

/**
 * Ready-made effects. `match` finds the feature, spell or resource each one belongs to.
 * `scale` gives the bonus of a modifier that grows with level, computed from the sheet on use.
 */
export const PRESETS: { key: string; match: RegExp; make: (s: Sheet) => Draft; scale?: (s: Sheet, m: EffectMod) => string | undefined }[] = [
  {
    key: 'rage',
    match: /^(rage|zuřivost)$/i,
    scale: (s, m) => (m.on === 'damage' ? String(rageDamage(s)) : undefined),
    make: (s) => ({
      name: 'Zuřivost',
      mods: [
        { on: 'damage', ability: 'str', bonus: String(rageDamage(s)), mode: 'normal' },
        { on: 'check', ability: 'str', bonus: '', mode: 'adv' },
        { on: 'save', ability: 'str', bonus: '', mode: 'adv' },
      ],
      resist: 'drtivé, bodné, sečné',
      noSpells: true,
      text: 'Skončí, když tvůj tah skončí bez útoku a bez utrženého zranění.',
    }),
  },
  {
    key: 'reckless',
    match: /^(reckless attack|bezohledný útok)$/i,
    make: () => ({
      name: 'Bezohledný útok',
      mods: [{ on: 'attack', ability: 'str', bonus: '', mode: 'adv' }],
      resist: '',
      noSpells: false,
      text: 'Útoky proti tobě mají výhodu až do začátku tvého dalšího tahu.',
    }),
  },
  {
    key: 'bless',
    match: /^(bless|požehnání)$/i,
    make: () => ({
      name: 'Požehnání',
      mods: [
        { on: 'attack', ability: '', bonus: '1d4', mode: 'normal' },
        { on: 'save', ability: '', bonus: '1d4', mode: 'normal' },
      ],
      resist: '',
      noSpells: false,
      text: 'Vypni, až kouzlo skončí (sesilatel ztratí soustředění, nejvýš 1 minuta).',
    }),
  },
  {
    key: 'huntersMark',
    match: /^(hunter's mark|lovcovo znamení)$/i,
    make: () => ({
      name: 'Lovcovo znamení',
      mods: [{ on: 'damage', ability: '', bonus: '1d6', mode: 'normal' }],
      resist: '',
      noSpells: false,
      text: 'Jen zásahy proti označenému cíli.',
    }),
  },
  {
    key: 'dodge',
    match: /^(dodge|uhýbání)$/i,
    make: () => ({
      name: 'Uhýbání',
      mods: [{ on: 'save', ability: 'dex', bonus: '', mode: 'adv' }],
      resist: '',
      noSpells: false,
      text: 'Útoky proti tobě mají nevýhodu, pokud útočníka vidíš. Do začátku tvého dalšího tahu.',
    }),
  },
]

/** Builds a preset effect, linked to the matching resource when the sheet has one. */
export function fromPreset(s: Sheet, key: string, id: string): Effect | null {
  const p = PRESETS.find((x) => x.key === key)
  if (!p) return null
  const r = s.resources.find((x) => p.match.test(x.name) || p.match.test(x.nameEn ?? ''))
  return { id, resourceId: r?.id ?? '', preset: key, ...p.make(s) }
}

/** The modifiers as they apply now: a preset's level-based numbers follow the sheet. */
export function modsOf(s: Sheet, e: Effect): EffectMod[] {
  const p = e.preset ? PRESETS.find((x) => x.key === e.preset) : undefined
  if (!p?.scale) return e.mods
  return e.mods.map((m) => {
    const bonus = p.scale!(s, m)
    return bonus === undefined ? m : { ...m, bonus }
  })
}

const EFFECT_ON_CS = { attack: 'útok', damage: 'zranění', check: 'ověření', save: 'ZH', ac: 'TZ', speed: 'rychlost' } as const

/** "zranění SIL +2 · ověření SIL výhoda · odolnost: drtivé, bodné, sečné" */
export function describeEffect(s: Sheet, e: Effect): string {
  const mods = modsOf(s, e).map((m) =>
    [
      EFFECT_ON_CS[m.on],
      m.ability ? ABILITY[m.ability].short : '',
      m.bonus ? (/^[-−]/.test(m.bonus) ? m.bonus : `+${m.bonus}`).replace(/d/g, 'k') : '',
      m.mode === 'adv' ? 'výhoda' : m.mode === 'dis' ? 'nevýhoda' : '',
    ]
      .filter(Boolean)
      .join(' ')
  )
  return [...mods, e.resist && `odolnost: ${e.resist}`, e.noSpells && 'bez kouzel a soustředění'].filter(Boolean).join(' · ')
}

/** Presets that the sheet's features, spells or resources point to and that are not on it yet. */
export function suggestedPresets(s: Sheet): string[] {
  const names = [
    ...s.features.flatMap((f) => [f.name, f.nameEn ?? '']),
    ...(s.spellcasting?.spells ?? []).flatMap((x) => [x.name, x.nameEn ?? '']),
    ...s.resources.flatMap((r) => [r.name, r.nameEn ?? '']),
  ].map((n) => n.trim())
  return PRESETS.filter((p) => names.some((n) => p.match.test(n)))
    .filter((p) => !(s.effects ?? []).some((e) => e.name === p.make(s).name))
    .map((p) => p.key)
}
