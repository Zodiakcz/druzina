// Builds the compact content files the client loads (client/public/srd/*.json) from
// data/srd-en (Open5e pull) and data/srd-cs (translations, when present).
// Run after fetch-srd.mjs or after a translation batch: node scripts/build-content.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'))
const readOptional = async (p) => (existsSync(join(ROOT, p)) ? read(p) : [])

const OUT = join(ROOT, 'client', 'public', 'srd')
await mkdir(OUT, { recursive: true })

// Spells: SRD 5.2, Czech fields merged in by key.
const en = await read('data/srd-en/srd-2024/spells.json')
const cs = new Map((await readOptional('data/srd-cs/spells.json')).map((s) => [s.key, s]))

const spells = en.map((s) => {
  const t = cs.get(s.key) ?? {}
  const components = [s.verbal && 'V', s.somatic && 'S', s.material && `M${s.material_specified ? ` (${s.material_specified})` : ''}`]
    .filter(Boolean)
    .join(', ')
  return {
    key: s.key,
    name: s.name,
    level: s.level,
    school: s.school?.key ?? '',
    time: s.casting_time,
    range: s.range_text,
    components,
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    classes: (s.classes ?? []).map((c) => c.name),
    text: s.desc,
    higher: s.higher_level ?? '',
    ...(t.name ? { nameCs: t.name } : {}),
    ...(t.text ? { textCs: t.text } : {}),
    ...(t.higher ? { higherCs: t.higher } : {}),
    ...(t.components ? { componentsCs: t.components } : {}),
  }
})

await writeFile(join(OUT, 'spells.json'), JSON.stringify(spells))
console.log(`spells: ${spells.length} (${spells.filter((s) => s.textCs).length} česky)`)
