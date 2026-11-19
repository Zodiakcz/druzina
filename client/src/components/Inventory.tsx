import { useState, type ReactNode } from 'react'
import type { Character, Coin, InventoryItem, State } from '@/lib/types'
import { Button, Modal, More, Prose, Section } from './ui'
import type { LogEvent } from './CharacterSheet'

type Patch = (p: Partial<State>) => void

const COINS: { coin: Coin; abbr: string; name: string; added: string; spent: string }[] = [
  { coin: 'pp', abbr: 'pl', name: 'platina', added: 'platina přidána', spent: 'platina utracena' },
  { coin: 'gp', abbr: 'zl', name: 'zlaťáky', added: 'zlaťáky přidány', spent: 'zlaťáky utraceny' },
  { coin: 'ep', abbr: 'el', name: 'elektrum', added: 'elektrum přidáno', spent: 'elektrum utraceno' },
  { coin: 'sp', abbr: 'st', name: 'stříbrňáky', added: 'stříbrňáky přidány', spent: 'stříbrňáky utraceny' },
  { coin: 'cp', abbr: 'md', name: 'měďáky', added: 'měďáky přidány', spent: 'měďáky utraceny' },
]

const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })

export function NumberModal({ title, onClose, actions, hint }: {
  title: string
  onClose: () => void
  actions: { label: string; kind?: 'primary' | 'default'; onClick: (n: number) => void }[]
  hint?: ReactNode
}) {
  const [value, setValue] = useState('')
  const n = parseInt(value, 10)
  const ok = Number.isFinite(n) && n > 0
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {actions.map((a) => (
            <Button key={a.label} kind={a.kind ?? 'default'} className="flex-1 py-3" disabled={!ok} onClick={() => ok && a.onClick(n)}>
              {a.label}
            </Button>
          ))}
        </div>
      }
    >
      <input
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
        aria-label="Počet"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-center text-3xl font-bold tabular-nums text-zinc-50"
      />
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </Modal>
  )
}

function Stepper({ item, onQty, onRemove }: { item: InventoryItem; onQty: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button aria-label={`Ubrat ${item.name}`} onClick={() => (item.qty > 1 ? onQty(item.qty - 1) : onRemove())} className="h-8 w-8 rounded-lg border border-zinc-700 text-zinc-300">
        −
      </button>
      <span className="w-8 text-center text-sm font-bold tabular-nums text-zinc-100">{item.qty}</span>
      <button aria-label={`Přidat ${item.name}`} onClick={() => onQty(item.qty + 1)} className="h-8 w-8 rounded-lg border border-zinc-700 text-zinc-300">
        +
      </button>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-zinc-950/60 px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-zinc-100">{value}</div>
    </div>
  )
}

