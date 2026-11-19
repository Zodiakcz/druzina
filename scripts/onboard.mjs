// Onboarding one D&D Beyond character into a campaign, step by step. Driven by the /onboard
// skill (.claude/skills/onboard/SKILL.md), usable by hand too.
//
//   node --experimental-strip-types scripts/onboard.mjs <command> ...
//
//   pull <D&D Beyond link>        import into a draft (nothing saved), print the report
//   report <ddbId>                print the report again
//   tr-in <ddbId> [size]          write the untranslated texts as batches for translation
//   tr-merge <ddbId>              check the translated batches and fold them into the draft
//   effect <ddbId> add <preset>   add a preset effect (rage, reckless, bless, huntersMark, dodge)
//   effect <ddbId> json <file>    add custom effects from a JSON file (one effect or an array)
//   effect <ddbId> rm <name>      remove an effect from the draft
//   save <ddbId>                  create the character, or update it when it is already in the campaign
//
// DRUZINA_GM is the GM link (https://druzina.lankapp.cloud/pj/<key>). It is read from the
// environment only and never written anywhere. Drafts live in the OS temp folder, never in the
// repo: they carry D&D Beyond's non-SRD book text.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PRESETS, describeEffect, fromPreset, suggestedPresets } from '../client/src/lib/effects.ts'

const [cmd, ...args] = process.argv.slice(2)
const die = (msg) => {
  console.error(msg)
  process.exit(1)
}
const uid = () => Math.random().toString(36).slice(2, 10)
const dirOf = (ddbId) => join(tmpdir(), 'druzina-onboard', String(ddbId))
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))
const writeJson = (p, v) => writeFile(p, JSON.stringify(v, null, 1))

function gm() {
  const link = process.env.DRUZINA_GM
  if (!link) die('Set DRUZINA_GM to the GM link (…/pj/<key>).')
  const u = new URL(link)
  const key = u.pathname.match(/\/pj\/([^/]+)/)?.[1]
  if (!key) die('DRUZINA_GM does not look like a GM link (…/pj/<key>).')
  return { origin: u.origin, key }
}

