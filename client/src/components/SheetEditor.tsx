// The form behind "Upravit kartu" and "Nová postava". Plain fields, no rules engine: whoever
// fills it in copies numbers from D&D Beyond or the paper sheet.
import { useMemo, useState, type ReactNode } from 'react'
import type { Ability, Effect, EffectMod, Sheet, Skill, SkillLevel } from '@/lib/types'
import { ABILITIES, SKILLS } from '@/lib/types'
import { ABILITY, SKILL, T } from '@/lib/cs'
import { mod } from '@/lib/rules'
import { useFeatures, useSpells } from '@/lib/srd'
import { PRESETS, fromPreset, suggestedPresets } from '@/lib/effects'
import { Button, Section } from './ui'
import { signed } from '@/lib/cs'

const uid = () => Math.random().toString(36).slice(2, 10)

const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600'

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function Num({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <input
      className={input}
      inputMode="numeric"
      value={Number.isFinite(value) ? String(value) : ''}
      onChange={(e) => {
        const n = parseInt(e.target.value.replace(/[^\d-]/g, ''), 10)
        onChange(Number.isFinite(n) ? Math.min(max ?? 999, Math.max(min ?? -99, n)) : 0)
      }}
    />
  )
}

function Rows<T extends object>({ items, onChange, render, blank, addLabel }: {
  items: T[]
  onChange: (items: T[]) => void
  render: (item: T, set: (patch: Partial<T>) => void) => ReactNode
  blank: () => T
  addLabel: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={(item as { id?: string }).id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <div className="mt-1 flex justify-end gap-1">
            {i > 0 && (
              <button className="px-2 text-xs text-zinc-500" onClick={() => onChange(items.map((x, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : x)))}>
                ↑ výš
              </button>
            )}
            <button className="px-2 text-xs text-red-400" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Odebrat
            </button>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange([...items, blank()])}>+ {addLabel}</Button>
    </div>
  )
}

const SKILL_LEVELS: [SkillLevel, string][] = [
  [0, '–'],
  [0.5, '½'],
  [1, 'zdatnost'],
  [2, 'odbornost'],
]

