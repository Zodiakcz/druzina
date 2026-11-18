import { useState } from 'react'
import type { HpDetail, Roll, RollDetail } from '@/lib/types'
import { DetailText } from './Roller'

const time = (iso: string) => new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

/** How a non-dice entry shows its number. */
const EVENT_STYLE: Record<string, { sign: string; color: string }> = {
  damage: { sign: '−', color: 'text-red-400' },
  heal: { sign: '+', color: 'text-emerald-400' },
  temp: { sign: '+', color: 'text-sky-300' },
}

function Total({ r }: { r: Roll }) {
  if (r.kind === 'rest') return <span className="text-xl text-zinc-400">☾</span>
  const ev = EVENT_STYLE[r.kind]
  if (ev) return <span className={ev.color}>{`${ev.sign}${r.total}`}</span>
  const nat = (r.detail as RollDetail | null)?.nat
  return <span className={nat === 20 ? 'text-amber-300' : nat === 1 ? 'text-red-400' : 'text-zinc-100'}>{r.total}</span>
}

function Sub({ r }: { r: Roll }) {
  if (!r.kind || r.kind === 'roll') return <DetailText detail={r.detail as RollDetail | null} formula={r.formula} />
  const hp = r.detail as HpDetail | null
  return hp && typeof hp.from === 'number' && hp.from !== hp.to ? <>{`životy ${hp.from} → ${hp.to}`}</> : null
}

export function RollLog({ rolls, meId, hasMore, onLoadMore }: {
  rolls: Roll[]
  meId?: string | null
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  if (!rolls.length) return <p className="py-6 text-center text-sm text-zinc-500">Zatím nikdo nehodil.</p>
  return (
    <>
      <ul className="divide-y divide-zinc-800">
        {rolls.map((r) => (
          <li key={r.id} className={`flex items-center gap-3 py-2 ${r.characterId && r.characterId === meId ? 'bg-amber-500/5' : ''}`}>
            <span className="w-12 shrink-0 text-center text-2xl font-bold tabular-nums">
              <Total r={r} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-zinc-100">
                <span className="font-semibold">{r.who}</span> · {r.label}
                {r.hidden && <span className="ml-1 rounded bg-zinc-700 px-1 text-[10px] uppercase text-zinc-300">skrytý</span>}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                <Sub r={r} />
              </span>
            </span>
            <span className="shrink-0 text-xs text-zinc-600">{time(r.createdAt)}</span>
          </li>
        ))}
      </ul>
      {hasMore && onLoadMore && (
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            try {
              await onLoadMore()
            } finally {
              setLoading(false)
            }
          }}
          className="mt-2 w-full rounded-lg border border-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? 'Načítám…' : 'Starší záznamy'}
        </button>
      )}
    </>
  )
}