async function api(path, init = {}) {
  const { origin, key } = gm()
  const res = await fetch(`${origin}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Key': key, ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) die(`${init.method ?? 'GET'} ${path}: ${res.status} ${body.error ?? JSON.stringify(body)}`)
  return body
}

const load = async (ddbId) => readJson(join(dirOf(ddbId), 'draft.json')).catch(() => die(`No draft for ${ddbId}. Run pull first.`))
const store = (draft) => writeJson(join(dirOf(draft.ddbId), 'draft.json'), draft)

// ---------------------------------------------------------------- report

// D&D Beyond source ids we know. Anything else is printed as #id for the GM to look up.
const SOURCES = {
  1: ['Basic Rules', 2014], 2: ['PHB', 2014], 3: ['DMG', 2014], 5: ['MM', 2014], 27: ["Xanathar's", 2014],
  67: ["Tasha's", 2014], 145: ['PHB', 2024], 146: ['DMG', 2024], 147: ['MM', 2025], 148: ['Free Rules', 2024],
}
function sourceLine(def) {
  const ids = (def?.sources ?? []).map((s) => s.sourceId)
  const names = ids.map((id) => (SOURCES[id] ? `${SOURCES[id][0]} ${SOURCES[id][1]}` : `#${id}`))
  const flags = [def?.isLegacy && 'legacy', def?.isHomebrew && 'HOMEBREW'].filter(Boolean)
  return `[${names.join(', ') || 'no source'}]${flags.length ? ' ' + flags.join(' ') : ''}`
}

function rulesReport(c, sheet) {
  const out = []
  const row = (kind, name, def, extra = '') => out.push(`  ${kind.padEnd(9)} ${String(name).padEnd(28)} ${sourceLine(def)}${extra}`)
  row('species', c.race?.fullName, c.race)
  for (const k of c.classes ?? []) {
    row('class', `${k.definition?.name} ${k.level}`, k.definition)
    if (k.subclassDefinition) row('subclass', k.subclassDefinition.name, k.subclassDefinition)
  }
  if (c.background?.definition) row('backgr.', c.background.definition.name, c.background.definition)
  for (const f of c.feats ?? []) {
    const hidden = (f.definition?.categories ?? []).some((x) => x.tagName === '__DISGUISE_FEAT')
    row('feat', f.definition?.name, f.definition, hidden ? '  (hidden feat: story or origin boon)' : '')
  }
  for (const i of c.inventory ?? []) {
    const d = i.definition ?? {}
    if (d.filterType === 'Weapon' || d.magic || d.isHomebrew || d.canAttune) {
      row('item', d.name, d, `${d.magic ? ' magic' : ''}${d.canAttune ? (i.isAttuned ? ' attuned' : ' not attuned') : ''}${i.equipped ? ' equipped' : ''}`)
    }
  }
  const spells = [...Object.values(c.spells ?? {}).flat(), ...(c.classSpells ?? []).flatMap((x) => x.spells ?? [])].filter(Boolean)
  for (const sp of spells) row('spell', `${sp.definition?.name} (${sp.definition?.level})`, sp.definition, sp.prepared || sp.alwaysPrepared ? ' prepared' : '')

  const homebrew = [c.race, ...(c.classes ?? []).flatMap((k) => [k.definition, k.subclassDefinition]), ...(c.feats ?? []).map((f) => f.definition), ...(c.inventory ?? []).map((i) => i.definition)]
    .filter((d) => d?.isHomebrew)
  const p = c.preferences ?? {}
  const base = (c.stats ?? []).map((s) => s.value).join('/')
  const final = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => sheet.abilities[a])
  return [
    ...out,
    `  homebrew: ${homebrew.length ? homebrew.map((d) => d.name).join(', ') : 'none'}`,
    `  D&D Beyond settings: homebrew ${p.useHomebrewContent ? 'allowed' : 'off'}, feat rules ${p.enforceFeatRules ? 'enforced' : 'NOT enforced'}, multiclass rules ${p.enforceMulticlassRules ? 'enforced' : 'NOT enforced'}, optional class features ${p.enableOptionalClassFeatures ? 'on' : 'off'}, optional origins ${p.enableOptionalOrigins ? 'on' : 'off'}`,
    `  abilities: base ${base} → final ${final.join('/')}${final.some((v) => v > 20) ? '  ABOVE 20' : ''}`,
  ].join('\n')
}

async function printReport(draft) {
  const s = draft.sheet
  const raw = await readJson(join(dirOf(draft.ddbId), 'ddb.json')).catch(() => null)
  const english = untranslated(s)
  const suggested = suggestedPresets(s)
  console.log(`== ${s.name} · ${s.classes.map((k) => `${k.name} ${k.level}${k.subclass ? ` (${k.subclass})` : ''}`).join(' / ')} · ${s.species}`)
  console.log(draft.characterId ? `Already in the campaign (${draft.characterId}): save updates it, state stays.` : 'New character: save creates it.')
  console.log('\nRules (D&D Beyond):')
  console.log(raw ? rulesReport(raw.data, s) : '  (raw D&D Beyond data missing)')
  console.log(`\nImporter warnings: ${draft.warnings?.length ? '\n  ' + draft.warnings.join('\n  ') : 'none'}`)
  console.log(`\nSheet: HP ${s.hpMax}, AC ${s.ac}, speed ${s.speed}`)
  for (const a of s.attacks) console.log(`  attack ${a.name}: ${a.toHit ?? '-'} / ${a.damage} ${a.damageType} [${a.ability || 'no ability'}]`)
  for (const r of s.resources) console.log(`  resource ${r.name} (${r.nameEn ?? ''}) ×${r.max}, ${r.reset}`)
  console.log(`\nTranslation: ${english.length} of ${s.features.length + (s.spellcasting?.spells.filter((x) => !x.srd).length ?? 0)} texts still English`)
  console.log('\nEffects on the draft:')
  if (!s.effects.length) console.log('  none')
  for (const e of s.effects) {
    const r = s.resources.find((x) => x.id === e.resourceId)
    console.log(`  ${e.name}${e.preset ? ` (preset ${e.preset})` : ''}${r ? `, resource ${r.name}` : ''}: ${describeEffect(s, e)}`)
  }
  console.log(`Presets matching the sheet, not added yet: ${suggested.join(', ') || 'none'}`)
  console.log(`\nFeatures (judge which change rolls mid-fight):\n  ${s.features.map((f) => `${f.name}${f.nameEn && f.nameEn !== f.name ? ` / ${f.nameEn}` : ''} [${f.source}]`).join('\n  ')}`)
  if (s.spellcasting) console.log(`Spells: ${s.spellcasting.spells.map((x) => x.nameEn || x.name).join(', ')}`)
  console.log(`\nDraft: ${join(dirOf(draft.ddbId), 'draft.json')}`)
}

