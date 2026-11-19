// D&D Beyond import: fetches a public character's JSON and maps it onto our sheet + state.
// D&D Beyond computes most numbers in the browser, so we recompute them from the raw data:
// ability scores from base + modifiers, AC from equipped armor or the unarmored formula, HP from
// base + Con per level, attacks from equipped weapons. Whatever cannot be derived goes into
// `warnings` and the GM checks it in the editor before saving.
//
// Feature and spell texts are taken from D&D Beyond as they are (they match the character's
// actual rules version, 2014 or 2024) and kept in nameEn/textEn; SRD spells get the Czech name
// and text lookup through their SRD key. Non-SRD text lives only in the campaign database.

import fs from 'fs'
import path from 'path'
import { HttpError } from './lib'
import { sheetSchema, stateSchema, type Sheet, type State, ABILITIES, SKILLS } from './schema'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

const ABILITY_BY_ID: Record<number, (typeof ABILITIES)[number]> = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' }
const ABILITY_SLUG: Record<string, (typeof ABILITIES)[number]> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}
const SKILL_BY_SLUG: Record<string, (typeof SKILLS)[number]> = Object.fromEntries(
  SKILLS.map((k) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), k])
) as Record<string, (typeof SKILLS)[number]>

// D&D Beyond condition ids, alphabetical as in the rules. 4 is exhaustion (a level, not a flag).
const CONDITION_BY_ID: Record<number, string> = {
  1: 'blinded', 2: 'charmed', 3: 'deafened', 5: 'frightened', 6: 'grappled', 7: 'incapacitated', 8: 'invisible',
  9: 'paralyzed', 10: 'petrified', 11: 'poisoned', 12: 'prone', 13: 'restrained', 14: 'stunned', 15: 'unconscious',
}

