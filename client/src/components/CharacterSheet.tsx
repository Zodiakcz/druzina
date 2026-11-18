// The play sheet. Used by a player on their phone and by the GM for any character.
import { useState, type ReactNode } from 'react'
import type { Ability, Character, Sheet, Skill, State } from '@/lib/types'
import { ABILITIES, SKILLS } from '@/lib/types'
import { ABILITY, CONDITIONS, EXHAUSTION_TEXT, SKILL, T, signed } from '@/lib/cs'
import * as R from '@/lib/rules'
import { critFormula, d20 } from '@/lib/dice'
import { SCHOOL, csMeta, useSpells, type SrdSpell } from '@/lib/srd'
import { useRoller, DiceBar } from './Roller'
import { RollLog } from './RollLog'
import { HpBar, Portrait } from './PartyCard'
import { Button, Modal, Pips, Prose, Section, Stat } from './ui'
import type { Roll } from '@/lib/types'

type Tab = 'boj' | 'vlastnosti' | 'kouzla' | 'schopnosti' | 'log'

interface Props {
  c: Character
  rolls: Roll[]
  patch: (p: Partial<State>) => void
  onEdit?: () => void
}

export function CharacterSheet({ c, rolls, patch, onEdit }: Props) {
  const [tab, setTab] = useState<Tab>('boj')
  const [reading, setReading] = useState<{ title: ReactNode; body: ReactNode } | null>(null)
  const s = c.sheet
  const st = c.state
  const tabs: [Tab, string][] = [
    ['boj', 'Boj'],
    ['vlastnosti', 'Vlastnosti'],
    ...(s.spellcasting ? ([['kouzla', T.spells]] as [Tab, string][]) : []),
    ['schopnosti', T.features],
    ['log', 'Kostky'],
  ]
  const read = (title: ReactNode, body: ReactNode) => setReading({ title, body })

  return (
    <div className="pb-24">
      <Header c={c} patch={patch} onEdit={onEdit} />
      <div className="mt-3 space-y-3">
        {tab === 'boj' && <CombatTab c={c} patch={patch} read={read} />}
        {tab === 'vlastnosti' && <AbilitiesTab s={s} st={st} />}
        {tab === 'kouzla' && s.spellcasting && <SpellsTab c={c} patch={patch} read={read} />}
        {tab === 'schopnosti' && <FeaturesTab s={s} read={read} />}
        {tab === 'log' && (
          <>
            <Section title="Hod kostkou">
              <DiceBar />
            </Section>
            <Section title="Log hodů">
              <RollLog rolls={rolls} meId={c.id} />
            </Section>
          </>
        )}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide ${tab === id ? 'text-amber-300' : 'text-zinc-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      {reading && (
        <Modal title={reading.title} onClose={() => setReading(null)}>
          {reading.body}
        </Modal>
      )}
    </div>
  )
}