function ItemDetail({ item, onClose, onQty, onRemove, onNotes }: {
  item: InventoryItem
  onClose: () => void
  onQty: (to: number) => void
  onRemove: () => void
  onNotes: (notes: string) => void
}) {
  const [notes, setNotes] = useState(item.notes)
  return (
    <Modal
      title={
        <>
          {item.name}
          {item.nameEn && <span className="block text-xs font-normal text-zinc-500">{item.nameEn}</span>}
        </>
      }
      onClose={() => {
        if (notes !== item.notes) onNotes(notes)
        onClose()
      }}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Stepper item={item} onQty={onQty} onRemove={onRemove} />
          <Button kind="danger" onClick={onRemove}>
            Odebrat
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {(item.info || item.equipped) && (
          <p className="text-zinc-400">
            {item.info}
            {item.equipped && <span className="ml-2 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-200">nasazeno</span>}
          </p>
        )}
        <div className="flex gap-2">
          <Fact label="Váha" value={item.weight > 0 ? `${fmt(item.weight)} lb` : '–'} />
          <Fact label="Cena" value={item.cost > 0 ? `${fmt(item.cost)} zl` : '–'} />
          <Fact label="Počet" value={String(item.qty)} />
        </div>
        {item.text && <Prose text={item.text} />}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Poznámky</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
            onBlur={() => notes !== item.notes && onNotes(notes)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>
    </Modal>
  )
}

export function InventoryTab({ c, patch, log }: { c: Character; patch: Patch; log: LogEvent }) {
  const st = c.state
  const [coin, setCoin] = useState<Coin | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [removing, setRemoving] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const coinInfo = COINS.find((x) => x.coin === coin)
  const changeCoin = (n: number, add: boolean) => {
    if (!coinInfo) return
    const from = st.coins[coinInfo.coin]
    const to = add ? Math.min(10_000_000, from + n) : Math.max(0, from - n)
    setCoin(null)
    if (to === from) return
    patch({ coins: { ...st.coins, [coinInfo.coin]: to } })
    log({ kind: 'gold', label: add ? coinInfo.added : coinInfo.spent, total: Math.abs(to - from), detail: { from, to, coin: coinInfo.coin } as { from: number; to: number } })
  }

  const setItemQty = (id: string, to: number) => {
    const item = st.items.find((i) => i.id === id)
    if (!item) return
    const items = to <= 0 ? st.items.filter((i) => i.id !== id) : st.items.map((i) => (i.id === id ? { ...i, qty: Math.min(9999, to) } : i))
    patch({ items })
    log({
      kind: 'item',
      label: to <= 0 ? `odebral(a): ${item.name}` : to > item.qty ? `přidal(a): ${item.name}` : `ubral(a): ${item.name}`,
      total: Math.abs(Math.max(0, to) - item.qty),
      detail: { from: item.qty, to: Math.max(0, to) },
    })
  }

  const addItem = () => {
    const n = Math.max(1, Math.min(9999, parseInt(qty, 10) || 1))
    const clean = name.trim().slice(0, 80)
    if (!clean) return
    // Same name: raise the count instead of a second row.
    const same = st.items.find((i) => i.name.toLowerCase() === clean.toLowerCase())
    if (same) setItemQty(same.id, same.qty + n)
    else {
      patch({ items: [...st.items, { id: Math.random().toString(36).slice(2, 10), name: clean, qty: n, nameEn: '', info: '', weight: 0, cost: 0, equipped: false, text: '', notes: '' }] })
      log({ kind: 'item', label: `získal(a): ${clean}`, total: n, detail: { from: 0, to: n } })
    }
    setName('')
    setQty('1')
  }

  const saveNotes = (id: string, notes: string) => patch({ items: st.items.map((i) => (i.id === id ? { ...i, notes } : i)) })

  const removingItem = st.items.find((i) => i.id === removing)
  const openItem = st.items.find((i) => i.id === open)
  const weight = st.items.reduce((n, i) => n + i.qty * i.weight, 0)

  return (
    <>
      <Section title="Peníze">
        <div className="flex gap-1.5">
          {COINS.map((x) => {
            const main = x.coin === 'gp'
            return (
              <button
                key={x.coin}
                onClick={() => setCoin(x.coin)}
                aria-label={`${x.name}: ${st.coins[x.coin]}`}
                className={`min-w-0 flex-1 rounded-lg border px-1 py-2 text-center ${main ? 'flex-[1.4] border-yellow-700/70 bg-yellow-950/40' : 'border-zinc-700 bg-zinc-900'} active:bg-zinc-800`}
              >
                <div className={`truncate font-bold tabular-nums ${main ? 'text-2xl text-yellow-300' : 'text-lg text-zinc-100'}`}>{st.coins[x.coin].toLocaleString('cs-CZ')}</div>
                <div className={`text-xs uppercase ${main ? 'text-yellow-600' : 'text-zinc-500'}`}>{x.abbr}</div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={weight > 0 ? `Předměty · ${fmt(weight)} lb` : 'Předměty'}>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addItem()
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nový předmět, např. Lano (15 m)"
            maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            aria-label="Počet"
            className="w-14 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100"
          />
          <Button kind="primary" type="submit" disabled={!name.trim()}>
            Přidat
          </Button>
        </form>
        {st.items.length === 0 && <p className="text-sm text-zinc-500">Zatím nic.</p>}
        <ul className="divide-y divide-zinc-800">
          {st.items.map((i) => {
            const sub = [i.info, i.weight > 0 ? `${fmt(i.weight)} lb` : ''].filter(Boolean).join(' · ')
            return (
              <li key={i.id} className="flex items-center gap-2 py-1.5">
                <button onClick={() => setOpen(i.id)} className="flex min-w-0 flex-1 items-center text-left">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm text-zinc-100">{i.name}</span>
                      {i.equipped && <span className="shrink-0 rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] text-amber-200">nasazeno</span>}
                    </span>
                    {sub && <span className="block truncate text-xs text-zinc-500">{sub}</span>}
                  </span>
                  <More />
                </button>
                <Stepper item={i} onQty={(to) => setItemQty(i.id, to)} onRemove={() => setRemoving(i.id)} />
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Každá změna se zapíše do logu, který vidí celá družina.</p>
      </Section>

      {coinInfo && (
        <NumberModal
          title={`${coinInfo.name[0].toUpperCase()}${coinInfo.name.slice(1)} (${coinInfo.abbr}): ${st.coins[coinInfo.coin].toLocaleString('cs-CZ')}`}
          onClose={() => setCoin(null)}
          actions={[
            { label: 'Přidat', kind: 'primary', onClick: (n) => changeCoin(n, true) },
            { label: 'Utratit', onClick: (n) => changeCoin(n, false) },
          ]}
          hint="Pod nulu se neutratí."
        />
      )}
      {openItem && (
        <ItemDetail
          key={openItem.id}
          item={openItem}
          onClose={() => setOpen(null)}
          onQty={(to) => setItemQty(openItem.id, to)}
          onRemove={() => {
            setOpen(null)
            setRemoving(openItem.id)
          }}
          onNotes={(notes) => saveNotes(openItem.id, notes)}
        />
      )}
      {removingItem && (
        <Modal
          title={`Odebrat: ${removingItem.name}?`}
          onClose={() => setRemoving(null)}
          footer={
            <Button
              kind="danger"
              className="w-full py-3"
              onClick={() => {
                setItemQty(removingItem.id, 0)
                setRemoving(null)
              }}
            >
              Odebrat {removingItem.qty > 1 ? `všech ${removingItem.qty} ks` : ''}
            </Button>
          }
        >
          <p>Předmět zmizí z výbavy a do logu se zapíše, že byl odebrán.</p>
        </Modal>
      )}
    </>
  )
}