// Czech labels for the names that show on the sheet header and in notes. See docs/slovnik.md.
const CS: Record<string, string> = {
  // classes
  Barbarian: 'Barbar', Bard: 'Bard', Cleric: 'Klerik', Druid: 'Druid', Fighter: 'Bojovník', Monk: 'Mnich', Paladin: 'Paladin',
  Ranger: 'Hraničář', Rogue: 'Tulák', Sorcerer: 'Čaroděj', Warlock: 'Černokněžník', Wizard: 'Kouzelník',
  // subclasses: SRD ones plus the ones this group plays
  'Path of the Berserker': 'Stezka berserkera', 'Path of the Zealot': 'Stezka horlivce', 'College of Lore': 'Kolej vědění',
  'Life Domain': 'Doména života', 'Light Domain': 'Doména světla', 'Circle of the Land': 'Kruh krajiny', Champion: 'Šampion',
  'Rune Knight': 'Runový rytíř', 'Way of the Open Hand': 'Cesta otevřené dlaně', 'Warrior of the Open Hand': 'Válečník otevřené dlaně',
  'Oath of Devotion': 'Přísaha oddanosti', Hunter: 'Lovec', Thief: 'Zloděj', 'Draconic Bloodline': 'Dračí pokrevní linie',
  'Draconic Sorcery': 'Dračí čarodějnictví', 'The Fiend': 'Běs', 'Fiend Patron': 'Ďábelský patron', 'School of Evocation': 'Škola zaklínání',
  Evoker: 'Zaklínač',
  // species
  Dragonborn: 'Drakorozený', Dwarf: 'Trpaslík', 'Hill Dwarf': 'Kopcový trpaslík', 'Mountain Dwarf': 'Horský trpaslík', Elf: 'Elf',
  'High Elf': 'Vznešený elf', 'Wood Elf': 'Lesní elf', Gnome: 'Gnóm', 'Rock Gnome': 'Skalní gnóm', 'Forest Gnome': 'Lesní gnóm',
  Goliath: 'Goliáš', Halfling: 'Půlčík', 'Lightfoot Halfling': 'Lehkonohý půlčík', 'Stout Halfling': 'Statný půlčík', Human: 'Člověk',
  Orc: 'Ork', Tiefling: 'Tiefling', 'Half-Elf': 'Půlelf', 'Half-Orc': 'Půlork',
  // backgrounds
  Acolyte: 'Akolyta', Criminal: 'Zločinec', Sage: 'Učenec', Soldier: 'Voják', 'Folk Hero': 'Lidový hrdina', Noble: 'Šlechtic',
  Entertainer: 'Bavič', Hermit: 'Poustevník', Outlander: 'Poutník', Sailor: 'Námořník', Urchin: 'Uličník', Charlatan: 'Šarlatán',
  'Guild Artisan': 'Cechovní řemeslník', Farmer: 'Rolník', Guard: 'Strážný', Guide: 'Průvodce', Merchant: 'Obchodník', Scribe: 'Písař',
  Wayfarer: 'Tulák po cestách', Artisan: 'Řemeslník',
  // proficiencies and languages
  'Light Armor': 'lehká zbroj', 'Medium Armor': 'střední zbroj', 'Heavy Armor': 'těžká zbroj', Shields: 'štíty',
  'Simple Weapons': 'jednoduché zbraně', 'Martial Weapons': 'válečné zbraně', Common: 'obecná řeč', Orc_lang: 'orkština',
  Elvish: 'elfština', Dwarvish: 'trpasličtina', Gnomish: 'gnómština', Halfling_lang: 'půlčičtina', Draconic: 'dračí jazyk',
  Giant: 'obrština', Goblin: 'goblinština', Infernal: 'pekelný jazyk', Celestial: 'nebeský jazyk', Sylvan: 'sylvánština',
  Undercommon: 'podobecná řeč', Abyssal: 'propastný jazyk', Primordial: 'prvotní jazyk', 'Deep Speech': 'řeč hlubin',
  "Thieves' Cant": 'zlodějská hantýrka', Druidic: 'druidština', 'Common Sign Language': 'obecná znaková řeč',
  // weapon properties and mastery
  Ammunition: 'střelivo', Finesse: 'finesa', Heavy: 'těžká', Light: 'lehká', Loading: 'nabíjení', Reach: 'dosah', Thrown: 'vrhací',
  'Two-Handed': 'obouruční', Versatile: 'univerzální', Range: 'dostřel',
  Cleave: 'rozetnutí', Graze: 'škrábnutí', Nick: 'rychlý zásah', Push: 'odhození', Sap: 'oslabení', Slow: 'zpomalení', Topple: 'povalení', Vex: 'rozhození',
  // weapons
  Battleaxe: 'Bitevní sekera', Blowgun: 'Foukačka', Club: 'Kyj', 'Hand Crossbow': 'Ruční kuše', 'Heavy Crossbow': 'Těžká kuše',
  'Light Crossbow': 'Lehká kuše', 'Crossbow, Hand': 'Ruční kuše', 'Crossbow, Heavy': 'Těžká kuše', 'Crossbow, Light': 'Lehká kuše',
  Dagger: 'Dýka', Dart: 'Šipka', Flail: 'Řemdih', Glaive: 'Glévie', Greataxe: 'Obouruční sekera', Greatclub: 'Velký kyj',
  Greatsword: 'Obouruční meč', Halberd: 'Halapartna', Handaxe: 'Sekerka', Javelin: 'Oštěp', Lance: 'Dřevec', 'Light Hammer': 'Lehké kladivo',
  Longbow: 'Dlouhý luk', Longsword: 'Dlouhý meč', Mace: 'Palcát', Maul: 'Těžké kladivo', Morningstar: 'Morgenštern', Musket: 'Mušketa',
  Net: 'Síť', Pike: 'Píka', Pistol: 'Pistole', Quarterstaff: 'Hůl', Rapier: 'Rapír', Scimitar: 'Šavle', Shortbow: 'Krátký luk',
  Shortsword: 'Krátký meč', Sickle: 'Srp', Sling: 'Prak', Spear: 'Kopí', Trident: 'Trojzubec', 'War Pick': 'Válečný krumpáč',
  Warhammer: 'Válečné kladivo', Whip: 'Bič',
  // adventuring gear and armor (common items; anything else keeps its D&D Beyond name)
  Backpack: 'Batoh', Bedroll: 'Spací rohož', Chest: 'Truhla', 'Clothes, Common': 'Obyčejné oblečení',
  "Clothes, Traveler's": 'Cestovní oblečení', 'Clothes, Fine': 'Zdobné oblečení', 'Mess Kit': 'Jídelní souprava',
  'Rations (1 day)': 'Příděl jídla (1 den)', Rations: 'Příděl jídla', 'Rope, Hempen (50 feet)': 'Konopné lano (50 stop)',
  'Rope, Silk (50 feet)': 'Hedvábné lano (50 stop)', Rope: 'Lano', Tinderbox: 'Křesadlo', Torch: 'Pochodeň', Waterskin: 'Měch na vodu',
  Crowbar: 'Páčidlo', Hammer: 'Kladivo', 'Holy Water (flask)': 'Svěcená voda (lahvička)', Manacles: 'Pouta',
  'Mirror, Steel': 'Ocelové zrcátko', 'Oil (flask)': 'Olej (lahvička)', 'Stake (Wooden)': 'Dřevěný kolík', Piton: 'Skoba',
  'Holy Symbol': 'Svatý symbol', 'Alchemical Supplies': 'Alchymistické potřeby', Candle: 'Svíčka', Chalk: 'Křída', Bell: 'Zvonek',
  'Lantern, Hooded': 'Lucerna s clonou', 'Lantern, Bullseye': 'Směrová lucerna', Lamp: 'Lampa', Pouch: 'Váček', Sack: 'Pytel',
  Quiver: 'Toulec', 'Component Pouch': 'Váček na složky', Spellbook: 'Kniha kouzel', Book: 'Kniha', Parchment: 'Pergamen',
  'Ink (1-ounce bottle)': 'Inkoust (lahvička)', 'Ink Pen': 'Pero', 'Potion of Healing': 'Lektvar léčení', Arrows: 'Šípy',
  'Crossbow Bolts': 'Šipky do kuše', 'Sling Bullets': 'Kuličky do praku', Blanket: 'Přikrývka', 'Signal Whistle': 'Píšťalka',
  "Explorer's Pack": 'Výbava průzkumníka', "Dungeoneer's Pack": 'Výbava jeskyňáře', "Priest's Pack": 'Výbava kněze',
  "Scholar's Pack": 'Výbava učence', "Burglar's Pack": 'Výbava lupiče', "Diplomat's Pack": 'Výbava diplomata',
  "Entertainer's Pack": 'Výbava baviče', Shield: 'Štít', 'Leather Armor': 'Kožená zbroj', 'Padded Armor': 'Prošívaná zbroj',
  'Studded Leather Armor': 'Pobíjená kožená zbroj', 'Hide Armor': 'Kožešinová zbroj', 'Chain Shirt': 'Kroužková košile',
  'Scale Mail': 'Šupinová zbroj', Breastplate: 'Kyrys', 'Half Plate Armor': 'Polovičná plátová zbroj', 'Ring Mail': 'Kroužkovaná zbroj',
  'Chain Mail': 'Kroužková zbroj', 'Splint Armor': 'Pásová zbroj', 'Plate Armor': 'Plátová zbroj',
  // limited-use resources
  Rage: 'Zuřivost', 'Relentless Endurance': 'Neúprosná výdrž', 'Bardic Inspiration': 'Bardská inspirace',
  'Channel Divinity': 'Usměrnění božské moci', 'Second Wind': 'Druhý dech', 'Action Surge': 'Příval akce', 'Ki Points': 'Body ki',
  "Monk's Focus": 'Mnišské zaměření', 'Focus Points': 'Body zaměření', 'Wild Shape': 'Divoká podoba', 'Lay on Hands': 'Vkládání rukou',
  'Lay On Hands: Healing Pool': 'Vkládání rukou', 'Sorcery Points': 'Body čarodějnictví', 'Font of Magic': 'Zdroj magie',
  'Arcane Recovery': 'Tajemná obnova', 'Divine Sense': 'Božský smysl', 'Breath Weapon': 'Dechová zbraň', 'Healing Hands': 'Léčivé ruce',
  'Hellish Resistance': 'Pekelná odolnost', 'Fey Step': 'Vílí krok', 'Giant’s Might': 'Obří síla', "Giant's Might": 'Obří síla',
  'Rune Carver': 'Řezbář run', 'Warding Flare': 'Ochranný záblesk', 'Radiance of the Dawn': 'Záře úsvitu',
  'Second Wind ': 'Druhý dech', 'Indomitable': 'Nezdolnost', 'Tactical Mind': 'Taktická mysl', 'Divine Intervention': 'Božský zásah',
  // tools
  'Dice Set': 'hrací kostky', 'Playing Card Set': 'hrací karty', 'Vehicles (Land)': 'pozemní vozidla', 'Vehicles (Water)': 'vodní plavidla',
  "Thieves' Tools": 'zlodějské náčiní', "Herbalism Kit": 'bylinkářská souprava', "Disguise Kit": 'maskovací souprava',
  "Forgery Kit": 'padělatelská souprava', "Healer's Kit": 'léčitelská brašna', "Smith's Tools": 'kovářské nářadí',
  // damage types
  Acid: 'kyselinové', Bludgeoning: 'drtivé', Cold: 'chladné', Fire: 'ohnivé', Force: 'silové', Lightning: 'bleskové', Necrotic: 'nekrotické',
  Piercing: 'bodné', Poison: 'jedové', Psychic: 'psychické', Radiant: 'zářivé', Slashing: 'sečné', Thunder: 'hromové',
}
const MASTERY = new Set(['Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex'])
const cs = (en: string | null | undefined) => (en ? CS[en] ?? en : '')
const csLang = (en: string) => CS[`${en}_lang`] ?? CS[en] ?? en