export function SheetEditor({ initial, onSave, onCancel, onDelete }: {
  initial: Sheet
  onSave: (s: Sheet) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}) {
  const [s, setS] = useState<Sheet>(() => structuredClone(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Sheet>) => setS((x) => ({ ...x, ...patch }))
  const srd = useSpells(!!s.spellcasting)
  const spellIndex = useMemo(() => {
    const m = new Map<string, { key: string; name: string; level: number }>()
    for (const e of srd?.values() ?? []) {
      m.set(e.name.toLowerCase(), { key: e.key, name: e.nameCs ?? e.name, level: e.level })
      if (e.nameCs) m.set(e.nameCs.toLowerCase(), { key: e.key, name: e.nameCs, level: e.level })
    }
    return m
  }, [srd])
  const [spellSearch, setSpellSearch] = useState('')

  const save = async () => {
    if (!s.name.trim()) return setError('Postava potřebuje jméno.')
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...s, name: s.name.trim() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 pb-28">
      <Section title="Základ">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Jméno postavy" className="col-span-2">
            <input className={input} value={s.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Hráč">
            <input className={input} value={s.player} onChange={(e) => set({ player: e.target.value })} />
          </Field>
          <Field label="Druh">
            <input className={input} value={s.species} onChange={(e) => set({ species: e.target.value })} placeholder="např. Půlork" />
          </Field>
          <Field label="Původ">
            <input className={input} value={s.background} onChange={(e) => set({ background: e.target.value })} />
          </Field>
          <Field label="Obrázek (URL)">
            <input className={input} value={s.portrait} onChange={(e) => set({ portrait: e.target.value })} placeholder="https://…" />
          </Field>
        </div>
      </Section>

      <Section title="Povolání">
        <Rows
          items={s.classes}
          onChange={(classes) => set({ classes })}
          blank={() => ({ name: '', subclass: '', level: 1 })}
          addLabel="povolání"
          render={(c, setC) => (
            <div className="grid grid-cols-[1fr_1fr_4rem] gap-2">
              <input className={input} placeholder="Povolání" value={c.name} onChange={(e) => setC({ name: e.target.value })} />
              <input className={input} placeholder="Specializace" value={c.subclass} onChange={(e) => setC({ subclass: e.target.value })} />
              <Num value={c.level} min={0} max={20} onChange={(level) => setC({ level })} />
            </div>
          )}
        />
      </Section>

      <Section title="Vlastnosti a záchranné hody">
        <div className="grid grid-cols-3 gap-2">
          {ABILITIES.map((a: Ability) => (
            <div key={a} className="rounded-lg border border-zinc-800 p-2">
              <Field label={`${ABILITY[a].name} (${signed(mod(s.abilities[a]))})`}>
                <Num value={s.abilities[a]} min={1} max={30} onChange={(v) => set({ abilities: { ...s.abilities, [a]: v } })} />
              </Field>
              <label className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={s.saves.includes(a)}
                  onChange={(e) => set({ saves: e.target.checked ? [...s.saves, a] : s.saves.filter((x) => x !== a) })}
                />
                zdatný ZH
              </label>
            </div>
          ))}
        </div>
      </Section>

      <Section title={T.skills}>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {SKILLS.map((k: Skill) => (
            <label key={k} className="flex items-center justify-between gap-2 text-sm text-zinc-300">
              {SKILL[k]}
              <select
                className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-sm"
                value={s.skills[k] ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value) as SkillLevel
                  const skills = { ...s.skills }
                  if (v) skills[k] = v
                  else delete skills[k]
                  set({ skills })
                }}
              >
                {SKILL_LEVELS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Boj">
        <div className="grid grid-cols-4 gap-2">
          <Field label={T.acShort}>
            <Num value={s.ac} min={0} max={40} onChange={(ac) => set({ ac })} />
          </Field>
          <Field label="Max ŽV">
            <Num value={s.hpMax} min={0} max={999} onChange={(hpMax) => set({ hpMax })} />
          </Field>
          <Field label="Rychlost">
            <Num value={s.speed} min={0} max={200} onChange={(speed) => set({ speed })} />
          </Field>
          <Field label="Inic. navíc">
            <Num value={s.initiativeBonus} min={-10} max={20} onChange={(initiativeBonus) => set({ initiativeBonus })} />
          </Field>
        </div>
        <p className="mb-1 mt-3 text-xs text-zinc-400">{T.hitDice}</p>
        <Rows
          items={s.hitDice}
          onChange={(hitDice) => set({ hitDice })}
          blank={() => ({ die: 8 as const, count: 1 })}
          addLabel="kostky životů"
          render={(h, setH) => (
            <div className="grid grid-cols-2 gap-2">
              <select className={input} value={h.die} onChange={(e) => setH({ die: Number(e.target.value) as 6 | 8 | 10 | 12 })}>
                {[6, 8, 10, 12].map((d) => (
                  <option key={d} value={d}>
                    k{d}
                  </option>
                ))}
              </select>
              <Num value={h.count} min={0} max={20} onChange={(count) => setH({ count })} />
            </div>
          )}
        />
        <Field label={T.senses} className="mt-3">
          <input className={input} value={s.senses} onChange={(e) => set({ senses: e.target.value })} placeholder="Vidění ve tmě 60 stop" />
        </Field>
      </Section>

      <Section title={T.attacks}>
        <Rows
          items={s.attacks}
          onChange={(attacks) => set({ attacks })}
          blank={() => ({ id: uid(), name: '', toHit: 0, damage: '', damageType: '', notes: '' })}
          addLabel="útok"
          render={(a, setA) => (
            <div className="grid grid-cols-[1fr_4.5rem] gap-2">
              <input className={input} placeholder="Název" value={a.name} onChange={(e) => setA({ name: e.target.value })} />
              <input
                className={input}
                placeholder="útok"
                inputMode="numeric"
                value={a.toHit === null ? '' : String(a.toHit)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  setA({ toHit: Number.isFinite(n) ? n : null })
                }}
              />
              <input className={input} placeholder="Zranění, např. 1d12+3" value={a.damage} onChange={(e) => setA({ damage: e.target.value })} />
              <input className={input} placeholder="typ" value={a.damageType} onChange={(e) => setA({ damageType: e.target.value })} />
              <input className={input} placeholder="Poznámka (vlastnosti, mistrovství)" value={a.notes} onChange={(e) => setA({ notes: e.target.value })} />
              <select className={input} value={a.ability ?? ''} onChange={(e) => setA({ ability: e.target.value as Ability | '' })} title="Vlastnost útoku">
                <option value="">vlastnost?</option>
                {ABILITIES.map((x) => (
                  <option key={x} value={x}>
                    {ABILITY[x].short}
                  </option>
                ))}
              </select>
            </div>
          )}
        />
        <p className="mt-2 text-xs text-zinc-500">
          Prázdný bonus k útoku = bez hodu na útok (kouzlo se záchranným hodem). Vlastnost útoku (SIL, OBR) potřebují efekty jako Zuřivost.
        </p>
      </Section>

      <Section
        title={T.spells}
        right={
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={!!s.spellcasting}
              onChange={(e) => set({ spellcasting: e.target.checked ? { ability: 'int', slots: [0, 0, 0, 0, 0, 0, 0, 0, 0], pact: null, spells: [] } : null })}
            />
            sesílá kouzla
          </label>
        }
      >
        {s.spellcasting && (
          <SpellcastingFields
            sc={s.spellcasting}
            onChange={(spellcasting) => set({ spellcasting })}
            spellSearch={spellSearch}
            setSpellSearch={setSpellSearch}
            spellIndex={spellIndex}
          />
        )}
      </Section>

      <Section title={T.resources}>
        <Rows
          items={s.resources}
          onChange={(resources) => set({ resources })}
          blank={() => ({ id: uid(), name: '', max: 1, reset: 'long' as const })}
          addLabel="zdroj (zuřivost, usměrnění božské moci…)"
          render={(r, setR) => (
            <div className="grid grid-cols-[1fr_4rem_7rem] gap-2">
              <input className={input} placeholder="Název" value={r.name} onChange={(e) => setR({ name: e.target.value })} />
              <Num value={r.max} min={0} max={99} onChange={(max) => setR({ max })} />
              <select className={input} value={r.reset} onChange={(e) => setR({ reset: e.target.value as 'short' | 'long' })}>
                <option value="short">krátký odp.</option>
                <option value="long">dlouhý odp.</option>
              </select>
            </div>
          )}
        />
      </Section>

      <Section title="Efekty">
        <EffectsFields s={s} onChange={(effects) => set({ effects })} />
      </Section>

      <Section title={T.features}>
        <FeaturePicker onPick={(f) => set({ features: [...s.features, f] })} />
        <Rows
          items={s.features}
          onChange={(features) => set({ features })}
          blank={() => ({ id: uid(), name: '', source: '', text: '' })}
          addLabel="schopnost"
          render={(f, setF) => (
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="Název" value={f.name} onChange={(e) => setF({ name: e.target.value })} />
              <input className={input} placeholder="Zdroj, např. Barbar 3" value={f.source} onChange={(e) => setF({ source: e.target.value })} />
              <textarea className={`${input} col-span-2`} rows={3} placeholder="Co to dělá" value={f.text} onChange={(e) => setF({ text: e.target.value })} />
            </div>
          )}
        />
      </Section>

      <Section title="Texty">
        <Field label={T.proficiencies}>
          <textarea className={input} rows={3} value={s.proficiencies} onChange={(e) => set({ proficiencies: e.target.value })} />
        </Field>
        <Field label={T.notes} className="mt-2">
          <textarea className={input} rows={4} value={s.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </Section>

      {onDelete && (
        <div className="pt-2">
          <Button kind="danger" onClick={onDelete}>
            Smazat postavu
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 px-3 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          {error && <span className="min-w-0 flex-1 truncate text-sm text-red-400">{error}</span>}
          <span className="flex-1" />
          <Button kind="ghost" onClick={onCancel}>
            Zrušit
          </Button>
          <Button kind="primary" onClick={save} disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SpellcastingFields({ sc, onChange, spellSearch, setSpellSearch, spellIndex }: {
  sc: NonNullable<Sheet['spellcasting']>
  onChange: (sc: NonNullable<Sheet['spellcasting']>) => void
  spellSearch: string
  setSpellSearch: (v: string) => void
  spellIndex: Map<string, { key: string; name: string; level: number }>
}) {
  const addFromSrd = (value: string) => {
    const hit = spellIndex.get(value.trim().toLowerCase())
    if (!hit) return false
    if (!sc.spells.some((x) => x.srd === hit.key)) {
      onChange({ ...sc, spells: [...sc.spells, { id: uid(), name: hit.name, level: hit.level, prepared: true, srd: hit.key, text: '' }] })
    }
    setSpellSearch('')
    return true
  }
  return (
    <div className="space-y-3">
      <Field label="Sesílací vlastnost">
        <select className={input} value={sc.ability} onChange={(e) => onChange({ ...sc, ability: e.target.value as Ability })}>
          {ABILITIES.map((a) => (
            <option key={a} value={a}>
              {ABILITY[a].name}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <p className="mb-1 text-xs text-zinc-400">Pozice kouzel podle úrovně (1 až 9)</p>
        <div className="grid grid-cols-9 gap-1">
          {sc.slots.map((n, i) => (
            <Num key={i} value={n} min={0} max={9} onChange={(v) => onChange({ ...sc, slots: sc.slots.map((x, j) => (j === i ? v : x)) })} />
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={!!sc.pact} onChange={(e) => onChange({ ...sc, pact: e.target.checked ? { level: 1, count: 1 } : null })} />
        {T.pact} (černokněžník)
      </label>
      {sc.pact && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Úroveň pozic paktu">
            <Num value={sc.pact.level} min={1} max={5} onChange={(level) => onChange({ ...sc, pact: { ...sc.pact!, level } })} />
          </Field>
          <Field label="Počet">
            <Num value={sc.pact.count} min={0} max={4} onChange={(count) => onChange({ ...sc, pact: { ...sc.pact!, count } })} />
          </Field>
        </div>
      )}
      <Field label="Přidat kouzlo ze SRD (začni psát anglický nebo český název)">
        <input
          className={input}
          list="srd-spells"
          value={spellSearch}
          onChange={(e) => {
            if (!addFromSrd(e.target.value)) setSpellSearch(e.target.value)
          }}
          placeholder="Fireball…"
        />
        <datalist id="srd-spells">
          {[...spellIndex.values()]
            .filter((v, i, arr) => arr.findIndex((x) => x.key === v.key) === i)
            .map((v) => (
              <option key={v.key} value={v.name} />
            ))}
        </datalist>
      </Field>
      <Rows
        items={sc.spells}
        onChange={(spells) => onChange({ ...sc, spells })}
        blank={() => ({ id: uid(), name: '', level: 1, prepared: true, srd: '', text: '' })}
        addLabel="vlastní kouzlo (mimo SRD)"
        render={(sp, setSp) => (
          <div className="grid grid-cols-[1fr_3.5rem] gap-2">
            <input className={input} placeholder="Název" value={sp.name} onChange={(e) => setSp({ name: e.target.value })} />
            <Num value={sp.level} min={0} max={9} onChange={(level) => setSp({ level })} />
            <label className="col-span-2 flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={sp.prepared} onChange={(e) => setSp({ prepared: e.target.checked })} /> připravené
              {sp.srd && <span className="text-zinc-600">· text ze SRD</span>}
            </label>
            {!sp.srd && (
              <textarea className={`${input} col-span-2`} rows={2} placeholder="Text kouzla" value={sp.text} onChange={(e) => setSp({ text: e.target.value })} />
            )}
          </div>
        )}
      />
    </div>
  )
}

const EFFECT_ON: [EffectMod['on'], string][] = [
  ['attack', 'útok'],
  ['damage', 'zranění'],
  ['check', 'ověření'],
  ['save', 'záchr. hod'],
  ['ac', 'TZ'],
  ['speed', 'rychlost'],
]

/** Effects the player switches on at the table (Rage...) and what each one changes. */
function EffectsFields({ s, onChange }: { s: Sheet; onChange: (effects: Effect[]) => void }) {
  const effects = s.effects ?? []
  const suggested = suggestedPresets(s)
  const add = (key: string) => {
    const e = fromPreset(s, key, uid())
    if (e) onChange([...effects, e])
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Hráč je na kartě zapíná a vypíná. Zapnutý efekt přičte bonus nebo výhodu k hodům, na které míří. Odpočinek je vypne.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => add(p.key)}
            className={`rounded-full border px-2.5 py-1 text-xs ${suggested.includes(p.key) ? 'border-amber-500 bg-amber-500/15 text-amber-100' : 'border-zinc-700 text-zinc-400'}`}
          >
            + {p.make(s).name}
          </button>
        ))}
      </div>
      {suggested.length > 0 && <p className="text-xs text-amber-500/80">Zvýrazněné odpovídají schopnostem nebo kouzlům na kartě.</p>}
      <Rows
        items={effects}
        onChange={onChange}
        blank={() => ({ id: uid(), name: '', resourceId: '', mods: [], resist: '', noSpells: false, text: '' })}
        addLabel="vlastní efekt"
        render={(e, setE) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="Název" value={e.name} onChange={(ev) => setE({ name: ev.target.value })} />
              <select className={input} value={e.resourceId} onChange={(ev) => setE({ resourceId: ev.target.value })} title="Zapnutí utratí použití zdroje">
                <option value="">bez zdroje</option>
                {s.resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    zdroj: {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Rows
              items={e.mods}
              onChange={(mods) => setE({ mods })}
              blank={(): EffectMod => ({ on: 'attack', ability: '', bonus: '', mode: 'normal' })}
              addLabel="co mění"
              render={(m, setM) => (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <select className={input} value={m.on} onChange={(ev) => setM({ on: ev.target.value as EffectMod['on'] })}>
                    {EFFECT_ON.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select className={input} value={m.ability} onChange={(ev) => setM({ ability: ev.target.value as Ability | '' })} disabled={m.on === 'ac' || m.on === 'speed'}>
                    <option value="">vše</option>
                    {ABILITIES.map((x) => (
                      <option key={x} value={x}>
                        {ABILITY[x].short}
                      </option>
                    ))}
                  </select>
                  <input
                    className={input}
                    placeholder={m.on === 'ac' || m.on === 'speed' ? '+2' : '+2, 1k4'}
                    value={m.bonus.replace(/d/g, 'k')}
                    onChange={(ev) => setM({ bonus: ev.target.value.replace(/k/gi, 'd').replace(/[^0-9d+\-]/g, '').slice(0, 20) })}
                  />
                  <select className={input} value={m.mode} onChange={(ev) => setM({ mode: ev.target.value as EffectMod['mode'] })} disabled={m.on === 'damage' || m.on === 'ac' || m.on === 'speed'}>
                    <option value="normal">–</option>
                    <option value="adv">výhoda</option>
                    <option value="dis">nevýhoda</option>
                  </select>
                </div>
              )}
            />
            <input className={input} placeholder="Odolnost vůči (např. drtivé, bodné, sečné)" value={e.resist} onChange={(ev) => setE({ resist: ev.target.value })} />
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={e.noSpells} onChange={(ev) => setE({ noSpells: ev.target.checked })} /> nesmí sesílat kouzla ani se soustředit
            </label>
            <textarea className={input} rows={2} placeholder="Připomínka (co dalšího platí)" value={e.text} onChange={(ev) => setE({ text: ev.target.value })} />
          </div>
        )}
      />
    </div>
  )
}

/** Adds an SRD feature (class, species, feat, background, weapon mastery) with its Czech text. */
function FeaturePicker({ onPick }: { onPick: (f: Sheet['features'][number]) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = useFeatures(open)
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!list || needle.length < 2) return []
    return list
      .filter((f) => `${f.nameCs ?? ''} ${f.name} ${f.group} ${f.groupEn ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 30)
  }, [list, q])
  if (!open) {
    return (
      <div className="mb-3">
        <Button onClick={() => setOpen(true)}>Přidat schopnost ze SRD…</Button>
      </div>
    )
  }
  return (
    <div className="mb-3 rounded-lg border border-amber-800/50 p-2">
      <input
        autoFocus
        className={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Hledej: zuřivost, Rage, barbar, trpaslík…"
      />
      {!list && <p className="mt-2 text-xs text-zinc-500">Načítám…</p>}
      <ul className="mt-2 max-h-72 divide-y divide-zinc-800 overflow-y-auto">
        {hits.map((f) => (
          <li key={f.key}>
            <button
              className="w-full py-1.5 text-left"
              onClick={() => {
                onPick({
                  id: uid(),
                  name: f.nameCs ?? f.name,
                  source: f.level ? `${f.group} ${f.level}` : f.group,
                  text: f.textCs ?? f.text,
                })
                setQ('')
              }}
            >
              <span className="block text-sm text-zinc-100">
                {f.nameCs ?? f.name} {!f.textCs && <span className="text-xs text-amber-500">(zatím anglicky)</span>}
              </span>
              <span className="block text-xs text-zinc-500">
                {f.group}
                {f.level ? `, úroveň ${f.level}` : ''}
                {f.nameCs ? ` · ${f.name}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-end">
        <Button kind="ghost" onClick={() => setOpen(false)}>
          Hotovo
        </Button>
      </div>
    </div>
  )
}
