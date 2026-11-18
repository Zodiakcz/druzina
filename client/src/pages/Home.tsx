import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgetLink, savedLinks } from '@/lib/links'
import { Shell } from './Campaign'
import { Button, Section } from '@/components/ui'

export function Home() {
  const [links, setLinks] = useState(savedLinks)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [createKey, setCreateKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const create = async () => {
    setError(null)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Create-Key': createKey },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error ?? 'Nepodařilo se')
    navigate(`/pj/${data.gmKey}`)
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md space-y-4 pb-10">
        <div className="pt-6 text-center">
          <h1 className="font-display text-4xl text-amber-200">Družina</h1>
          <p className="mt-1 text-sm text-zinc-400">Karta postavy a obrazovka PJ, česky.</p>
        </div>

        {links.length > 0 ? (
          <Section title="Na tomhle zařízení">
            <ul className="divide-y divide-zinc-800">
              {links.map((l) => (
                <li key={l.path} className="flex items-center gap-2 py-2">
                  <Link to={l.path} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-zinc-100">{l.title}</span>
                    <span className="block truncate text-xs text-zinc-500">{l.subtitle}</span>
                  </Link>
                  <button
                    className="px-2 text-zinc-600 hover:text-red-400"
                    aria-label="Zapomenout"
                    onClick={() => {
                      forgetLink(l.path)
                      setLinks(savedLinks())
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : (
          <p className="text-center text-sm text-zinc-400">Otevři odkaz, který ti poslal PJ. Appka si ho tady zapamatuje.</p>
        )}

        {creating ? (
          <Section title="Nová kampaň">
            <div className="space-y-2">
              <input className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" placeholder="Název kampaně" value={name} onChange={(e) => setName(e.target.value)} />
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="Klíč pro založení"
                type="password"
                value={createKey}
                onChange={(e) => setCreateKey(e.target.value)}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button kind="ghost" onClick={() => setCreating(false)}>
                  Zrušit
                </Button>
                <Button kind="primary" onClick={create} disabled={!name.trim() || !createKey}>
                  Založit
                </Button>
              </div>
            </div>
          </Section>
        ) : (
          <p className="text-center">
            <button className="text-sm text-zinc-500 underline" onClick={() => setCreating(true)}>
              Založit novou kampaň (PJ)
            </button>
          </p>
        )}

        <p className="pt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          Obsah pravidel ze System Reference Document 5.2 a 5.1 © Wizards of the Coast LLC, licence CC-BY-4.0.
          Družina není produkt Wizards of the Coast.
        </p>
      </div>
    </Shell>
  )
}
