// One character on the GM and party screens: the numbers a GM asks for most.
import type { Character } from '@/lib/types'
import { CONDITIONS, T } from '@/lib/cs'
import { classLine, passive, totalLevel } from '@/lib/rules'

export function Portrait({ c, size = 56 }: { c: Character; size?: number }) {
  const initials = c.sheet.name
    .replace(/^Ukázka:\s*/, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  return c.sheet.portrait ? (
    <img src={c.sheet.portrait} alt="" width={size} height={size} className="shrink-0 rounded-lg border border-zinc-700 object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 font-display text-xl text-amber-200" style={{ width: size, height: size }}>
      {initials}
    </div>
  )
}

export function HpBar({ hp, max, temp }: { hp: number; max: number; temp: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0
  const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      {temp > 0 && <div className="-mt-1.5 h-1.5 bg-sky-400/70" style={{ width: `${Math.min(100, (temp / Math.max(max, 1)) * 100)}%` }} />}
    </div>
  )
}

export function PartyCard({ c, onOpen, actions }: { c: Character; onOpen?: () => void; actions?: React.ReactNode }) {
  const { sheet: s, state: st } = c
  const dying = st.hp <= 0
  const conditionNames = st.conditions.map((id) => CONDITIONS.find((x) => x.id === id)?.name ?? id)
  return (
    <div className={`rounded-xl border bg-zinc-900/70 p-3 ${dying ? 'border-red-800' : 'border-zinc-800'}`}>
      <button onClick={onOpen} disabled={!onOpen} className="flex w-full items-start gap-3 text-left">
        <Portrait c={c} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-display text-lg text-zinc-50">{s.name}</h3>
            <span className={`shrink-0 text-lg font-bold tabular-nums ${dying ? 'text-red-400' : 'text-zinc-50'}`}>
              {st.hp}
              <span className="text-sm text-zinc-500">/{s.hpMax}</span>
              {st.temp > 0 && <span className="ml-1 text-sm text-sky-300">+{st.temp}</span>}
            </span>
          </div>
          <p className="truncate text-xs text-zinc-400">
            {T.level} {totalLevel(s)} · {s.species} · {classLine(s)}
          </p>
          {s.player && <p className="truncate text-xs text-zinc-500">Hráč: {s.player}</p>}
          <div className="mt-1.5">
            <HpBar hp={st.hp} max={s.hpMax} temp={st.temp} />
          </div>
        </div>
      </button>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center">
        {[
          [T.acShort, s.ac],
          ['Vnímání', passive(s, 'perception')],
          ['Pátrání', passive(s, 'investigation')],
          ['Vhled', passive(s, 'insight')],
        ].map(([label, v]) => (
          <div key={label as string}>
            <div className="text-xl font-bold tabular-nums text-zinc-100">{v}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
          </div>
        ))}
      </div>
      {(dying || conditionNames.length > 0 || st.exhaustion > 0 || st.concentration || st.heroic) && (
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {dying && (
            <span className="rounded bg-red-900 px-1.5 py-0.5 text-red-100">
              Umírá · ✓{st.death.ok} ✗{st.death.fail}
            </span>
          )}
          {conditionNames.map((n) => (
            <span key={n} className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-100">
              {n}
            </span>
          ))}
          {st.exhaustion > 0 && <span className="rounded bg-orange-900 px-1.5 py-0.5 text-orange-100">{T.exhaustion} {st.exhaustion}</span>}
          {st.concentration && <span className="rounded bg-violet-900 px-1.5 py-0.5 text-violet-100">◎ {st.concentration}</span>}
          {st.heroic && <span className="rounded bg-amber-800 px-1.5 py-0.5 text-amber-100">★ Inspirace</span>}
        </div>
      )}
      {s.senses && <p className="mt-2 truncate text-xs text-zinc-500">{s.senses}</p>}
      {actions && <div className="mt-2 flex flex-wrap gap-2 border-t border-zinc-800 pt-2">{actions}</div>}
    </div>
  )
}
