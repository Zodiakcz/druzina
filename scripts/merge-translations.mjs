// Folds translation batches (data/srd-cs/_out/<batch>.json, made from _in/<batch>.json) into the
// committed Czech files data/srd-cs/{spells,features,misc}.json. Re-running adds and overwrites by
// key, so batches can arrive one at a time. Refuses a batch that does not match its input.
//   node scripts/merge-translations.mjs [batch ...]     (default: every file in _out/)

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CS = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'srd-cs')
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))

const target = (batch) => (batch.startsWith('spells') ? 'spells' : batch.startsWith('features') ? 'features' : 'misc')

function check(batch, input, output) {
  const problems = []
  const inKeys = input.map((x) => x.key).join('\n')
  const outKeys = output.map((x) => x.key).join('\n')
  if (inKeys !== outKeys) problems.push('keys differ from the input')
  for (const o of output) {
    const i = input.find((x) => x.key === o.key)
    if (!i) continue
    for (const f of ['text', 'higher', 'material', 'prerequisite']) {
      if (i[f] && !o[f]) problems.push(`${o.key}: missing ${f}`)
    }
    const all = [o.name, o.text, o.higher, o.material, o.prerequisite].filter(Boolean).join(' ')
    if (all.includes('—')) problems.push(`${o.key}: long dash`)
    if (/\d+d\d+|\bd20\b/.test(all)) problems.push(`${o.key}: English dice notation`)
    if (/\bfeet\b|\bfoot\b/.test(all)) problems.push(`${o.key}: "feet" left in`)
    // A translation much shorter than the source has probably dropped something.
    if (i.text && o.text && o.text.length < i.text.length * 0.6) problems.push(`${o.key}: text suspiciously short`)
  }
  return problems
}

const batches = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (await readdir(join(CS, '_out'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))

const merged = {}
for (const name of ['spells', 'features', 'misc']) {
  const p = join(CS, `${name}.json`)
  merged[name] = new Map(existsSync(p) ? (await readJson(p)).map((x) => [x.key, x]) : [])
}

let failed = false
for (const batch of batches) {
  const input = await readJson(join(CS, '_in', `${batch}.json`))
  const output = await readJson(join(CS, '_out', `${batch}.json`))
  const problems = check(batch, input, output)
  if (problems.length) {
    failed = true
    console.log(`${batch}: REFUSED\n  ${problems.slice(0, 20).join('\n  ')}${problems.length > 20 ? `\n  … ${problems.length - 20} more` : ''}`)
    continue
  }
  for (const o of output) {
    const { poznamka, ...rest } = o
    merged[target(batch)].set(o.key, poznamka ? { ...rest, poznamka } : rest)
  }
  console.log(`${batch}: ${output.length} merged${output.some((o) => o.poznamka) ? ` (${output.filter((o) => o.poznamka).length} with a note)` : ''}`)
}

for (const [name, map] of Object.entries(merged)) {
  if (!map.size) continue
  const list = [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  await writeFile(join(CS, `${name}.json`), JSON.stringify(list, null, 1) + '\n')
}
process.exit(failed ? 1 : 0)
