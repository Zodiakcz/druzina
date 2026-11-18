// Builds the compact content files the client loads (client/public/srd/*.json) from
// data/srd-en (Open5e pull) and data/srd-cs (translations, when present).
// Run after fetch-srd.mjs or after merge-translations.mjs: node scripts/build-content.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'))
const readOptional = async (p, empty = []) => (existsSync(join(ROOT, p)) ? read(p) : empty)
const byKey = (list) => new Map(list.map((x) => [x.key, x]))
const opt = (k, v) => (v ? { [k]: v } : {})

const OUT = join(ROOT, 'client', 'public', 'srd')
await mkdir(OUT, { recursive: true })

// ---------------------------------------------------------------- spells (SRD 5.2)

const spellNames = await readOptional('data/srd-cs/spell-names.json', {})
const csSpells = byKey(await readOptional('data/srd-cs/spells.json'))

const spells = (await read('data/srd-en/srd-2024/spells.json')).map((s) => {
  const t = csSpells.get(s.key) ?? {}
  const comp = (somatic, material) =>
    [s.verbal && 'V', s.somatic && somatic, s.material && `M${material ? ` (${material})` : ''}`].filter(Boolean).join(', ')
  return {
    key: s.key,
    name: s.name,
    ...opt('nameCs', t.name ?? spellNames[s.name]),
    level: s.level,
    school: s.school?.key ?? '',
    time: s.casting_time,
    range: s.range_text,
    components: comp('S', s.material_specified),
    ...(t.text ? { componentsCs: comp('P', t.material ?? s.material_specified) } : {}),
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    classes: (s.classes ?? []).map((c) => c.name),
    text: s.desc,
    higher: s.higher_level ?? '',
    ...opt('textCs', t.text),
    ...opt('higherCs', t.higher),
  }
})
await writeFile(join(OUT, 'spells.json'), JSON.stringify(spells))
console.log(`spells: ${spells.length} (${spells.filter((s) => s.textCs).length} česky)`)

// ---------------------------------------------------------------- features
// Class and subclass features, species traits, feats, backgrounds, weapon properties: everything
// a character sheet can list as a "schopnost". `group` is what the editor's picker shows.

const csFeatures = byKey([...(await readOptional('data/srd-cs/features.json')), ...(await readOptional('data/srd-cs/misc.json'))])

// Group labels in Czech, so the editor can be searched in Czech ("barbar", "kopcový").
// Classes and SRD subclasses from docs/slovnik.md; species from the translated species entries.
const CLASS_CS = {
  Barbarian: 'Barbar', Bard: 'Bard', Cleric: 'Klerik', Druid: 'Druid', Fighter: 'Bojovník', Monk: 'Mnich',
  Paladin: 'Paladin', Ranger: 'Hraničář', Rogue: 'Tulák', Sorcerer: 'Čaroděj', Warlock: 'Černokněžník', Wizard: 'Kouzelník',
  'Path of the Berserker': 'Stezka berserkera', 'College of Lore': 'Kolej vědění', 'Life Domain': 'Doména života',
  'Circle of the Land': 'Kruh krajiny', Champion: 'Šampion', 'Warrior of the Open Hand': 'Válečník otevřené dlaně',
  'Oath of Devotion': 'Přísaha oddanosti', Hunter: 'Lovec', Thief: 'Zloděj', 'Draconic Sorcery': 'Dračí čarodějnictví',
  'Fiend Patron': 'Ďábelský patron', Evoker: 'Zaklínač',
}
const groupCs = (en) => CLASS_CS[en] ?? csFeatures.get(en)?.name ?? en

const features = []
const add = (key, group, name, text, extra = {}) => {
  const t = csFeatures.get(key) ?? {}
  features.push({ key, group, name, ...opt('nameCs', t.name), text, ...opt('textCs', t.text), ...extra })
}

for (const c of await read('data/srd-en/srd-2024/classes.json')) {
  for (const f of c.features) {
    if (f.feature_type !== 'CLASS_LEVEL_FEATURE') continue
    const level = Math.min(...(f.gained_at ?? []).map((g) => g.level), 20)
    add(f.key, groupCs(c.name), f.name, f.desc, { level, groupEn: c.name })
  }
}
for (const doc of ['srd-2024', 'srd-2014']) {
  for (const s of await read(`data/srd-en/${doc}/species.json`)) {
    const g = `${groupCs(s.key)}${doc === 'srd-2014' ? ' (2014)' : ''}`
    for (const t of s.traits) add(`${s.key}#${t.name}`, g, t.name, t.desc, { groupEn: s.name })
  }
}
for (const f of await read('data/srd-en/srd-2024/feats.json')) {
  const text = [f.desc, ...(f.benefits ?? []).map((b) => `- ${b.desc}`)].filter(Boolean).join('\n')
  add(f.key, 'Výsady', f.name, text, f.prerequisite ? { prerequisite: f.prerequisite } : {})
}
for (const b of await read('data/srd-en/srd-2024/backgrounds.json')) {
  const text = [b.desc, ...(b.benefits ?? []).map((x) => (x.name ? `**${x.name}:** ${x.desc}` : x.desc))].filter(Boolean).join('\n')
  add(b.key, 'Původy', b.name, text)
}
for (const p of await read('data/srd-en/srd-2024/weaponproperties.json')) {
  add(p.key, p.type === 'Mastery' ? 'Mistrovství zbraní' : 'Vlastnosti zbraní', p.name, p.desc)
}
await writeFile(join(OUT, 'features.json'), JSON.stringify(features))
console.log(`features: ${features.length} (${features.filter((f) => f.textCs).length} česky)`)