function Header({ c, patch, onEdit }: { c: Character; patch: Props['patch']; onEdit?: () => void }) {
  const s = c.sheet
  const st = c.state
  return (
    <div className="flex items-start gap-3">
      <Portrait c={c} size={64} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl text-zinc-50">{s.name}</h1>
        <p className="truncate text-sm text-zinc-400">
          {s.species} · {R.classLine(s)}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            onClick={() => patch({ heroic: !st.heroic })}
            className={`rounded-full border px-2 py-0.5 text-xs ${st.heroic ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-zinc-700 text-zinc-500'}`}
          >
            ★ {T.heroic}
          </button>
          {onEdit && (
            <button onClick={onEdit} className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
              Upravit kartu
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Boj

function CombatTab({ c, patch, read }: { c: Character; patch: Props['patch']; read: (t: ReactNode, b: ReactNode) => void }) {
  const s = c.sheet
  const st = c.state
  const { rollAndLog } = useRoller()
  const pen = R.d20Penalty(st)
  const init = R.initiative(s) + pen
  return (
    <>
      <HpPanel c={c} patch={patch} />
      <div className="grid grid-cols-4 gap-2">
        <Stat label={T.acShort} value={s.ac} />
        <Stat label={T.initiative} value={signed(init)} onClick={() => rollAndLog(T.initiative, d20(init))} />
        <Stat label={T.speed} value={R.effectiveSpeed(s, st)} sub="stop" />
        <Stat label="ZB" value={signed(R.profBonus(s))} />
      </div>
      {st.hp <= 0 && <DeathSaves c={c} patch={patch} />}

      <Section title={T.attacks}>
        {s.attacks.length === 0 && <p className="text-sm text-zinc-500">Žádné útoky na kartě.</p>}
        <ul className="space-y-2">
          {s.attacks.map((a) => {
            const hit = a.toHit === null ? null : a.toHit + pen
            return (
              <li key={a.id} className="rounded-lg bg-zinc-900 p-2">
                <div className="flex items-center gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => a.notes && read(a.name, <Prose text={a.notes} />)}>
                    <span className="block truncate font-semibold text-zinc-100">{a.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {a.damage} {a.damageType}
                      {a.notes ? ` · ${a.notes}` : ''}
                    </span>
                  </button>
                  {hit !== null && (
                    <button onClick={() => rollAndLog(`${a.name}: útok`, d20(hit))} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-bold tabular-nums">
                      {signed(hit)}
                    </button>
                  )}
                  {a.damage && (
                    <button
                      onClick={() => rollAndLog(`${a.name}: zranění`, a.damage, { d20: false })}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                    >
                      {a.damage.replace(/d/g, 'k')}
                    </button>
                  )}
                  {/d/i.test(a.damage) && (
                    <button
                      onClick={() => rollAndLog(`${a.name}: kritický zásah`, critFormula(a.damage), { d20: false })}
                      className="rounded-lg border border-amber-800 px-2 py-2 text-xs text-amber-300"
                      title="Kritický zásah"
                    >
                      ×2
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      {s.resources.length > 0 && (
        <Section title={T.resources}>
          <ul className="space-y-2">
            {s.resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-200">
                  {r.name} <span className="text-xs text-zinc-500">({r.reset === 'short' ? 'krátký odp.' : 'dlouhý odp.'})</span>
                </span>
                <Pips
                  label={r.name}
                  total={r.max}
                  used={st.resources[r.id] ?? 0}
                  onChange={(used) => patch({ resources: { ...st.resources, [r.id]: used } })}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Conditions c={c} patch={patch} read={read} />
      <Rests c={c} patch={patch} />
    </>
  )
}

function HpPanel({ c, patch }: { c: Character; patch: Props['patch'] }) {
  const s = c.sheet
  const st = c.state
  const [mode, setMode] = useState<'damage' | 'heal' | 'temp' | null>(null)
  const [value, setValue] = useState('')
  const apply = () => {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n) || n <= 0) return
    if (mode === 'damage') {
      const next = R.applyDamage(st, n)
      // Damage while concentrating: remind of the save (DC 10 or half the damage, max 30).
      patch(next)
    } else if (mode === 'heal') patch(R.applyHealing(s, st, n))
    else if (mode === 'temp') patch({ temp: Math.max(st.temp, n) })
    setValue('')
    setMode(null)
  }
  const concentrationDc = mode === 'damage' && st.concentration ? Math.min(30, Math.max(10, Math.floor((parseInt(value, 10) || 0) / 2))) : null
  return (
    <Section title={T.hp}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-4xl font-bold tabular-nums text-zinc-50">
            {st.hp}
            <span className="text-xl text-zinc-500"> / {s.hpMax}</span>
            {st.temp > 0 && <span className="ml-2 text-xl text-sky-300">+{st.temp}</span>}
          </div>
          <div className="mt-2">
            <HpBar hp={st.hp} max={s.hpMax} temp={st.temp} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button kind="danger" onClick={() => setMode('damage')}>
            − {T.damage}
          </Button>
          <Button onClick={() => setMode('heal')} className="!border-emerald-800 !bg-emerald-950 !text-emerald-200">
            + {T.heal}
          </Button>
        </div>
      </div>
      <button className="mt-2 text-xs text-sky-300" onClick={() => setMode('temp')}>
        + {T.temp.toLowerCase()} životy
      </button>
      {mode && (
        <Modal
          title={mode === 'damage' ? 'Kolik zranění?' : mode === 'heal' ? 'Kolik léčení?' : 'Dočasné životy'}
          onClose={() => setMode(null)}
          footer={
            <Button kind="primary" className="w-full py-3" onClick={apply}>
              Potvrdit
            </Button>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              apply()
            }}
          >
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-center text-3xl font-bold tabular-nums text-zinc-50"
            />
          </form>
          {mode === 'temp' && <p className="mt-2 text-xs text-zinc-500">Dočasné životy se nesčítají, platí vyšší hodnota.</p>}
          {concentrationDc !== null && (
            <p className="mt-2 text-sm text-violet-300">
              Soustředíš se na {st.concentration}: záchranný hod Odolnosti SO {concentrationDc}.
            </p>
          )}
        </Modal>
      )}
    </Section>
  )
}

function DeathSaves({ c, patch }: { c: Character; patch: Props['patch'] }) {
  const { death } = c.state
  const { rollAndLog } = useRoller()
  const rollSave = () => {
    const r = rollAndLog(T.death, d20(R.d20Penalty(c.state)))
    if (!r) return
    const nat = r.detail.nat
    // Nat 20: back with 1 HP. Nat 1: two failures. 10+ success.
    if (nat === 20) patch({ hp: 1, death: { ok: 0, fail: 0 } })
    else if (nat === 1) patch({ death: { ...death, fail: Math.min(3, death.fail + 2) } })
    else if (r.total >= 10) patch({ death: { ...death, ok: Math.min(3, death.ok + 1) } })
    else patch({ death: { ...death, fail: Math.min(3, death.fail + 1) } })
  }
  return (
    <Section title={T.death} right={<Button onClick={rollSave}>Hodit</Button>}>
      <div className="flex items-center justify-around">
        <div className="text-center">
          <Pips label="Úspěch" total={3} used={death.ok} onChange={(ok) => patch({ death: { ...death, ok } })} />
          <div className="mt-1 text-xs text-emerald-400">úspěchy</div>
        </div>
        <div className="text-center">
          <Pips label="Neúspěch" total={3} used={death.fail} onChange={(fail) => patch({ death: { ...death, fail } })} />
          <div className="mt-1 text-xs text-red-400">neúspěchy</div>
        </div>
      </div>
      {death.ok >= 3 && <p className="mt-2 text-center text-sm text-emerald-300">Stabilizovaný.</p>}
      {death.fail >= 3 && <p className="mt-2 text-center text-sm text-red-300">Postava zemřela.</p>}
    </Section>
  )
}

function Conditions({ c, patch, read }: { c: Character; patch: Props['patch']; read: (t: ReactNode, b: ReactNode) => void }) {
  const st = c.state
  const [editing, setEditing] = useState(false)
  const active = CONDITIONS.filter((x) => st.conditions.includes(x.id))
  const toggle = (id: string) =>
    patch({ conditions: st.conditions.includes(id) ? st.conditions.filter((x) => x !== id) : [...st.conditions, id] })
  return (
    <Section title={T.conditions} right={<Button kind="ghost" onClick={() => setEditing(true)}>Změnit</Button>}>
      <div className="flex flex-wrap gap-1.5">
        {active.length === 0 && st.exhaustion === 0 && !st.concentration && <span className="text-sm text-zinc-500">Žádné.</span>}
        {active.map((x) => (
          <button key={x.id} onClick={() => read(x.name, <p>{x.text}</p>)} className="rounded-full bg-zinc-700 px-2.5 py-1 text-sm text-zinc-100">
            {x.name}
          </button>
        ))}
        {st.exhaustion > 0 && (
          <button onClick={() => read(`${T.exhaustion} ${st.exhaustion}`, <p>{EXHAUSTION_TEXT}</p>)} className="rounded-full bg-orange-900 px-2.5 py-1 text-sm text-orange-100">
            {T.exhaustion} {st.exhaustion} ({signed(R.d20Penalty(st))})
          </button>
        )}
        {st.concentration && (
          <button onClick={() => patch({ concentration: '' })} className="rounded-full bg-violet-900 px-2.5 py-1 text-sm text-violet-100" title="Ukončit soustředění">
            ◎ {st.concentration} ×
          </button>
        )}
      </div>
      {editing && (
        <Modal title={T.conditions} onClose={() => setEditing(false)}>
          <div className="grid grid-cols-2 gap-1.5">
            {CONDITIONS.map((x) => (
              <button
                key={x.id}
                onClick={() => toggle(x.id)}
                className={`rounded-lg border px-2 py-2 text-left text-sm ${st.conditions.includes(x.id) ? 'border-amber-500 bg-amber-500/15 text-amber-100' : 'border-zinc-700 text-zinc-300'}`}
              >
                {x.name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-zinc-300">{T.exhaustion}</span>
            <div className="flex items-center gap-2">
              <Button onClick={() => patch({ exhaustion: Math.max(0, st.exhaustion - 1) })}>−</Button>
              <span className="w-6 text-center text-lg font-bold tabular-nums">{st.exhaustion}</span>
              <Button onClick={() => patch({ exhaustion: Math.min(6, st.exhaustion + 1) })}>+</Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{EXHAUSTION_TEXT}</p>
        </Modal>
      )}
    </Section>
  )
}

function Rests({ c, patch }: { c: Character; patch: Props['patch'] }) {
  const s = c.sheet
  const st = c.state
  const { rollAndLog } = useRoller()
  const [confirm, setConfirm] = useState<'short' | 'long' | null>(null)
  const conMod = R.abilityMod(s, 'con')
  const spendHitDie = (die: number) => {
    const r = rollAndLog(`${T.hitDice}: k${die}`, `1d${die}${conMod ? (conMod > 0 ? '+' : '-') + Math.abs(conMod) : ''}`, { d20: false })
    if (!r) return
    patch({
      ...R.applyHealing(s, st, Math.max(0, r.total)),
      hitDiceUsed: { ...st.hitDiceUsed, [die]: (st.hitDiceUsed[die] ?? 0) + 1 },
    })
  }
  return (
    <Section title="Odpočinek">
      {s.hitDice.length > 0 && (
        <div className="mb-3 space-y-1">
          {s.hitDice.map((h) => {
            const left = h.count - (st.hitDiceUsed[h.die] ?? 0)
            return (
              <div key={h.die} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  {T.hitDice} k{h.die}: <b className="tabular-nums text-zinc-50">{left}</b>/{h.count}
                </span>
                <Button disabled={left <= 0} onClick={() => spendHitDie(h.die)}>
                  Utratit
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setConfirm('short')}>{T.shortRest}</Button>
        <Button onClick={() => setConfirm('long')}>{T.longRest}</Button>
      </div>
      {confirm && (
        <Modal
          title={confirm === 'short' ? T.shortRest : T.longRest}
          onClose={() => setConfirm(null)}
          footer={
            <Button
              kind="primary"
              className="w-full py-3"
              onClick={() => {
                patch(confirm === 'short' ? R.shortRest(s, st) : R.longRest(s, st))
                setConfirm(null)
              }}
            >
              Odpočinout
            </Button>
          }
        >
          {confirm === 'short' ? (
            <p>Obnoví zdroje „na krátký odpočinek“ a magii paktu. Kostky životů utrácej tlačítkem výš.</p>
          ) : (
            <p>Plné životy, všechny kostky životů a pozice kouzel, všechny zdroje, vyčerpání o jednu úroveň níž. Dočasné životy a soustředění zmizí.</p>
          )}
        </Modal>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- Vlastnosti

function AbilitiesTab({ s, st }: { s: Sheet; st: State }) {
  const { rollAndLog } = useRoller()
  const pen = R.d20Penalty(st)
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((a: Ability) => {
          const m = R.abilityMod(s, a) + pen
          return (
            <button
              key={a}
              onClick={() => rollAndLog(`${ABILITY[a].name}: ověření`, d20(m))}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-center active:bg-zinc-800"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{ABILITY[a].name}</div>
              <div className="text-3xl font-bold tabular-nums text-zinc-50">{signed(m)}</div>
              <div className="text-xs text-zinc-500">{s.abilities[a]}</div>
            </button>
          )
        })}
      </div>
      <Section title={T.saves}>
        <div className="grid grid-cols-2 gap-1">
          {ABILITIES.map((a) => {
            const b = R.saveBonus(s, a) + pen
            return (
              <RollRow key={a} label={ABILITY[a].name} bonus={b} prof={s.saves.includes(a) ? 1 : 0} onRoll={() => rollAndLog(`ZH ${ABILITY[a].name}`, d20(b))} />
            )
          })}
        </div>
      </Section>
      <Section title={T.skills}>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {SKILLS.map((k: Skill) => {
            const b = R.skillBonus(s, k) + pen
            return (
              <RollRow
                key={k}
                label={SKILL[k]}
                hint={ABILITY[R.SKILL_ABILITY[k]].short}
                bonus={b}
                prof={s.skills[k] ?? 0}
                onRoll={() => rollAndLog(SKILL[k], d20(b))}
              />
            )
          })}
        </div>
      </Section>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={T.passivePerception} value={R.passive(s, 'perception')} />
        <Stat label={T.passiveInvestigation} value={R.passive(s, 'investigation')} />
        <Stat label={T.passiveInsight} value={R.passive(s, 'insight')} />
      </div>
      {s.senses && <Section title={T.senses}><p className="text-sm text-zinc-300">{s.senses}</p></Section>}
    </>
  )
}

function RollRow({ label, hint, bonus, prof, onRoll }: { label: string; hint?: string; bonus: number; prof: number; onRoll: () => void }) {
  return (
    <button onClick={onRoll} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left active:bg-zinc-800">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${prof >= 2 ? 'border-amber-300 bg-amber-300 ring-2 ring-amber-300/40' : prof >= 1 ? 'border-amber-400 bg-amber-400' : prof > 0 ? 'border-amber-400 bg-amber-400/40' : 'border-zinc-600'}`} />
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
        {label} {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </span>
      <span className="w-10 text-right font-bold tabular-nums text-zinc-50">{signed(bonus)}</span>
    </button>
  )
}

// ---------------------------------------------------------------- Kouzla

function SpellsTab({ c, patch, read }: { c: Character; patch: Props['patch']; read: (t: ReactNode, b: ReactNode) => void }) {
  const s = c.sheet
  const st = c.state
  const sc = s.spellcasting!
  const srd = useSpells()
  const { rollAndLog } = useRoller()
  const [showAll, setShowAll] = useState(false)
  const dc = R.spellDc(s)!
  const atk = R.spellAttack(s)! + R.d20Penalty(st)
  const levels = [...new Set(sc.spells.map((x) => x.level))].sort((a, b) => a - b)
  const hasUnprepared = sc.spells.some((x) => !x.prepared && x.level > 0)

  const openSpell = (name: string, key: string, own: string) => {
    const e = key ? srd?.get(key) : undefined
    read(name, e ? <SpellText e={e} /> : own ? <Prose text={own} /> : <p className="text-zinc-500">Text kouzla na kartě chybí.</p>)
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={T.spellDc} value={dc} />
        <Stat label={T.spellAttack} value={signed(atk)} onClick={() => rollAndLog(T.spellAttack, d20(atk))} />
        <Stat label="Vlastnost" value={ABILITY[sc.ability].short} />
      </div>
      <Section title={T.slots}>
        <div className="space-y-2">
          {sc.slots.map((n, i) =>
            n > 0 ? (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">{i + 1}. úroveň</span>
                <Pips label={`Pozice ${i + 1}. úrovně`} total={n} used={st.slotsUsed[i] ?? 0} onChange={(u) => patch({ slotsUsed: st.slotsUsed.map((x, j) => (j === i ? u : x)) })} />
              </div>
            ) : null
          )}
          {sc.pact && sc.pact.count > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {T.pact} ({sc.pact.level}. úr.)
              </span>
              <Pips label={T.pact} total={sc.pact.count} used={st.pactUsed} onChange={(u) => patch({ pactUsed: u })} />
            </div>
          )}
        </div>
      </Section>
      {hasUnprepared && (
        <label className="flex items-center gap-2 px-1 text-sm text-zinc-400">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Ukázat i nepřipravená
        </label>
      )}
      {levels.map((lvl) => (
        <Section key={lvl} title={lvl === 0 ? T.cantrips : `${lvl}. úroveň`}>
          <ul className="divide-y divide-zinc-800">
            {sc.spells
              .filter((x) => x.level === lvl && (showAll || x.prepared || x.level === 0))
              .map((sp) => {
                const e = sp.srd ? srd?.get(sp.srd) : undefined
                return (
                  <li key={sp.id} className="flex items-center gap-2 py-1.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openSpell(sp.name, sp.srd, sp.text)}>
                      <span className={`block truncate text-sm ${sp.prepared || lvl === 0 ? 'text-zinc-100' : 'text-zinc-500'}`}>{sp.name}</span>
                      {e && (
                        <span className="block truncate text-xs text-zinc-500">
                          {csMeta(e.time)} · {csMeta(e.range)}
                          {e.concentration ? ' · soustředění' : ''}
                          {e.ritual ? ' · rituál' : ''}
                        </span>
                      )}
                    </button>
                    {e?.concentration && (
                      <button
                        onClick={() => patch({ concentration: sp.name })}
                        className={`rounded border px-1.5 py-0.5 text-xs ${st.concentration === sp.name ? 'border-violet-400 text-violet-200' : 'border-zinc-700 text-zinc-500'}`}
                        title="Soustředím se"
                      >
                        ◎
                      </button>
                    )}
                  </li>
                )
              })}
          </ul>
        </Section>
      ))}
    </>
  )
}

function SpellText({ e }: { e: SrdSpell }) {
  const czech = !!e.textCs
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400">
        {e.level === 0 ? 'Trik' : `${e.level}. úroveň`}, {SCHOOL[e.school] ?? e.school}
        {e.ritual ? ', rituál' : ''}
        <br />
        Seslání: {csMeta(e.time)} · Dosah: {csMeta(e.range)} · Složky: {e.componentsCs ?? e.components} · Trvání: {e.concentration ? 'soustředění, ' : ''}
        {csMeta(e.duration)}
      </p>
      <Prose text={e.textCs ?? e.text} />
      {(e.higherCs ?? e.higher) && (
        <div>
          <p className="font-semibold text-zinc-100">Na vyšší úrovni</p>
          <Prose text={e.higherCs ?? e.higher} />
        </div>
      )}
      <p className="text-[11px] text-zinc-600">
        {czech ? '' : 'Zatím anglicky, český překlad je ve frontě. '}
        {e.name} · SRD 5.2, CC-BY-4.0
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- Schopnosti

function FeaturesTab({ s, read }: { s: Sheet; read: (t: ReactNode, b: ReactNode) => void }) {
  const groups = new Map<string, typeof s.features>()
  for (const f of s.features) {
    const g = f.source.replace(/\s*\d+$/, '') || 'Ostatní'
    groups.set(g, [...(groups.get(g) ?? []), f])
  }
  return (
    <>
      {[...groups].map(([g, list]) => (
        <Section key={g} title={g}>
          <ul className="divide-y divide-zinc-800">
            {list.map((f) => (
              <li key={f.id}>
                <button className="w-full py-2 text-left" onClick={() => read(f.name, f.text ? <Prose text={f.text} /> : <p className="text-zinc-500">Bez popisu.</p>)}>
                  <span className="block text-sm font-semibold text-zinc-100">
                    {f.name} {f.textEn && f.text === f.textEn && <span className="text-xs font-normal text-amber-500">zatím anglicky</span>}
                  </span>
                  {f.text && <span className="line-clamp-2 block text-xs text-zinc-400">{f.text}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      {s.features.length === 0 && <p className="px-1 text-sm text-zinc-500">Žádné schopnosti na kartě.</p>}
      {s.proficiencies && (
        <Section title={T.proficiencies}>
          <Prose text={s.proficiencies} />
        </Section>
      )}
      {s.notes && (
        <Section title={T.notes}>
          <Prose text={s.notes} />
        </Section>
      )}
    </>
  )
}
