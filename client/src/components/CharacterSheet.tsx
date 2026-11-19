// The play sheet. Used by a player on their phone and by the GM for any character.
import { useRef, useState, type ReactNode } from 'react'
import type { Ability, Character, Sheet, Skill, State } from '@/lib/types'
import { ABILITIES, SKILLS } from '@/lib/types'
import { ABILITY, CONDITIONS, EXHAUSTION_TEXT, SKILL, T, signed } from '@/lib/cs'
import * as R from '@/lib/rules'
import { addToFormula, critFormula, d20, type Mode } from '@/lib/dice'
import { activeEffects, boost, describeEffect, labelWith, spendResource, toggleEffect, type Boost } from '@/lib/effects'
import { SCHOOL, csMeta, useSpells, type SrdSpell } from '@/lib/srd'
import { useRoller, DiceFab } from './Roller'
import { RollLog } from './RollLog'
import { InventoryTab } from './Inventory'
import { HpBar, Portrait } from './PartyCard'
import { Button, DieIcon, Modal, More, Pips, Prose, RollButton, Section, Stat } from './ui'
import type { Roll } from '@/lib/types'

type Tab = 'boj' | 'vlastnosti' | 'kouzla' | 'schopnosti' | 'vybava' | 'log'

/** Writes a non-dice entry (damage, heal, temp HP, rest) to the shared log. */
export type LogEvent = (e: {
  kind: 'damage' | 'heal' | 'temp' | 'rest' | 'item' | 'gold'
  label: string
  total: number
  detail: { from: number; to: number } | null
}) => void

interface Props {
  c: Character
  rolls: Roll[]
  patch: (p: Partial<State>) => void
  log: LogEvent
  onEdit?: () => void
  hasMoreRolls?: boolean
  onLoadMore?: () => Promise<void>
}

export function CharacterSheet({ c, rolls, patch, log, onEdit, hasMoreRolls, onLoadMore }: Props) {
  const [tab, setTab] = useState<Tab>('boj')
  const [reading, setReading] = useState<{ title: ReactNode; body: ReactNode } | null>(null)
  const s = c.sheet
  const st = c.state
  const tabs: [Tab, string][] = [
    ['boj', 'Boj'],
    ['vlastnosti', 'Vlastnosti'],
    ...(s.spellcasting ? ([['kouzla', T.spells]] as [Tab, string][]) : []),
    ['schopnosti', T.features],
    ['vybava', 'Výbava'],
    ['log', 'Log'],
  ]
  const read = (title: ReactNode, body: ReactNode) => setReading({ title, body })
  // Which way the new tab slides in: 1 from the right, -1 from the left.
  const [dir, setDir] = useState(0)
  const go = (next: Tab) => {
    const from = tabs.findIndex(([id]) => id === tab)
    const to = tabs.findIndex(([id]) => id === next)
    if (to < 0 || to === from) return
    setDir(to > from ? 1 : -1)
    setTab(next)
    window.scrollTo({ top: 0 })
  }
  const swipe = useSwipe((step) => {
    const i = tabs.findIndex(([id]) => id === tab) + step
    if (i >= 0 && i < tabs.length) go(tabs[i][0])
  })

  return (
    <div className="min-h-[80vh] pb-36" {...swipe}>
      <Header c={c} patch={patch} onEdit={onEdit} />
      <div key={tab} className={`mt-3 space-y-3 ${dir > 0 ? 'animate-[slidein-r_.18s_ease-out]' : dir < 0 ? 'animate-[slidein-l_.18s_ease-out]' : ''}`}>
        {tab === 'boj' && <CombatTab c={c} patch={patch} log={log} read={read} />}
        {tab === 'vlastnosti' && <AbilitiesTab s={s} st={st} />}
        {tab === 'kouzla' && s.spellcasting && <SpellsTab c={c} patch={patch} read={read} />}
        {tab === 'schopnosti' && <FeaturesTab s={s} read={read} />}
        {tab === 'vybava' && <InventoryTab c={c} patch={patch} log={log} />}
        {tab === 'log' && (
          <Section title="Log hodů">
            <RollLog rolls={rolls} meId={c.id} hasMore={hasMoreRolls} onLoadMore={onLoadMore} />
          </Section>
        )}
      </div>
      {/* The dice bar is not a swipe area: dragging in the tray must not change the tab. */}
      <div data-noswipe>
        <DiceFab />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={`min-w-0 flex-1 truncate px-0.5 py-3 text-[11px] font-semibold ${tab === id ? 'text-amber-300' : 'text-zinc-500'}`}
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

/**
 * Horizontal swipe on a phone moves between tabs (left = next). Ignored when it starts in a
 * dialog, a field or anything marked data-noswipe, and when the finger moved mostly vertically.
 */
function useSwipe(onStep: (step: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const el = e.target as HTMLElement
      if (e.touches.length !== 1 || el.closest('[role="dialog"], input, textarea, select, [data-noswipe]')) {
        start.current = null
        return
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.changedTouches[0].clientX - s.x
      const dy = e.changedTouches[0].clientY - s.y
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - s.t < 800) onStep(dx < 0 ? 1 : -1)
    },
  }
}

function Header({ c, patch, onEdit }: { c: Character; patch: Props['patch']; onEdit?: () => void }) {
  const s = c.sheet
  const st = c.state
  const { rollAndLog } = useRoller()
  const init = R.initiative(s) + R.d20Penalty(st)
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
      {/* On every tab: initiative is rolled whenever a fight starts, wherever the player is. */}
      <RollButton caption={T.initiative} onClick={() => rollAndLog(T.initiative, d20(init))} className="!px-3 !py-2 text-xl">
        {signed(init)}
      </RollButton>
    </div>
  )
}