// Class features that are scaffolding in D&D Beyond, not something a player reads at the table.
const SKIP_FEATURES = new Set([
  'Proficiencies', 'Hit Points', 'Equipment', 'Ability Score Improvement', 'Ability Score Increase', 'Subclass', 'Primal Path',
  'Bard College', 'Divine Domain', 'Druid Circle', 'Martial Archetype', 'Monastic Tradition', 'Sacred Oath', 'Ranger Archetype',
  'Ranger Conclave', 'Roguish Archetype', 'Sorcerous Origin', 'Otherworldly Patron', 'Arcane Tradition', 'Core Barbarian Traits',
  'Core Bard Traits', 'Core Cleric Traits', 'Core Druid Traits', 'Core Fighter Traits', 'Core Monk Traits', 'Core Paladin Traits',
  'Core Ranger Traits', 'Core Rogue Traits', 'Core Sorcerer Traits', 'Core Warlock Traits', 'Core Wizard Traits', 'Languages',
  'Age', 'Size', 'Speed', 'Creature Type', 'Alignment', 'Epic Boon',
])

// ---------------------------------------------------------------- SRD lookup (spell names → key)

interface SrdSpell { key: string; name: string; nameCs?: string; level: number }
let srdSpells: Map<string, SrdSpell> | null = null
function spellIndex(): Map<string, SrdSpell> {
  if (srdSpells) return srdSpells
  // In the image the client (with public/srd) sits next to dist/; in dev it is ../client/public.
  const candidates = [path.join(__dirname, '../public/srd/spells.json'), path.join(__dirname, '../../client/public/srd/spells.json')]
  const file = candidates.find((p) => fs.existsSync(p))
  const list: SrdSpell[] = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  srdSpells = new Map(list.map((s) => [s.name.toLowerCase(), s]))
  return srdSpells
}

