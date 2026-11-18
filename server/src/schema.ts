// Character JSON shapes. Mirror of client/src/lib/types.ts: change both together.
// Every field has a default so older rows still parse after a field is added.
import { z } from 'zod'
import { HttpError } from './errors'

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export const SKILLS = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight',
  'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance',
  'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival',
] as const

const ability = z.enum(ABILITIES)
const text = (max: number) => z.string().max(max).default('')
const int = (min: number, max: number) => z.number().int().min(min).max(max)
const id = z.string().min(1).max(40)

export const sheetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  player: text(80),
  species: text(80),
  background: text(80),
  classes: z.array(z.object({ name: z.string().max(40), subclass: text(60), level: int(0, 20) })).max(4).default([]),
  portrait: text(500),
  abilities: z.object(Object.fromEntries(ABILITIES.map((a) => [a, int(1, 30)])) as Record<(typeof ABILITIES)[number], z.ZodNumber>),
  saves: z.array(ability).default([]),
  /** 0.5 = Jack of All Trades, 1 = proficient, 2 = expertise. Missing = 0. */
  skills: z.partialRecord(z.enum(SKILLS), z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(2)])).default({}),
  ac: int(0, 40),
  speed: int(0, 200).default(30),
  hpMax: int(0, 999),
  initiativeBonus: int(-10, 20).default(0),
  hitDice: z.array(z.object({ die: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]), count: int(0, 20) })).max(4).default([]),
  senses: text(200),
  proficiencies: text(2000),
  notes: text(10000),
  attacks: z.array(z.object({
    id,
    name: z.string().max(80),
    /** null = no attack roll (e.g. a save-based spell). */
    toHit: int(-10, 30).nullable(),
    damage: text(40),
    damageType: text(40),
    notes: text(300),
  })).max(30).default([]),
  spellcasting: z.object({
    ability,
    /** Slots per spell level 1..9. */
    slots: z.array(int(0, 9)).length(9),
    pact: z.object({ level: int(1, 5), count: int(0, 4) }).nullable().default(null),
    spells: z.array(z.object({
      id,
      name: z.string().max(80),
      level: int(0, 9),
      prepared: z.boolean().default(true),
      /** Open5e key when the spell is in the SRD, for the Czech/English text lookup. */
      srd: text(80),
      text: text(8000),
      /** English original from an import, so a re-import can tell whether the text changed. */
      nameEn: text(80),
      textEn: text(8000),
    })).max(150).default([]),
  }).nullable().default(null),
  resources: z.array(z.object({
    id,
    name: z.string().max(60),
    max: int(0, 99),
    reset: z.enum(['short', 'long']),
  })).max(20).default([]),
  features: z.array(z.object({
    id,
    name: z.string().max(120),
    source: text(80),
    text: text(12000),
    /** English original from an import; text === textEn means it still needs translating. */
    nameEn: text(120),
    textEn: text(12000),
  })).max(120).default([]),
})

export const stateSchema = z.object({
  hp: int(-999, 999),
  temp: int(0, 999).default(0),
  /** Used hit dice per die size, keyed "8", "10", ... */
  hitDiceUsed: z.record(z.string(), int(0, 20)).default({}),
  slotsUsed: z.array(int(0, 9)).length(9).default([0, 0, 0, 0, 0, 0, 0, 0, 0]),
  pactUsed: int(0, 4).default(0),
  /** Used uses per resource id. */
  resources: z.record(z.string(), int(0, 99)).default({}),
  conditions: z.array(z.string().max(30)).max(20).default([]),
  exhaustion: int(0, 6).default(0),
  heroic: z.boolean().default(false),
  death: z.object({ ok: int(0, 3), fail: int(0, 3) }).default({ ok: 0, fail: 0 }),
  concentration: text(80),
  /** Inventory: free-text items with a count. Changes go to the public log. */
  items: z.array(z.object({ id, name: z.string().trim().min(1).max(80), qty: int(1, 9999) })).max(300).default([]),
  /** Gold pieces (zl). Other coins, if any, are items ("Stříbrňáky"). */
  gold: int(0, 10_000_000).default(0),
})

export const statePatchSchema = stateSchema.partial()

/**
 * A state patch with only the keys the client sent. zod 4 applies defaults even inside
 * .partial(), so parsing {gold: 25} alone would also "patch" items, conditions, resources...
 * back to their empty defaults and wipe them.
 */
export function parseStatePatch(body: unknown): Partial<State> {
  const res = statePatchSchema.safeParse(body)
  if (!res.success) {
    const issue = res.error.issues[0]
    throw new HttpError(400, `Neplatná data: ${issue.path.join('.')} ${issue.message}`)
  }
  const sent = body && typeof body === 'object' ? Object.keys(body) : []
  return Object.fromEntries(Object.entries(res.data).filter(([k]) => sent.includes(k))) as Partial<State>
}

export type Sheet = z.infer<typeof sheetSchema>
export type State = z.infer<typeof stateSchema>

export function initialState(sheet: Sheet): State {
  return stateSchema.parse({ hp: sheet.hpMax })
}

export const LOG_KINDS = ['roll', 'damage', 'heal', 'temp', 'rest', 'item', 'gold'] as const

export const rollSchema = z.object({
  characterId: z.string().max(40).nullable().default(null),
  kind: z.enum(LOG_KINDS).default('roll'),
  label: z.string().max(80),
  formula: z.string().max(60).default(''),
  total: int(-10_000_000, 10_000_000),
  detail: z.unknown(),
  hidden: z.boolean().default(false),
})
