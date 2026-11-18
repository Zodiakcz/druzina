// Dev only: a demo campaign with two made-up level 5 characters, to try the sheet without an
// import. Prints the links. Run: npm run seed
import 'dotenv/config'
import { prisma, newKey } from './lib'
import { sheetSchema, initialState, type Sheet } from './schema'

const barbar: Sheet = sheetSchema.parse({
  name: 'Ukázka: Grom',
  player: 'demo',
  species: 'Půlork',
  background: 'Voják',
  classes: [{ name: 'Barbar', subclass: 'Stezka berserkra', level: 5 }],
  abilities: { str: 17, dex: 14, con: 16, int: 8, wis: 12, cha: 10 },
  saves: ['str', 'con'],
  skills: { athletics: 1, intimidation: 1, perception: 1, survival: 1 },
  ac: 15,
  speed: 40,
  hpMax: 55,
  hitDice: [{ die: 12, count: 5 }],
  senses: 'Vidění ve tmě 60 stop',
  proficiencies: 'Jazyky: obecná řeč, orkština. Zbroje: lehké, střední, štíty. Zbraně: jednoduché, válečné.',
  attacks: [
    { id: 'a1', name: 'Obouruční sekera', toHit: 6, damage: '1d12+3', damageType: 'sečné', notes: 'Mistrovství: rozetnutí. Těžká, obouruční.' },
    { id: 'a2', name: 'Sekerka', toHit: 6, damage: '1d6+3', damageType: 'sečné', notes: 'Lehká, vrhací (20/60).' },
  ],
  resources: [{ id: 'rage', name: 'Zuřivost', max: 3, reset: 'long' }],
  features: [
    { id: 'f1', name: 'Zuřivost', source: 'Barbar 1', text: 'Bonusovou akcí. Výhoda k ověřením a záchranným hodům Síly, +2 ke zranění útoky Síly, rezistence vůči drtivému, bodnému a sečnému zranění. Nemůžeš sesílat kouzla ani se soustředit. Trvá do konce tvého dalšího tahu, prodlužuje se útokem, záchranným hodem nebo bonusovou akcí, nejvýš 10 minut. Krátký odpočinek vrátí jedno použití.' },
    { id: 'f2', name: 'Obrana bez zbroje', source: 'Barbar 1', text: 'Bez zbroje je tvá TZ 10 + OBR + ODL. Štít smíš mít.' },
    { id: 'f3', name: 'Bezohledný útok', source: 'Barbar 2', text: 'Při prvním útoku v tahu si můžeš vzít výhodu k útokům Síly do začátku dalšího tahu. Útoky proti tobě mají do té doby taky výhodu.' },
    { id: 'f4', name: 'Šílenství', source: 'Stezka berserkra 3', text: 'Když v zuřivosti použiješ bezohledný útok, první zásah v tahu přidá tolik k6, kolik je tvůj bonus za zuřivost.' },
    { id: 'f5', name: 'Útok navíc', source: 'Barbar 5', text: 'Akcí Útok útočíš dvakrát.' },
  ],
})

const kouzelnik: Sheet = sheetSchema.parse({
  name: 'Ukázka: Mirela',
  player: 'demo',
  species: 'Vznešený elf',
  background: 'Učenec',
  classes: [{ name: 'Kouzelník', subclass: 'Zaklínač', level: 5 }],
  abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
  saves: ['int', 'wis'],
  skills: { arcana: 1, history: 1, investigation: 1, perception: 1 },
  ac: 12,
  speed: 30,
  hpMax: 32,
  hitDice: [{ die: 6, count: 5 }],
  senses: 'Vidění ve tmě 60 stop',
  attacks: [{ id: 'a1', name: 'Dýka', toHit: 4, damage: '1d4+2', damageType: 'bodné', notes: 'Vrhací (20/60).' }],
  spellcasting: {
    ability: 'int',
    slots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    spells: [
      { id: 's1', name: 'Ohnivá střela', level: 0, srd: 'srd-2024_fire-bolt' },
      { id: 's2', name: 'Mágova ruka', level: 0, srd: 'srd-2024_mage-hand' },
      { id: 's3', name: 'Světlo', level: 0, srd: 'srd-2024_light' },
      { id: 's4', name: 'Magická střela', level: 1, srd: 'srd-2024_magic-missile' },
      { id: 's5', name: 'Štít', level: 1, srd: 'srd-2024_shield' },
      { id: 's6', name: 'Odhalení magie', level: 1, srd: 'srd-2024_detect-magic' },
      { id: 's7', name: 'Mlžný krok', level: 2, srd: 'srd-2024_misty-step' },
      { id: 's8', name: 'Spalující paprsek', level: 2, srd: 'srd-2024_scorching-ray' },
      { id: 's9', name: 'Ohnivá koule', level: 3, srd: 'srd-2024_fireball' },
      { id: 's10', name: 'Protikouzlo', level: 3, srd: 'srd-2024_counterspell', prepared: false },
    ],
  },
  resources: [{ id: 'recovery', name: 'Tajemné zotavení', max: 1, reset: 'long' }],
  features: [
    { id: 'f1', name: 'Tajemné zotavení', source: 'Kouzelník 1', text: 'Jednou za den po krátkém odpočinku obnovíš pozice kouzel v součtu úrovní nejvýš poloviny tvé úrovně kouzelníka (zaokrouhleno nahoru), žádnou 6. a vyšší úrovně.' },
  ],
})

async function main() {
  const campaign = await prisma.campaign.create({ data: { name: 'Ukázková kampaň', gmKey: newKey(), partyKey: newKey() } })
  const chars = []
  for (const [i, sheet] of [barbar, kouzelnik].entries()) {
    chars.push(
      await prisma.character.create({
        data: { campaignId: campaign.id, key: newKey(), sheet: JSON.stringify(sheet), state: JSON.stringify(initialState(sheet)), sort: i },
      })
    )
  }
  const base = process.env.PUBLIC_URL ?? 'http://localhost:5173'
  console.log(`PJ:      ${base}/pj/${campaign.gmKey}`)
  console.log(`Družina: ${base}/k/${campaign.partyKey}`)
  for (const c of chars) console.log(`${JSON.parse(c.sheet).name}: ${base}/p/${c.key}`)
}

main().finally(() => prisma.$disconnect())
