import type { Roll } from '@/lib/types'
import { DetailText } from './Roller'

const time = (iso: string) => new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

export function RollLog({ rolls, meId }: { rolls: Roll[]; meId?: string | null }) {
  if (!rolls.length) return <p className="py-6 text-center text-sm text-zinc-500">Zatím nikdo nehodil.</p>
  return (
    <ul className="divide-y divide-zinc-800">
      {rolls.map((r) => {
        const nat = r.detail?.nat
        return (
          <li key={r.id} className={`flex items-center gap-3 py-2 ${r.characterId && r.characterId === meId ? 'bg-amber-500/5' : ''}`}>
            <span
              className={`w-12 shrink-0 text-center text-2xl font-bold tabular-nums ${nat === 20 ? 'text-amber-300' : nat === 1 ? 'text-red-400' : 'text-zinc-100'}`}
            >
              {r.total}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-zinc-100">
                <span className="font-semibold">{r.who}</span> · {r.label}
                {r.hidden && <span className="ml-1 rounded bg-zinc-700 px-1 text-[10px] uppercase text-zinc-300">skrytý</span>}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                <DetailText detail={r.detail} formula={r.formula} />
              </span>
            </span>
            <span className="shrink-0 text-xs text-zinc-600">{time(r.createdAt)}</span>
          </li>
        )
      })}
    </ul>
  )
}
