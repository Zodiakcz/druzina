// Mirror of server/src/schema.ts: change both together.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]

export const SKILLS = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight',
  'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance',
  'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival',
] as const
export type Skill = (typeof SKILLS)[number]

/** 0.5 = Jack of All Trades, 1 = proficient, 2 = expertise. */
export type SkillLevel = 0 | 0.5 | 1 | 2

export interface Attack {
  id: string
  name: string
  toHit: number | null
  damage: string
  damageType: string
  notes: string
}

export interface Spell {
  id: string
  name: string
  level: number
  prepared: boolean
  srd: string
  text: string
  nameEn?: string
  textEn?: string
}

export interface Resource {
  id: string
  name: string
  max: number
  reset: 'short' | 'long'
}

export interface Feature {
  id: string
  name: string
  source: string
  text: string
  /** English original from an import; text === textEn means it still needs translating. */
  nameEn?: string
  textEn?: string
}

export interface Sheet {
  name: string
  player: string
  species: string
  background: string
  classes: { name: string; subclass: string; level: number }[]
  portrait: string
  abilities: Record<Ability, number>
  saves: Ability[]
  skills: Partial<Record<Skill, SkillLevel>>
  ac: number
  speed: number
  hpMax: number
  initiativeBonus: number
  hitDice: { die: 6 | 8 | 10 | 12; count: number }[]
  senses: string
  proficiencies: string
  notes: string
  attacks: Attack[]
  spellcasting: {
    ability: Ability
    slots: number[]
    pact: { level: number; count: number } | null
    spells: Spell[]
  } | null
  resources: Resource[]
  features: Feature[]
}

export interface State {
  hp: number
  temp: number
  hitDiceUsed: Record<string, number>
  slotsUsed: number[]
  pactUsed: number
  resources: Record<string, number>
  conditions: string[]
  exhaustion: number
  heroic: boolean
  death: { ok: number; fail: number }
  concentration: string
  items: InventoryItem[]
  gold: number
}

export interface InventoryItem {
  id: string
  name: string
  qty: number
}

export interface Character {
  id: string
  sort: number
  ddbId: number | null
  updatedAt: string
  sheet: Sheet
  state: State
  /** Only in the GM's session. */
  key?: string
}

export interface DiePart {
  /** Die size, e.g. 20. */
  die: number
  rolls: number[]
  /** Indexes into rolls that count (advantage keeps one of two). */
  kept: number[]
  negative?: boolean
}

export interface RollDetail {
  parts: DiePart[]
  modifier: number
  mode: 'normal' | 'adv' | 'dis'
  /** Natural 20 or 1 on a kept d20. */
  nat?: 20 | 1
}

/** Before and after (HP, item count or gold) for non-dice log entries. */
export interface HpDetail {
  from: number
  to: number
}

export type LogKind = 'roll' | 'damage' | 'heal' | 'temp' | 'rest' | 'item' | 'gold'

/** One log entry: a dice roll, or an HP change / rest (amount in `total`). */
export interface Roll {
  id: string
  characterId: string | null
  who: string
  kind: LogKind
  label: string
  formula: string
  total: number
  detail: RollDetail | HpDetail | null
  hidden: boolean
  createdAt: string
}

export type Role = 'gm' | 'party' | 'player'

export interface Session {
  role: Role
  campaign: { id: string; name: string; partyKey?: string }
  meId: string | null
  characters: Character[]
  rolls: Roll[]
  hasMoreRolls: boolean
}

export function emptySheet(): Sheet {
  return {
    name: '', player: '', species: '', background: '', classes: [{ name: '', subclass: '', level: 1 }], portrait: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: [], skills: {}, ac: 10, speed: 30, hpMax: 10, initiativeBonus: 0, hitDice: [{ die: 8, count: 1 }],
    senses: '', proficiencies: '', notes: '', attacks: [], spellcasting: null, resources: [], features: [],
  }
}