// ---------------------------------------------------------------- translation

function untranslated(s) {
  return [
    ...s.features.filter((f) => f.textEn && f.text === f.textEn).map((f) => ({ key: `f:${f.id}`, name: f.name, text: f.text })),
    ...(s.spellcasting?.spells ?? []).filter((x) => !x.srd && x.textEn && x.text === x.textEn).map((x) => ({ key: `s:${x.id}`, name: x.name, text: x.text })),
  ]
}

// The same checks as scripts/merge-translations.mjs.
function problemsOf(i, o) {
  const p = []
  if (!o.text) p.push('missing text')
  const all = `${o.name ?? ''} ${o.text ?? ''}`
  if (all.includes('—')) p.push('long dash')
  if (/\d+d\d+|\bd20\b/.test(all)) p.push('English dice notation')
  if (/\bfeet\b|\bfoot\b/.test(all)) p.push('"feet" left in')
  if (i.text && o.text && o.text.length < i.text.length * 0.6) p.push('text suspiciously short')
  return p
}

// ---------------------------------------------------------------- commands

if (cmd === 'pull') {
  const link = args[0] ?? die('pull <D&D Beyond link>')
  const ddbId = Number(String(link).match(/(?:characters\/|^)(\d{5,12})(?:\/|$|\?)/)?.[1]) || die('Not a D&D Beyond character link.')
  const dir = dirOf(ddbId)
  await mkdir(dir, { recursive: true })
  const raw = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${ddbId}`, { headers: { 'User-Agent': 'Druzina onboarding' } })
  if (raw.ok) await writeFile(join(dir, 'ddb.json'), await raw.text())
  else console.log(`(raw D&D Beyond fetch failed: ${raw.status}; the rules report will be missing)`)
  const session = await api('/session')
  const existing = session.characters.find((c) => c.ddbId === ddbId)
  const result = await api('/import/ddb', { method: 'POST', body: JSON.stringify({ url: String(link), ...(existing ? { characterId: existing.id } : {}) }) })
  const draft = { ddbId, characterId: existing?.id ?? null, campaign: session.campaign.name, ...result }
  await store(draft)
  console.log(`Campaign: ${session.campaign.name}\n`)
  await printReport(draft)
} else if (cmd === 'report') {
  await printReport(await load(args[0]))
} else if (cmd === 'tr-in') {
  const draft = await load(args[0])
  const size = Number(args[1]) || 10
  const items = untranslated(draft.sheet)
  const dir = dirOf(draft.ddbId)
  for (const f of await readdir(dir)) if (/^tr-(in|out)-\d+\.json$/.test(f)) await writeFile(join(dir, f), '[]')
  const paths = []
  for (let n = 0; n * size < items.length; n++) {
    const p = join(dir, `tr-in-${n + 1}.json`)
    await writeJson(p, items.slice(n * size, (n + 1) * size))
    paths.push(p)
  }
  console.log(items.length ? `${items.length} texts in ${paths.length} batches. Translations go to tr-out-<n>.json next to each:\n${paths.join('\n')}` : 'Nothing to translate.')
} else if (cmd === 'tr-merge') {
  const draft = await load(args[0])
  const dir = dirOf(draft.ddbId)
  let ok = 0
  const refused = []
  for (const f of (await readdir(dir)).filter((x) => /^tr-in-\d+\.json$/.test(x))) {
    const input = await readJson(join(dir, f))
    if (!input.length) continue
    const output = await readJson(join(dir, f.replace('tr-in', 'tr-out'))).catch(() => null)
    if (!output) {
      refused.push(`${f}: no ${f.replace('tr-in', 'tr-out')}`)
      continue
    }
    for (const i of input) {
      const o = output.find((x) => x.key === i.key)
      const problems = o ? problemsOf(i, o) : ['missing from the output']
      if (problems.length) {
        refused.push(`${i.key} ${i.name}: ${problems.join(', ')}`)
        continue
      }
      const [kind, id] = i.key.split(':')
      const list = kind === 'f' ? draft.sheet.features : draft.sheet.spellcasting?.spells ?? []
      const target = list.find((x) => x.id === id)
      if (!target) continue
      target.name = String(o.name || target.name).slice(0, kind === 'f' ? 120 : 80)
      target.text = String(o.text)
      ok++
    }
  }
  await store(draft)
  console.log(`${ok} translations merged.${refused.length ? `\nRefused (left English):\n  ${refused.join('\n  ')}` : ''}`)
  console.log(`${untranslated(draft.sheet).length} texts still English.`)
} else if (cmd === 'effect') {
  const [ddbId, action, value] = args
  const draft = await load(ddbId)
  const s = draft.sheet
  s.effects ??= []
  if (action === 'add') {
    const e = fromPreset(s, value, uid()) ?? die(`Unknown preset "${value}". Known: ${PRESETS.map((p) => p.key).join(', ')}`)
    if (s.effects.some((x) => x.name === e.name)) die(`${e.name} is already on the draft.`)
    s.effects.push(e)
    console.log(`Added ${e.name}: ${describeEffect(s, e)}`)
  } else if (action === 'json') {
    const list = [].concat(await readJson(value))
    for (const x of list) {
      const e = { id: uid(), resourceId: '', mods: [], resist: '', noSpells: false, text: '', preset: '', ...x }
      e.mods = e.mods.map((m) => ({ ability: '', bonus: '', mode: 'normal', ...m }))
      if (s.effects.some((y) => y.name === e.name)) die(`${e.name} is already on the draft.`)
      if (e.resourceId && !s.resources.some((r) => r.id === e.resourceId)) die(`${e.name}: no resource with id ${e.resourceId}. Ids: ${s.resources.map((r) => `${r.id}=${r.name}`).join(', ')}`)
      s.effects.push(e)
      console.log(`Added ${e.name}: ${describeEffect(s, e)}`)
    }
  } else if (action === 'rm') {
    const before = s.effects.length
    s.effects = s.effects.filter((e) => e.name !== value)
    console.log(before === s.effects.length ? `No effect named ${value}.` : `Removed ${value}.`)
  } else die('effect <ddbId> add <preset> | json <file> | rm <name>')
  await store(draft)
} else if (cmd === 'save') {
  const draft = await load(args[0])
  const { origin } = gm()
  const c = draft.characterId
    ? await api(`/characters/${draft.characterId}/sheet`, { method: 'PUT', body: JSON.stringify({ sheet: draft.sheet, ddbId: draft.ddbId }) })
    : await api('/characters', { method: 'POST', body: JSON.stringify({ sheet: draft.sheet, state: draft.state, ddbId: draft.ddbId }) })
  draft.characterId = c.id
  await store(draft)
  console.log(`Saved ${c.sheet.name} (${c.id}).${c.key ? `\nPlayer link: ${origin}/p/${c.key}` : ''}`)
} else {
  die('Commands: pull, report, tr-in, tr-merge, effect, save. See the top of scripts/onboard.mjs.')
}