// ---------------------------------------------------------------- helpers

/** D&D Beyond HTML → our plain text with **bold**, _italics_, "- " bullets and markdown tables. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  let s = html.replace(/\r/g, '')
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (t) => {
    const rows = [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => c[1].replace(/<[^>]+>/g, '').trim())
    )
    if (!rows.length) return ''
    const head = `|${rows[0].join('|')}|\n|${rows[0].map(() => '---').join('|')}|`
    return `\n${head}\n${rows.slice(1).map((r) => `|${r.join('|')}|`).join('\n')}\n`
  })
  s = s
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, '’')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, ', ')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/\*\*\s*\*\*/g, '')
  return s
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const mod = (score: number) => Math.floor((score - 10) / 2)
const clampText = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)
let idSeq = 0
const nextId = (prefix: string) => `${prefix}${++idSeq}`

export function parseDdbId(input: string): number {
  const m = String(input).trim().match(/(?:characters\/|^)(\d{5,12})(?:\/|$|\?)/)
  if (!m) throw new HttpError(400, 'Tohle nevypadá jako odkaz na postavu z D&D Beyond (…/characters/123456789)')
  return Number(m[1])
}

export async function fetchDdb(id: number): Promise<Any> {
  const res = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${id}`, {
    headers: { 'User-Agent': 'Druzina character import' },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new HttpError(502, 'D&D Beyond neodpovídá, zkus to za chvíli')
  })
  if (res.status === 403 || res.status === 401) throw new HttpError(400, 'Postava není veřejná. V D&D Beyond: Character Settings → Character Privacy → Public.')
  if (res.status === 404) throw new HttpError(404, 'Postava v D&D Beyond neexistuje')
  if (!res.ok) throw new HttpError(502, `D&D Beyond vrátil chybu ${res.status}`)
  const body: Any = await res.json()
  if (!body?.success || !body.data) throw new HttpError(400, body?.message ?? 'D&D Beyond postavu nevydal')
  return body.data
}

// ---------------------------------------------------------------- mapping

const RARITY: Record<string, string> = {
  Common: 'běžný', Uncommon: 'neobvyklý', Rare: 'vzácný', 'Very Rare': 'velmi vzácný', Legendary: 'legendární', Artifact: 'artefakt',
}
const ITEM_TYPE: Record<string, string> = {
  Weapon: 'zbraň', Armor: 'zbroj', Potion: 'lektvar', Ring: 'prsten', Rod: 'žezlo', Scroll: 'svitek', Staff: 'hůl', Wand: 'hůlka',
  'Wondrous item': 'zázračný předmět', 'Wondrous Item': 'zázračný předmět', 'Other Gear': 'vybavení',
}
const ARMOR_KIND: Record<number, string> = { 1: 'lehká zbroj', 2: 'střední zbroj', 3: 'těžká zbroj', 4: 'štít' }

/** One Czech summary line for an item: type, rarity, damage or AC, properties. */
function itemInfo(d: Any): string {
  const parts: string[] = []
  if (d.filterType === 'Armor' && ARMOR_KIND[d.armorTypeId]) parts.push(ARMOR_KIND[d.armorTypeId])
  else if (d.filterType) parts.push(ITEM_TYPE[d.filterType] ?? String(d.filterType).toLowerCase())
  if (d.rarity && d.rarity !== 'Common' && RARITY[d.rarity]) parts.push(RARITY[d.rarity])
  else if (d.rarity === 'Common' && d.magic) parts.push(RARITY.Common)
  if (d.filterType === 'Weapon') {
    const dice = String(d.damage?.diceString ?? '').replace(/d/g, 'k')
    const dmg = [dice, d.damageType ? cs(d.damageType) : ''].filter(Boolean).join(' ')
    if (dmg) parts.push(dmg)
    const props = (d.properties ?? []).map((p: Any) => cs(p.name)).filter(Boolean)
    if (props.length) parts.push(props.join(', '))
  } else if (d.filterType === 'Armor' && d.armorClass) {
    parts.push(`OČ ${d.armorClass}`)
  }
  return clampText(parts.join(', '), 160)
}

export interface ImportResult {
  sheet: Sheet
  state: State
  ddbId: number
  warnings: string[]
}

export function mapCharacter(c: Any): ImportResult {
  idSeq = 0
  const warnings: string[] = []

  // Items that are actually in effect: equipped, and attuned when they require attunement.
  const activeItems = new Set<number>(
    (c.inventory ?? [])
      .filter((i: Any) => i.equipped && (!i.definition?.canAttune || i.isAttuned))
      .map((i: Any) => i.definition?.id)
  )
  const mods: Any[] = Object.entries(c.modifiers ?? {}).flatMap(([group, list]) =>
    ((list as Any[]) ?? []).filter((m) => group !== 'item' || activeItems.has(m.componentId))
  )
  const sumBonus = (subType: string) =>
    mods.filter((m) => m.type === 'bonus' && m.subType === subType).reduce((n, m) => n + (m.value ?? m.fixedValue ?? 0), 0)
  const has = (type: string, subType: string) => mods.some((m) => m.type === type && m.subType === subType)

  // Ability scores: override, else base + manual bonus + modifiers; "set" items (Gauntlets of Ogre
  // Power) raise to a floor. "choose-an-ability-score" is a leftover of an option not taken (the
  // player picked a feat instead), so it is ignored: the chosen ability arrives as a real subType.
  const abilities = {} as Sheet['abilities']
  for (const [idStr, a] of Object.entries(ABILITY_BY_ID)) {
    const id = Number(idStr)
    const over = c.overrideStats?.find((s: Any) => s.id === id)?.value
    if (over) {
      abilities[a] = over
      continue
    }
    const base = c.stats?.find((s: Any) => s.id === id)?.value ?? 10
    const manual = c.bonusStats?.find((s: Any) => s.id === id)?.value ?? 0
    const slug = Object.keys(ABILITY_SLUG).find((k) => ABILITY_SLUG[k] === a)!
    let score = base + manual + sumBonus(`${slug}-score`)
    for (const m of mods) if (m.type === 'set' && m.subType === `${slug}-score` && m.value > score) score = m.value
    abilities[a] = Math.max(1, Math.min(30, score))
  }

  const classes = (c.classes ?? [])
    .slice()
    .sort((x: Any, y: Any) => (y.isStartingClass ? 1 : 0) - (x.isStartingClass ? 1 : 0))
    .map((cl: Any) => ({ name: cs(cl.definition?.name), subclass: cs(cl.subclassDefinition?.name), level: cl.level ?? 0 }))
  const level = classes.reduce((n: number, x: { level: number }) => n + x.level, 0)
  const prof = 2 + Math.floor((Math.max(level, 1) - 1) / 4)

  // Saves and skills.
  const saves = (Object.entries(ABILITY_SLUG) as [string, (typeof ABILITIES)[number]][])
    .filter(([slug]) => has('proficiency', `${slug}-saving-throws`))
    .map(([, a]) => a)
  const skills: Sheet['skills'] = {}
  const halfProf = has('half-proficiency', 'ability-checks')
  for (const [slug, k] of Object.entries(SKILL_BY_SLUG)) {
    if (has('expertise', slug)) skills[k] = 2
    else if (has('proficiency', slug)) skills[k] = 1
    else if (halfProf) skills[k] = 0.5
  }

  // HP: override, or base + bonus + (Con mod + per-level bonuses) × level.
  const hpPerLevel = sumBonus('hit-points-per-level')
  const hpMax = c.overrideHitPoints ?? (c.baseHitPoints ?? 0) + (c.bonusHitPoints ?? 0) + (mod(abilities.con) + hpPerLevel) * level

  // AC from equipped armor, else the unarmored formula (Barbarian Con, Monk Wis, Draconic 13+Dex).
  const equipped = (c.inventory ?? []).filter((i: Any) => i.equipped)
  const armor = equipped.find((i: Any) => [1, 2, 3].includes(i.definition?.armorTypeId))
  const shield = equipped.find((i: Any) => i.definition?.armorTypeId === 4)
  const dex = mod(abilities.dex)
  let ac: number
  if (armor) {
    const d = armor.definition
    ac = d.armorClass + (d.armorTypeId === 1 ? dex : d.armorTypeId === 2 ? Math.min(dex, 2) : 0)
  } else {
    ac = 10 + dex
    const unarmored = mods.filter((m) => m.type === 'set' && m.subType === 'unarmored-armor-class')
    const best = Math.max(0, ...unarmored.map((m) => (m.statId ? mod(abilities[ABILITY_BY_ID[m.statId]]) : 0) + (m.value ?? 0)))
    ac += best
  }
  if (shield) ac += shield.definition.armorClass ?? 2
  ac += sumBonus('armor-class') + (armor ? sumBonus('armored-armor-class') : sumBonus('unarmored-armor-class'))
  const magicArmor = equipped.filter((i: Any) => i.definition?.magic && (i.definition?.armorTypeId || i.definition?.canAttune))
  if (magicArmor.length) warnings.push(`Třída zbroje: zkontroluj magické předměty (${magicArmor.map((i: Any) => i.definition.name).join(', ')}).`)
  if (c.characterValues?.length) warnings.push('Postava má v D&D Beyond ruční přepsání hodnot, zkontroluj TZ, rychlost a útoky.')

  // Speed: species walk speed (or custom), plus bonuses (Fast Movement, Longstrider...).
  const walk = c.customSpeeds?.find((s: Any) => s.movementId === 1)?.distance ?? c.race?.weightSpeeds?.normal?.walk ?? 30
  const speed = walk + sumBonus('speed') + sumBonus('speed-walking')
  if (armor?.definition?.armorTypeId === 3 && sumBonus('speed') > 0) warnings.push('Rychlost: bonus jako Rychlý pohyb neplatí v těžké zbroji, zkontroluj.')

  // Senses.
  const darkvision = Math.max(0, ...mods.filter((m) => m.subType === 'darkvision').map((m) => m.value ?? 0))
  const senses = [darkvision ? `Vidění ve tmě ${darkvision} stop` : '', ...(c.customSenses ?? []).map((s: Any) => s.notes ?? '')]
    .filter(Boolean)
    .join(', ')

  // Proficiencies and languages as one readable paragraph.
  const isSkillOrSave = (sub: string) => sub in SKILL_BY_SLUG || sub.endsWith('-saving-throws')
  const profNames = [...new Set(mods.filter((m) => m.type === 'proficiency' && !isSkillOrSave(m.subType) && !m.subType.startsWith('choose')).map((m) => m.friendlySubtypeName as string))]
  const languages = [...new Set(mods.filter((m) => m.type === 'language' && !m.subType.startsWith('choose')).map((m) => csLang(m.friendlySubtypeName)))]
  const proficiencies = [
    languages.length ? `Jazyky: ${languages.join(', ')}.` : '',
    profNames.length ? `Zdatnosti: ${profNames.map(cs).join(', ')}.` : '',
  ].filter(Boolean).join('\n')

  // Attacks: equipped weapons (all weapons if none is equipped) plus an unarmed strike.
  const weaponProf = (d: Any) =>
    (d.categoryId === 1 && has('proficiency', 'simple-weapons')) ||
    (d.categoryId === 2 && has('proficiency', 'martial-weapons')) ||
    has('proficiency', String(d.name).toLowerCase().replace(/[^a-z]+/g, '-'))
  const weapons = (c.inventory ?? []).filter((i: Any) => i.definition?.filterType === 'Weapon')
  const shown = weapons.some((i: Any) => i.equipped) ? weapons.filter((i: Any) => i.equipped) : weapons
  const attacks: Sheet['attacks'] = shown.slice(0, 20).map((i: Any) => {
    const d = i.definition
    const props: string[] = (d.properties ?? []).map((p: Any) => p.name)
    const ranged = d.attackType === 2
    const ab = props.includes('Finesse') ? Math.max(mod(abilities.str), dex) : ranged ? dex : mod(abilities.str)
    const magic = (d.grantedModifiers ?? []).filter((g: Any) => g.type === 'bonus' && g.subType === 'magic').reduce((n: number, g: Any) => n + (g.value ?? 0), 0)
    const dmgBonus = ab + magic
    const dice = d.damage?.diceString ?? ''
    const versatile = (d.properties ?? []).find((p: Any) => p.name === 'Versatile')?.notes
    const notes = [
      props.filter((p) => !MASTERY.has(p)).map(cs).join(', '),
      versatile ? `obouručně ${String(versatile).replace(/d/g, 'k')}` : '',
      d.range && (ranged || props.includes('Thrown')) ? `dostřel ${d.range}/${d.longRange ?? d.range} stop` : '',
      props.filter((p) => MASTERY.has(p)).map((p) => `mistrovství: ${cs(p)}`).join(', '),
    ].filter(Boolean).join('; ')
    return {
      id: nextId('a'),
      name: clampText(cs(d.name), 80),
      toHit: ab + (weaponProf(d) ? prof : 0) + magic,
      damage: dice ? `${dice}${dmgBonus ? (dmgBonus > 0 ? '+' : '-') + Math.abs(dmgBonus) : ''}` : '',
      damageType: cs(d.damageType),
      notes: clampText(notes, 300),
    }
  })
  const str = mod(abilities.str)
  attacks.push({ id: nextId('a'), name: 'Úder beze zbraně', toHit: str + prof, damage: `${Math.max(1, 1 + str)}`, damageType: 'drtivé', notes: '' })

  // Resources: limited-use actions (Rage, Bardic Inspiration, Channel Divinity...).
  const resources: Sheet['resources'] = []
  const resourcesUsed: Record<string, number> = {}
  const seen = new Set<string>()
  for (const a of Object.values(c.actions ?? {}).flat() as Any[]) {
    const lu = a?.limitedUse
    if (!lu || seen.has(a.name)) continue
    let max = lu.maxUses ?? 0
    if (lu.useProficiencyBonus) max = lu.proficiencyBonusOperator === 2 ? max * prof : prof
    else if (lu.statModifierUsesId) max = Math.max(1, mod(abilities[ABILITY_BY_ID[lu.statModifierUsesId]]))
    if (max <= 0) continue
    seen.add(a.name)
    const id = nextId('r')
    resources.push({
      id,
      name: clampText(cs(a.name), 60),
      nameEn: clampText(a.name ?? '', 60),
      max: Math.min(99, max),
      reset: lu.resetType === 1 ? 'short' : 'long',
    })
    if (lu.numberUsed) resourcesUsed[id] = Math.min(max, lu.numberUsed)
  }

  // Features: class and subclass features up to the class level, species traits, feats, background.
  const features: Sheet['features'] = []
  const addFeature = (name: string, source: string, html: string) => {
    const textEn = clampText(htmlToText(html), 12000)
    if (!name || features.some((f) => f.nameEn === name && f.source === source)) return
    features.push({ id: nextId('f'), name: clampText(name, 120), source: clampText(source, 80), text: textEn, nameEn: clampText(name, 120), textEn })
  }
  for (const cl of c.classes ?? []) {
    const className = cs(cl.definition?.name)
    for (const f of cl.classFeatures ?? []) {
      const d = f.definition
      if (!d || d.hideInSheet || d.requiredLevel > cl.level || SKIP_FEATURES.has(d.name)) continue
      const src = d.isSubClassFeature ? cs(cl.subclassDefinition?.name) || className : className
      addFeature(d.name, `${src} ${d.requiredLevel}`, d.description)
    }
  }
  const speciesName = cs(c.race?.fullName ?? c.race?.baseName)
  for (const t of c.race?.racialTraits ?? []) {
    const d = t.definition
    if (!d || d.hideInSheet || SKIP_FEATURES.has(d.name)) continue
    addFeature(d.name, speciesName, d.description)
  }
  for (const f of c.feats ?? []) addFeature(f.definition?.name, 'Výsada', f.definition?.description)
  const bg = c.background?.definition
  if (bg?.featureName) addFeature(bg.featureName, cs(bg.name), bg.featureDescription)
  if (features.length >= 120) warnings.push('Postava má přes 120 schopností, zbytek se nevešel.')

  // Spellcasting: slots and pact magic as D&D Beyond reports them, spells from class lists and
  // from species/feats/items. SRD spells get the key (Czech name and text come from our data).
  let spellcasting: Sheet['spellcasting'] = null
  const casterClass = (c.classes ?? []).find((cl: Any) => cl.definition?.spellCastingAbilityId || cl.subclassDefinition?.spellCastingAbilityId)
  const classSpells = (c.classSpells ?? []).flatMap((x: Any) => x.spells ?? [])
  const otherSpells = (Object.values(c.spells ?? {}).flat() as Any[]).filter(Boolean)
  const anySlots = (c.spellSlots ?? []).some((s: Any) => s.available > 0) || (c.pactMagic ?? []).some((s: Any) => s.available > 0)
  if (classSpells.length || otherSpells.length || anySlots) {
    const abilityId = casterClass?.definition?.spellCastingAbilityId ?? casterClass?.subclassDefinition?.spellCastingAbilityId ?? 4
    const slots = Array.from({ length: 9 }, (_, i) => c.spellSlots?.find((s: Any) => s.level === i + 1)?.available ?? 0)
    const pactSlot = (c.pactMagic ?? []).find((s: Any) => s.available > 0)
    const index = spellIndex()
    const spells: NonNullable<Sheet['spellcasting']>['spells'] = []
    for (const s of [...classSpells, ...otherSpells]) {
      const d = s?.definition
      if (!d || spells.some((x) => x.nameEn === d.name)) continue
      const srd = index.get(String(d.name).toLowerCase())
      const textEn = clampText(htmlToText(d.description), 8000)
      spells.push({
        id: nextId('s'),
        name: clampText(srd?.nameCs ?? d.name, 80),
        level: Math.max(0, Math.min(9, d.level ?? 0)),
        prepared: !!(s.prepared || s.alwaysPrepared || s.countsAsKnownSpell || (d.level ?? 0) === 0 || !classSpells.includes(s)),
        srd: srd?.key ?? '',
        // SRD spells read their text from our data; others keep the D&D Beyond text until translated.
        text: srd ? '' : textEn,
        nameEn: clampText(d.name, 80),
        textEn,
      })
    }
    spellcasting = {
      ability: ABILITY_BY_ID[abilityId] ?? 'int',
      slots,
      pact: pactSlot ? { level: pactSlot.level, count: pactSlot.available } : null,
      spells: spells.slice(0, 150),
    }
  }

  const hitDice = (c.classes ?? [])
    .map((cl: Any) => ({ die: cl.definition?.hitDice, count: cl.level }))
    .filter((h: Any) => [6, 8, 10, 12].includes(h.die))
  // Two classes with the same die share one row.
  const hitDiceMerged = Object.values(
    hitDice.reduce((acc: Record<number, { die: number; count: number }>, h: { die: number; count: number }) => {
      acc[h.die] = { die: h.die, count: (acc[h.die]?.count ?? 0) + h.count }
      return acc
    }, {})
  )

  const notes = [c.notes?.backstory, c.notes?.personalPossessions && `Osobní věci: ${c.notes.personalPossessions}`, c.notes?.otherNotes]
    .filter(Boolean)
    .join('\n\n')

  const sheet = sheetSchema.parse({
    name: clampText(c.name ?? 'Bez jména', 80),
    player: clampText(c.username ?? '', 80),
    species: speciesName,
    background: cs(bg?.name),
    classes,
    portrait: c.decorations?.avatarUrl ?? '',
    abilities,
    saves,
    skills,
    ac: Math.max(0, Math.min(40, ac)),
    speed: Math.max(0, Math.min(200, speed)),
    hpMax: Math.max(0, Math.min(999, hpMax)),
    initiativeBonus: Math.max(-10, Math.min(20, sumBonus('initiative'))),
    hitDice: hitDiceMerged,
    senses,
    proficiencies: clampText(proficiencies, 2000),
    notes: clampText(notes, 10000),
    attacks,
    spellcasting,
    resources: resources.slice(0, 20),
    features: features.slice(0, 120),
  })

  // Inventory: every item with its quantity and details, same names merged (the first one's
  // details stay). Currencies become the coins of the state.
  const items: State['items'] = []
  const addItem = (i: Any, custom: boolean) => {
    const d = custom ? i : i.definition ?? {}
    const nameEn = clampText(String(d.name ?? i.name ?? ''), 80).trim()
    const name = clampText(cs(nameEn), 80).trim()
    if (!name) return
    const qty = Math.max(1, Math.min(9999, i.quantity ?? 1))
    const same = items.find((x) => x.name === name)
    if (same) {
      same.qty = Math.min(9999, same.qty + qty)
      return
    }
    const num = (n: unknown, max: number) => (typeof n === 'number' && n > 0 ? Math.min(max, Math.round(n * 100) / 100) : 0)
    items.push({
      id: nextId('i'),
      name,
      qty,
      nameEn: name !== nameEn ? nameEn : '',
      info: custom ? '' : itemInfo(d),
      weight: num(d.weight, 10000),
      cost: num(d.cost, 100_000_000),
      equipped: !custom && !!i.equipped,
      text: clampText(htmlToText(d.description), 3000),
      notes: custom ? clampText(htmlToText(i.notes), 1000) : '',
    })
  }
  for (const i of c.inventory ?? []) addItem(i, false)
  for (const i of c.customItems ?? []) addItem(i, true)
  const cur = c.currencies ?? {}
  const coin = (n: unknown) => Math.max(0, Math.min(10_000_000, Math.round(Number(n) || 0)))

  // State as it is in D&D Beyond right now, so the first session starts where they left off.
  const exhaustion = (c.conditions ?? []).find((x: Any) => x.id === 4)?.level ?? 0
  const state = stateSchema.parse({
    hp: Math.max(0, sheet.hpMax - (c.removedHitPoints ?? 0)),
    temp: c.temporaryHitPoints ?? 0,
    slotsUsed: Array.from({ length: 9 }, (_, i) => c.spellSlots?.find((s: Any) => s.level === i + 1)?.used ?? 0),
    pactUsed: (c.pactMagic ?? []).find((s: Any) => s.available > 0)?.used ?? 0,
    resources: resourcesUsed,
    conditions: (c.conditions ?? []).map((x: Any) => CONDITION_BY_ID[x.id]).filter(Boolean),
    exhaustion: Math.min(6, exhaustion),
    heroic: !!c.inspiration,
    death: { ok: c.deathSaves?.successCount ?? 0, fail: c.deathSaves?.failCount ?? 0 },
    items: items.slice(0, 300),
    coins: { cp: coin(cur.cp), sp: coin(cur.sp), ep: coin(cur.ep), gp: coin(cur.gp), pp: coin(cur.pp) },
  })

  const untranslated = features.length + (spellcasting?.spells.filter((s) => !s.srd).length ?? 0)
  if (untranslated) warnings.push(`${untranslated} textů je zatím anglicky (z D&D Beyond), překlad se doplní dodatečně.`)
  if (!attacks.some((a) => a.name !== 'Úder beze zbraně')) warnings.push('Žádná zbraň ve výbavě, útoky doplň ručně.')

  return { sheet, state, ddbId: c.id, warnings }
}
