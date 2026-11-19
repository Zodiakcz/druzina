// Every rules term shown in the UI. Source of truth for the words: docs/slovnik.md.
import type { Ability, Skill } from './types'

export const ABILITY: Record<Ability, { name: string; short: string }> = {
  str: { name: 'Síla', short: 'SIL' },
  dex: { name: 'Obratnost', short: 'OBR' },
  con: { name: 'Odolnost', short: 'ODL' },
  int: { name: 'Inteligence', short: 'INT' },
  wis: { name: 'Moudrost', short: 'MDR' },
  cha: { name: 'Charisma', short: 'CHA' },
}

export const SKILL: Record<Skill, string> = {
  acrobatics: 'Akrobacie',
  animalHandling: 'Zacházení se zvířaty',
  arcana: 'Arkána',
  athletics: 'Atletika',
  deception: 'Klamání',
  history: 'Historie',
  insight: 'Vhled',
  intimidation: 'Zastrašování',
  investigation: 'Pátrání',
  medicine: 'Lékařství',
  nature: 'Příroda',
  perception: 'Vnímání',
  performance: 'Vystupování',
  persuasion: 'Přesvědčování',
  religion: 'Náboženství',
  sleightOfHand: 'Zručnost',
  stealth: 'Nenápadnost',
  survival: 'Přežití',
}

export const T = {
  hp: 'Životy',
  hpShort: 'ŽV',
  temp: 'Dočasné',
  ac: 'Třída zbroje',
  acShort: 'TZ',
  initiative: 'Iniciativa',
  speed: 'Rychlost',
  prof: 'Zdatnostní bonus',
  save: 'Záchranný hod',
  saves: 'Záchranné hody',
  skills: 'Dovednosti',
  passivePerception: 'Pasivní vnímání',
  passiveInvestigation: 'Pasivní pátrání',
  passiveInsight: 'Pasivní vhled',
  heroic: 'Hrdinská inspirace',
  exhaustion: 'Vyčerpání',
  conditions: 'Stavy',
  concentration: 'Soustředění',
  death: 'Hody proti smrti',
  shortRest: 'Krátký odpočinek',
  longRest: 'Dlouhý odpočinek',
  hitDice: 'Kostky životů',
  attacks: 'Útoky',
  spells: 'Kouzla',
  cantrips: 'Triky',
  slots: 'Pozice kouzel',
  pact: 'Magie paktu',
  spellDc: 'SO kouzel',
  spellAttack: 'Útok kouzlem',
  features: 'Schopnosti',
  proficiencies: 'Zdatnosti a jazyky',
  notes: 'Poznámky',
  resources: 'Zdroje',
  effects: 'Efekty',
  advantage: 'Výhoda',
  disadvantage: 'Nevýhoda',
  normalRoll: 'Normálně',
  rollIt: 'Hodit',
  clearPool: 'Vymazat',
  hiddenRoll: 'Skrytý hod (vidí jen PJ)',
  diceTray: 'Kostky',
  tagAttack: 'útok',
  tagDamage: 'zranění',
  tagCrit: 'kritický',
  damageShort: 'Zranění',
  critShort: 'Kritický',
  damage: 'Zranění',
  heal: 'Léčení',
  level: 'úr.',
  senses: 'Smysly',
}

/** 2024 conditions. Exhaustion has its own counter, so it is not in this list. */
export const CONDITIONS: { id: string; name: string; text: string }[] = [
  { id: 'blinded', name: 'Oslepený', text: 'Nevidíš a neuspěješ v ověření, které vyžaduje zrak. Útoky proti tobě mají výhodu, tvé útoky nevýhodu.' },
  { id: 'charmed', name: 'Okouzlený', text: 'Nemůžeš zaútočit na toho, kdo tě okouzlil, ani na něj mířit škodlivou schopností nebo kouzlem. Ten má výhodu k ověřením při jednání s tebou.' },
  { id: 'deafened', name: 'Ohlušený', text: 'Neslyšíš a neuspěješ v ověření, které vyžaduje sluch.' },
  { id: 'frightened', name: 'Vystrašený', text: 'Nevýhoda k ověřením vlastností a hodům na útok, dokud vidíš zdroj strachu. Nemůžeš se k němu dobrovolně přiblížit.' },
  { id: 'grappled', name: 'Sevřený', text: 'Rychlost 0 a nemůže se zvýšit. Nevýhoda k útokům proti komukoli kromě toho, kdo tě drží. Ten tě může táhnout s sebou za cenu pohybu navíc.' },
  { id: 'incapacitated', name: 'Neschopný', text: 'Nemáš akce, bonusové akce ani reakce. Soustředění končí. Nemůžeš mluvit. Pokud jsi neschopný při hodu na iniciativu, máš nevýhodu.' },
  { id: 'invisible', name: 'Neviditelný', text: 'Výhoda k iniciativě. Nikdo tě nevidí, pokud nemá zvláštní smysl. Útoky proti tobě mají nevýhodu, tvé útoky výhodu, pokud tě útočník nevidí.' },
  { id: 'paralyzed', name: 'Ochromený', text: 'Jsi neschopný, rychlost 0. Automaticky neuspěješ v ZH Síly a Obratnosti. Útoky proti tobě mají výhodu; zásah z 1,5 m (5 stop) je kritický.' },
  { id: 'petrified', name: 'Zkamenělý', text: 'Proměněn v kámen, neschopný, rychlost 0. Útoky proti tobě mají výhodu. Neuspěješ v ZH Síly a Obratnosti. Rezistence vůči všemu zranění, imunita vůči jedu.' },
  { id: 'poisoned', name: 'Otrávený', text: 'Nevýhoda k hodům na útok a ověřením vlastností.' },
  { id: 'prone', name: 'Ležící', text: 'Pohybuješ se jen plazením (nebo vstaneš za polovinu rychlosti). Nevýhoda k útokům. Útoky proti tobě z 1,5 m mají výhodu, z dálky nevýhodu.' },
  { id: 'restrained', name: 'Spoutaný', text: 'Rychlost 0. Útoky proti tobě mají výhodu, tvé útoky nevýhodu. Nevýhoda k ZH Obratnosti.' },
  { id: 'stunned', name: 'Omráčený', text: 'Jsi neschopný. Neuspěješ v ZH Síly a Obratnosti. Útoky proti tobě mají výhodu.' },
  { id: 'unconscious', name: 'V bezvědomí', text: 'Neschopný a ležící, upustíš, co držíš. Rychlost 0. Neuspěješ v ZH Síly a Obratnosti. Útoky proti tobě mají výhodu; zásah z 1,5 m je kritický. Nevnímáš okolí.' },
]

export const EXHAUSTION_TEXT =
  'Každá úroveň: −2 ke všem testům k20 a −5 stop rychlosti. Dlouhý odpočinek ubere jednu úroveň. Úroveň 6 znamená smrt.'

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}