// ---------------------------------------------------------------- Boj

function CombatTab({ c, patch, log, read }: { c: Character; patch: Props['patch']; log: LogEvent; read: (t: ReactNode, b: ReactNode) => void }) {
  const s = c.sheet
  const st = c.state
  const { rollAndLog } = useRoller()
  const pen = R.d20Penalty(st)
  const acB = boost(s, st, 'ac')
  const speedB = boost(s, st, 'speed')
  return (
    <>
      <HpPanel c={c} patch={patch} log={log} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label={T.ac} value={s.ac + acB.flat} sub={acB.flat ? acB.names.join(', ') : undefined} />
        <Stat label={T.speed} value={Math.max(0, R.effectiveSpeed(s, st) + speedB.flat)} sub="stop" />
        <Stat label={T.prof} value={signed(R.profBonus(s))} />
      </div>
      {st.hp <= 0 && <DeathSaves c={c} patch={patch} log={log} />}
      {(s.effects ?? []).length > 0 && <Effects c={c} patch={patch} read={read} />}

      <Section title={T.attacks}>
        {s.attacks.length === 0 && <p className="text-sm text-zinc-500">Žádné útoky na kartě.</p>}
        <ul className="space-y-2">
          {s.attacks.map((a) => {
            const hitB = boost(s, st, 'attack', a.ability)
            const dmgB = boost(s, st, 'damage', a.ability)
            const hit = a.toHit === null ? null : a.toHit + pen + hitB.flat
            const hitFormula = hit === null ? '' : addToFormula(d20(hit), 0, hitB.dice)
            const damage = a.damage ? addToFormula(a.damage, dmgB.flat, dmgB.dice) : ''
            const boosted = [...new Set([...hitB.names, ...dmgB.names])]
            return (
              <li key={a.id} className="rounded-lg bg-zinc-900 p-2">
                {(() => {
                  const hasDice = /d/i.test(damage)
                  const dmgLabel = labelWith(`${a.name}: zranění`, dmgB)
                  const critLabel = labelWith(`${a.name}: kritický zásah`, dmgB)
                  const followUps = damage
                    ? [
                        { label: T.damageShort, formula: damage, tag: 'damage' as const, rollLabel: dmgLabel },
                        ...(hasDice ? [{ label: T.critShort, formula: critFormula(damage), tag: 'crit' as const, rollLabel: critLabel }] : []),
                      ]
                    : []
                  const head = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-zinc-100">{a.name}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {damage.replace(/d/g, 'k')} {a.damageType}
                          {boosted.length > 0 && <span className="text-amber-400"> · {boosted.join(', ')}</span>}
                        </span>
                      </span>
                      {a.notes && <More />}
                    </>
                  )
                  return (
                    <>
                      {a.notes ? (
                        <button className="flex w-full items-center text-left" onClick={() => read(a.name, <Prose text={a.notes} />)}>
                          {head}
                        </button>
                      ) : (
                        <div className="flex items-center">{head}</div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {hit !== null && (
                          <RollButton
                            caption={T.tagAttack}
                            tone="amber"
                            onClick={() => rollAndLog(labelWith(`${a.name}: útok`, hitB), hitFormula, { tag: 'attack', followUps, mode: hitB.mode })}
                          >
                            <span className="flex items-center gap-1">
                              <ModeMark mode={hitB.mode} />
                              {signed(hit)}
                              {hitB.dice && <span className="text-sm">{hitB.dice.replace(/d/g, 'k')}</span>}
                            </span>
                          </RollButton>
                        )}
                        {damage && (
                          <RollButton caption={T.tagDamage} tone="red" onClick={() => rollAndLog(dmgLabel, damage, { d20: false, tag: 'damage' })}>
                            {damage.replace(/d/g, 'k')}
                          </RollButton>
                        )}
                        {hasDice && (
                          <RollButton caption={T.tagCrit} tone="crit" onClick={() => rollAndLog(critLabel, critFormula(damage), { d20: false, tag: 'crit' })}>
                            {critFormula(damage).replace(/d/g, 'k')}
                          </RollButton>
                        )}
                      </div>
                    </>
                  )
                })()}
              </li>
            )
          })}
        </ul>
      </Section>

      {s.resources.length > 0 && <Resources c={c} patch={patch} read={read} />}

      <Conditions c={c} patch={patch} read={read} />
      <Rests c={c} patch={patch} log={log} />
    </>
  )
}

const RESOURCES_HELP =
  'Schopnosti, které jdou použít jen několikrát (třeba Zuřivost nebo Bardská inspirace). Plné kolečko je použití, které máš. Klepnutím ho utratíš, klepnutím na prázdné ho vrátíš. Odpočinek uvedený u zdroje je všechny vrátí.'

/** The feature a resource comes from, so its rules text can be shown. */
function featureFor(s: Sheet, r: Sheet['resources'][number]) {
  const names = [r.name, r.nameEn].filter(Boolean).map((n) => n!.toLowerCase())
  return (
    s.features.find((f) => names.includes(f.name.toLowerCase()) || (!!f.nameEn && names.includes(f.nameEn.toLowerCase()))) ??
    s.features.find((f) => names.some((n) => f.name.toLowerCase().startsWith(n) || (f.nameEn ?? '').toLowerCase().startsWith(n)))
  )
}

function Resources({ c, patch, read }: { c: Character; patch: Props['patch']; read: (t: ReactNode, b: ReactNode) => void }) {
  const s = c.sheet
  const st = c.state
  const open = (r: Sheet['resources'][number]) => {
    const f = featureFor(s, r)
    const used = st.resources[r.id] ?? 0
    read(
      r.name,
      <div className="space-y-3">
        <p className="text-zinc-300">
          Zbývá <b className="text-zinc-50">{r.max - used}</b> z {r.max}. Obnoví {r.reset === 'short' ? 'krátký i dlouhý' : 'jen dlouhý'} odpočinek.
        </p>
        {f?.text ? <Prose text={f.text} /> : <p className="text-zinc-500">Popis schopnosti na kartě chybí.</p>}
        {f && f.textEn && f.text === f.textEn && <p className="text-xs text-amber-500">Zatím anglicky.</p>}
      </div>
    )
  }
  return (
    <Section
      title={T.resources}
      right={
        <button
          onClick={() => read(T.resources, <p>{RESOURCES_HELP}</p>)}
          aria-label="Co jsou zdroje"
          className="h-6 w-6 rounded-full border border-zinc-700 text-xs text-zinc-400"
        >
          ?
        </button>
      }
    >
      <ul className="space-y-2">
        {s.resources.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <button onClick={() => open(r)} className="flex min-w-0 flex-1 items-center text-left">
              <span className="min-w-0 flex-1 text-sm text-zinc-200">
                {r.name} <span className="text-xs text-zinc-500">({r.reset === 'short' ? 'krátký odp.' : 'dlouhý odp.'})</span>
              </span>
              <More />
            </button>
            <Pips
              label={r.name}
              total={r.max}
              used={st.resources[r.id] ?? 0}
              onChange={(used) => patch(spendResource(s, st, r.id, used))}
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Small green V / red N next to a roll that an effect gives advantage or disadvantage. */
function ModeMark({ mode }: { mode: Mode }) {
  if (mode === 'normal') return null
  return (
    <span
      title={mode === 'adv' ? T.advantage : T.disadvantage}
      className={`rounded px-1 text-[10px] font-bold leading-4 text-white ${mode === 'adv' ? 'bg-emerald-700' : 'bg-red-800'}`}
    >
      {mode === 'adv' ? 'V' : 'N'}
    </span>
  )
}

const EFFECTS_HELP =
  'Schopnosti, které na chvíli mění jiné hody (Zuřivost, Bezohledný útok, Požehnání). Klepnutím efekt zapneš a vypneš. Zapnutý efekt se sám přičte k útokům, zranění, ověřením a záchranným hodům, na které míří. Když je efekt navázaný na zdroj, zapnutí utratí jedno použití (a utracení použití ho zapne). Délku nehlídá: vypni ho, až skončí. Odpočinek vypne všechny.'

function Effects({ c, patch, read }: { c: Character; patch: Props['patch']; read: (t: ReactNode, b: ReactNode) => void }) {
  const s = c.sheet
  const st = c.state
  const on = activeEffects(s, st)
  return (
    <Section
      title={T.effects}
      right={
        <button onClick={() => read(T.effects, <p>{EFFECTS_HELP}</p>)} aria-label="Co jsou efekty" className="h-6 w-6 rounded-full border border-zinc-700 text-xs text-zinc-400">
          ?
        </button>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {s.effects.map((e) => {
          const active = on.includes(e)
          const r = s.resources.find((x) => x.id === e.resourceId)
          const left = r ? r.max - (st.resources[r.id] ?? 0) : null
          return (
            <button
              key={e.id}
              onClick={() => patch(toggleEffect(s, st, e.id))}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${active ? 'border-amber-400 bg-amber-500 text-zinc-950' : 'border-zinc-700 text-zinc-300'}`}
            >
              {active ? '● ' : ''}
              {e.name}
              {left !== null && !active && <span className="ml-1 text-xs font-normal text-zinc-500">({left})</span>}
              {active && ' ×'}
            </button>
          )
        })}
      </div>
      {on.length > 0 && (
        <ul className="mt-2 space-y-1">
          {on.map((e) => (
            <li key={e.id} className="text-xs text-amber-200/90">
              <b>{e.name}:</b> {describeEffect(s, e)}
              {e.text && <span className="block text-zinc-400">{e.text}</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function HpPanel({ c, patch, log }: { c: Character; patch: Props['patch']; log: LogEvent }) {
  const s = c.sheet
  const st = c.state
  const [mode, setMode] = useState<'damage' | 'heal' | 'temp' | null>(null)
  const [value, setValue] = useState('')
  const apply = () => {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n) || n <= 0) return
    if (mode === 'damage') {
      const next = R.applyDamage(st, n)
      patch(next)
      const absorbed = st.temp - next.temp
      log({
        kind: 'damage',
        label: absorbed > 0 ? `zranění (${absorbed} z dočasných)` : 'zranění',
        total: n,
        detail: { from: st.hp, to: next.hp },
      })
    } else if (mode === 'heal') {
      const next = R.applyHealing(s, st, n)
      patch(next)
      log({ kind: 'heal', label: 'léčení', total: n, detail: { from: st.hp, to: next.hp ?? st.hp } })
    } else if (mode === 'temp') {
      patch({ temp: Math.max(st.temp, n) })
      log({ kind: 'temp', label: 'dočasné životy', total: n, detail: null })
    }
    setValue('')
    setMode(null)
  }
  const resists = mode === 'damage' ? activeEffects(s, st).filter((e) => e.resist) : []
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
          {resists.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 text-sm text-amber-200">{resists.map((e) => `${e.name}: odolnost (${e.resist}), takové zranění je poloviční`).join('. ')}.</p>
              <Button disabled={!(parseInt(value, 10) > 1)} onClick={() => setValue(String(Math.floor((parseInt(value, 10) || 0) / 2)))}>
                ½
              </Button>
            </div>
          )}
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

function DeathSaves({ c, patch, log }: { c: Character; patch: Props['patch']; log: LogEvent }) {
  const { death } = c.state
  const { rollAndLog } = useRoller()
  // House rule of the group: a stabilized character wakes with 1 HP at once (the book says
  // 0 HP and stable, 1 HP after 1k4 hours). A natural 20 does the same.
  const backToOne = (label: string) => {
    patch({ hp: 1, death: { ok: 0, fail: 0 } })
    log({ kind: 'heal', label, total: 1, detail: { from: 0, to: 1 } })
  }
  const setOk = (ok: number) => (ok >= 3 ? backToOne('stabilizace') : patch({ death: { ...death, ok } }))
  const rollSave = () => {
    // The outcome lands when the die stops: nat 20 back with 1 HP, nat 1 two failures, 10+ success.
    rollAndLog(T.death, d20(R.d20Penalty(c.state)), {
      onReveal: (r) => {
        const nat = r.detail.nat
        if (nat === 20) backToOne('přirozená 20 proti smrti')
        else if (nat === 1) patch({ death: { ...death, fail: Math.min(3, death.fail + 2) } })
        else if (r.total >= 10) setOk(death.ok + 1)
        else patch({ death: { ...death, fail: Math.min(3, death.fail + 1) } })
      },
    })
  }
  return (
    <Section title={T.death} right={<Button onClick={rollSave}>Hodit</Button>}>
      <div className="flex items-center justify-around">
        <div className="text-center">
          <Pips label="Úspěch" total={3} used={death.ok} onChange={setOk} />
          <div className="mt-1 text-xs text-emerald-400">úspěchy</div>
        </div>
        <div className="text-center">
          <Pips label="Neúspěch" total={3} used={death.fail} onChange={(fail) => patch({ death: { ...death, fail } })} />
          <div className="mt-1 text-xs text-red-400">neúspěchy</div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">Třetí úspěch tě stabilizuje a vrátí na 1 život.</p>
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

function Rests({ c, patch, log }: { c: Character; patch: Props['patch']; log: LogEvent }) {
  const s = c.sheet
  const st = c.state
  const { rollAndLog } = useRoller()
  const [confirm, setConfirm] = useState<'short' | 'long' | null>(null)
  // Hit dice chosen for this short rest, per die size.
  const [spend, setSpend] = useState<Record<number, number>>({})
  const conMod = R.abilityMod(s, 'con')
  const left = (die: number) => (s.hitDice.find((h) => h.die === die)?.count ?? 0) - (st.hitDiceUsed[die] ?? 0)
  const dice = s.hitDice.filter((h) => (spend[h.die] ?? 0) > 0)
  const count = dice.reduce((n, h) => n + spend[h.die], 0)
  const formula = R.hitDiceFormula(dice.map((h) => ({ die: h.die, count: spend[h.die] })), conMod)

  const open = (kind: 'short' | 'long') => {
    setSpend({})
    setConfirm(kind)
  }

  const rest = () => {
    if (confirm === 'long') {
      const next = R.longRest(s, st)
      patch(next)
      log({ kind: 'rest', label: 'dlouhý odpočinek', total: 0, detail: { from: st.hp, to: next.hp ?? st.hp } })
    } else if (!count) {
      patch(R.shortRest(s, st))
      log({ kind: 'rest', label: 'krátký odpočinek', total: 0, detail: { from: st.hp, to: st.hp } })
    } else {
      // One roll for all the dice; the rest and the healing land when it is revealed.
      const used = { ...st.hitDiceUsed }
      for (const h of dice) used[h.die] = (used[h.die] ?? 0) + spend[h.die]
      rollAndLog(`${T.shortRest}: ${T.hitDice.toLowerCase()}`, formula, {
        d20: false,
        onReveal: (r) => {
          const heal = R.applyHealing(s, st, Math.max(0, r.total))
          patch({ ...R.shortRest(s, st), ...heal, hitDiceUsed: used })
          log({ kind: 'rest', label: 'krátký odpočinek', total: 0, detail: { from: st.hp, to: heal.hp ?? st.hp } })
        },
      })
    }
    setConfirm(null)
  }

  return (
    <Section title="Odpočinek">
      {s.hitDice.length > 0 && (
        <p className="mb-2 text-sm text-zinc-400">
          {T.hitDice}:{' '}
          {s.hitDice.map((h, i) => (
            <span key={h.die}>
              {i > 0 && ', '}
              <b className="tabular-nums text-zinc-100">{left(h.die)}</b>/{h.count} k{h.die}
            </span>
          ))}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => open('short')}>{T.shortRest}</Button>
        <Button onClick={() => open('long')}>{T.longRest}</Button>
      </div>
      {confirm && (
        <Modal
          title={confirm === 'short' ? T.shortRest : T.longRest}
          onClose={() => setConfirm(null)}
          footer={
            <Button kind="primary" className="w-full py-3" onClick={rest}>
              {confirm === 'short' && count ? `Odpočinout a hodit ${formula.replace(/d/g, 'k')}` : 'Odpočinout'}
            </Button>
          }
        >
          {confirm === 'short' ? (
            <div className="space-y-3">
              <p>Obnoví zdroje „na krátký odpočinek“ a magii paktu.</p>
              {s.hitDice.length > 0 && (
                <div>
                  <p className="mb-2 text-zinc-300">
                    Kolik kostek životů hodit? Každá vyléčí hod + {conMod >= 0 ? conMod : `(${conMod})`} za Odolnost.
                  </p>
                  {s.hitDice.map((h) => {
                    const n = spend[h.die] ?? 0
                    const max = left(h.die)
                    return (
                      <div key={h.die} className="flex items-center justify-between py-1">
                        <span className="text-zinc-200">
                          k{h.die} <span className="text-xs text-zinc-500">(zbývá {max})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Button disabled={n <= 0} onClick={() => setSpend({ ...spend, [h.die]: n - 1 })}>
                            −
                          </Button>
                          <span className="w-6 text-center text-lg font-bold tabular-nums">{n}</span>
                          <Button disabled={n >= max} onClick={() => setSpend({ ...spend, [h.die]: n + 1 })}>
                            +
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {st.hp >= s.hpMax && <p className="mt-1 text-xs text-zinc-500">Máš plné životy, kostky nejsou potřeba.</p>}
                </div>
              )}
            </div>
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
  // A d20 test with what the active effects add: bonus, extra dice, advantage, names in the label.
  const rollD20 = (label: string, bonus: number, b: Boost) => rollAndLog(labelWith(label, b), addToFormula(d20(bonus), 0, b.dice), { mode: b.mode })
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((a: Ability) => {
          const b = boost(s, st, 'check', a)
          const m = R.abilityMod(s, a) + pen + b.flat
          return (
            <button
              key={a}
              onClick={() => rollD20(`${ABILITY[a].name}: ověření`, m, b)}
              className="relative rounded-xl border border-amber-700/70 bg-amber-950/40 p-2 text-center hover:border-amber-500 active:bg-amber-900/60"
            >
              <DieIcon className="absolute right-2 top-2 h-3.5 w-3.5 text-amber-500/80" />
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">{ABILITY[a].name}</div>
              <div className="flex items-center justify-center gap-1 text-3xl font-bold tabular-nums text-zinc-50">
                <ModeMark mode={b.mode} />
                {signed(m)}
                {b.dice && <span className="text-sm">{b.dice.replace(/d/g, 'k')}</span>}
              </div>
              <div className="text-xs text-zinc-500">{s.abilities[a]}</div>
            </button>
          )
        })}
      </div>
      <Section title={T.saves}>
        <div className="grid grid-cols-2 gap-1">
          {ABILITIES.map((a) => {
            const fx = boost(s, st, 'save', a)
            const b = R.saveBonus(s, a) + pen + fx.flat
            return <RollRow key={a} label={ABILITY[a].name} bonus={b} fx={fx} prof={s.saves.includes(a) ? 1 : 0} onRoll={() => rollD20(`ZH ${ABILITY[a].name}`, b, fx)} />
          })}
        </div>
      </Section>
      <Section title={T.skills}>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {SKILLS.map((k: Skill) => {
            const fx = boost(s, st, 'check', R.SKILL_ABILITY[k])
            const b = R.skillBonus(s, k) + pen + fx.flat
            return (
              <RollRow
                key={k}
                label={SKILL[k]}
                hint={ABILITY[R.SKILL_ABILITY[k]].short}
                bonus={b}
                fx={fx}
                prof={s.skills[k] ?? 0}
                onRoll={() => rollD20(SKILL[k], b, fx)}
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

function RollRow({ label, hint, bonus, fx, prof, onRoll }: { label: string; hint?: string; bonus: number; fx?: Boost; prof: number; onRoll: () => void }) {
  return (
    <button onClick={onRoll} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-zinc-800/60 active:bg-zinc-800">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${prof >= 2 ? 'border-amber-300 bg-amber-300 ring-2 ring-amber-300/40' : prof >= 1 ? 'border-amber-400 bg-amber-400' : prof > 0 ? 'border-amber-400 bg-amber-400/40' : 'border-zinc-600'}`} />
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
        {label} {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </span>
      {fx && <ModeMark mode={fx.mode} />}
      <span className="flex min-w-12 shrink-0 items-center justify-center gap-0.5 rounded-md border border-amber-700/70 bg-amber-950/40 px-1 py-0.5 font-bold tabular-nums text-zinc-50">
        <DieIcon className="h-3 w-3 text-amber-500/80" />
        {signed(bonus)}
        {fx?.dice && <span className="text-xs">{fx.dice.replace(/d/g, 'k')}</span>}
      </span>
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
  const atkB = boost(s, st, 'attack', sc.ability)
  const atk = R.spellAttack(s)! + R.d20Penalty(st) + atkB.flat
  const blocked = activeEffects(s, st).find((e) => e.noSpells)
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
        <Stat
          label={T.spellAttack}
          value={signed(atk) + atkB.dice.replace(/d/g, 'k')}
          onClick={() => rollAndLog(labelWith(T.spellAttack, atkB), addToFormula(d20(atk), 0, atkB.dice), { mode: atkB.mode })}
        />
        <Stat label="Vlastnost" value={ABILITY[sc.ability].short} />
      </div>
      {blocked && (
        <p className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {blocked.name}: teď nemůžeš sesílat kouzla ani se soustředit.
        </p>
      )}
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
                    <button className="flex min-w-0 flex-1 items-center text-left" onClick={() => openSpell(sp.name, sp.srd, sp.text)}>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${sp.prepared || lvl === 0 ? 'text-zinc-100' : 'text-zinc-500'}`}>{sp.name}</span>
                        {e && (
                          <span className="block truncate text-xs text-zinc-500">
                            {csMeta(e.time)} · {csMeta(e.range)}
                            {e.concentration ? ' · soustředění' : ''}
                            {e.ritual ? ' · rituál' : ''}
                          </span>
                        )}
                      </span>
                      <More />
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
                <button className="flex w-full items-center py-2 text-left" onClick={() => read(f.name, f.text ? <Prose text={f.text} /> : <p className="text-zinc-500">Bez popisu.</p>)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-100">
                      {f.name} {f.textEn && f.text === f.textEn && <span className="text-xs font-normal text-amber-500">zatím anglicky</span>}
                    </span>
                    {f.text && <span className="line-clamp-2 block text-xs text-zinc-400">{f.text}</span>}
                  </span>
                  <More />
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
