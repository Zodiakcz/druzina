// Everything under /pj/:key (GM), /k/:key (party, read-only) and /p/:key (one player).
// The layout owns the live session; the pages below read it from context.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useSession, type DdbImport, type SessionApi } from '@/lib/session'
import { rememberLink } from '@/lib/links'
import { emptySheet, type Character, type RollDetail, type Session, type Sheet } from '@/lib/types'
import { RollerProvider, DiceBar } from '@/components/Roller'
import { RollLog } from '@/components/RollLog'
import { PartyCard } from '@/components/PartyCard'
import { CharacterSheet } from '@/components/CharacterSheet'
import { SheetEditor } from '@/components/SheetEditor'
import { Button, Section } from '@/components/ui'

interface Ctx extends SessionApi {
  key: string
  base: string
  session: Session
}

const CampaignCtx = createContext<Ctx | null>(null)
const useCampaign = () => useContext(CampaignCtx)!

export function CampaignLayout({ prefix }: { prefix: 'pj' | 'k' | 'p' }) {
  const { key = '' } = useParams()
  const api = useSession(key)
  const { session, error, online } = api
  const base = `/${prefix}/${key}`

  useEffect(() => {
    if (!session) return
    const me = session.characters.find((c) => c.id === session.meId)
    rememberLink({
      path: base,
      title: me ? me.sheet.name : session.campaign.name,
      subtitle: session.role === 'gm' ? `PJ · ${session.campaign.name}` : session.role === 'party' ? 'Družina (jen čtení)' : session.campaign.name,
    })
  }, [session?.campaign.name, session?.meId, session?.role, base]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) {
    return (
      <Shell>
        <p className="py-16 text-center text-zinc-400">{error ?? 'Načítám…'}</p>
        {error && (
          <p className="text-center">
            <Link to="/" className="text-amber-300 underline">
              Zpět
            </Link>
          </p>
        )}
      </Shell>
    )
  }

  return (
    <CampaignCtx.Provider value={{ ...api, key, base, session }}>
      <Shell
        title={
          <Link to={base} className="truncate">
            {session.campaign.name}
          </Link>
        }
        status={!online ? 'offline' : error ? 'error' : 'ok'}
        statusText={error ?? undefined}
      >
        <Outlet />
      </Shell>
    </CampaignCtx.Provider>
  )
}

export function Shell({ title, status, statusText, children }: { title?: ReactNode; status?: 'ok' | 'offline' | 'error'; statusText?: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-3 pt-[max(.75rem,env(safe-area-inset-top))]">
      <header className="mb-3 flex items-center gap-3">
        <Link to="/" className="font-display text-lg text-amber-300">
          Družina
        </Link>
        {title && <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">{title}</span>}
        {status && (
          <span
            title={statusText ?? (status === 'ok' ? 'Připojeno' : 'Bez připojení, změny se dorovnají')}
            className={`ml-auto flex items-center gap-1.5 text-xs ${status === 'ok' ? 'text-zinc-500' : status === 'offline' ? 'text-amber-400' : 'text-red-400'}`}
          >
            <span className={`h-2 w-2 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'offline' ? 'bg-amber-500' : 'bg-red-500'}`} />
            {status === 'ok' ? 'živě' : status === 'offline' ? 'offline' : 'chyba'}
          </span>
        )}
      </header>
      {children}
    </div>
  )
}

function useLogRoll(characterId: string | null) {
  const { logRoll } = useCampaign()
  return useCallback(
    (r: { label: string; formula: string; total: number; detail: RollDetail; hidden: boolean }) => logRoll({ ...r, characterId }),
    [logRoll, characterId]
  )
}

async function shareLink(path: string, title: string) {
  const url = `${location.origin}${path}`
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch {
      // cancelled or unsupported: fall through to copy
    }
  }
  await navigator.clipboard.writeText(url)
  alert(`Odkaz zkopírován:\n${url}`)
}

// ---------------------------------------------------------------- GM

export function GmHome() {
  const { session, base } = useCampaign()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(false)
  const onRoll = useLogRoll(null)
  return (
    <RollerProvider onRoll={onRoll}>
      <div className="grid gap-4 pb-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-auto font-display text-2xl text-zinc-50">Družina</h1>
            <Button onClick={() => shareLink(`/k/${session.campaign.partyKey}`, session.campaign.name)}>Odkaz pro družinu</Button>
            <Button onClick={() => navigate(`${base}/import`)}>Import z D&amp;D Beyond</Button>
            <Button kind="primary" onClick={() => navigate(`${base}/nova`)}>
              + Nová postava
            </Button>
          </div>
          {session.characters.length === 0 && <p className="py-8 text-center text-zinc-500">Zatím žádné postavy. Založ první.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {session.characters.map((c) => (
              <PartyCard
                key={c.id}
                c={c}
                onOpen={() => navigate(`${base}/postava/${c.id}`)}
                actions={
                  <>
                    <Button kind="ghost" className="!px-2 !py-1 text-xs" onClick={() => c.key && shareLink(`/p/${c.key}`, c.sheet.name)}>
                      Odkaz hráče
                    </Button>
                    <Button kind="ghost" className="!px-2 !py-1 text-xs" onClick={() => navigate(`${base}/postava/${c.id}/upravit`)}>
                      Upravit
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </div>
        <aside className="space-y-3">
          <Section title="Kostky PJ">
            <DiceBar hidden={hidden} onHiddenChange={setHidden} />
          </Section>
          <Section title="Log hodů">
            <RollLog rolls={session.rolls} />
          </Section>
        </aside>
      </div>
    </RollerProvider>
  )
}

function useCharacter(): Character | undefined {
  const { id } = useParams()
  const { session } = useCampaign()
  return session.characters.find((c) => c.id === id)
}

export function GmCharacter() {
  const c = useCharacter()
  const { session, patchState, base } = useCampaign()
  const navigate = useNavigate()
  const onRoll = useLogRoll(c?.id ?? null)
  if (!c) return <p className="py-10 text-center text-zinc-500">Postava nenalezena.</p>
  return (
    <RollerProvider onRoll={onRoll}>
      <Link to={base} className="mb-2 inline-block text-sm text-zinc-400">
        ← Družina
      </Link>
      <CharacterSheet c={c} rolls={session.rolls} patch={(p) => patchState(c.id, p)} onEdit={() => navigate(`${base}/postava/${c.id}/upravit`)} />
    </RollerProvider>
  )
}

export function GmEdit() {
  const c = useCharacter()
  const { saveSheet, deleteCharacter, importDdb, base } = useCampaign()
  const navigate = useNavigate()
  const [reimport, setReimport] = useState<{ sheet: Sheet; warnings: string[]; n: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!c) return <p className="py-10 text-center text-zinc-500">Postava nenalezena.</p>
  const reload = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await importDdb(String(c.ddbId), c.id)
      setReimport((x) => ({ sheet: r.sheet, warnings: r.warnings, n: (x?.n ?? 0) + 1 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import selhal')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-2xl text-zinc-50">Upravit: {c.sheet.name}</h1>
        {c.ddbId && (
          <Button onClick={reload} disabled={busy}>
            {busy ? 'Načítám…' : 'Znovu načíst z D&D Beyond'}
          </Button>
        )}
      </div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {reimport && <ImportNotes warnings={reimport.warnings} reimport />}
      <SheetEditor
        key={reimport?.n ?? 0}
        initial={reimport?.sheet ?? c.sheet}
        onCancel={() => navigate(-1)}
        onSave={async (s) => {
          await saveSheet(c.id, s)
          navigate(`${base}/postava/${c.id}`)
        }}
        onDelete={async () => {
          if (!confirm(`Opravdu smazat postavu ${c.sheet.name}? Nedá se to vrátit.`)) return
          await deleteCharacter(c.id)
          navigate(base)
        }}
      />
    </>
  )
}

export function GmNew() {
  const { createCharacter, base } = useCampaign()
  const navigate = useNavigate()
  return (
    <>
      <h1 className="mb-3 font-display text-2xl text-zinc-50">Nová postava</h1>
      <SheetEditor
        initial={emptySheet()}
        onCancel={() => navigate(base)}
        onSave={async (s) => {
          const c = await createCharacter(s)
          navigate(`${base}/postava/${c.id}`)
        }}
      />
    </>
  )
}

function ImportNotes({ warnings, reimport }: { warnings: string[]; reimport?: boolean }) {
  return (
    <div className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-100">
      <p className="font-semibold">{reimport ? 'Načteno znovu, zatím neuloženo.' : 'Načteno, zatím neuloženo.'} Zkontroluj čísla a ulož.</p>
      {reimport && (
        <p className="mt-1 text-amber-200/80">
          Životy, pozice a stavy ze hry zůstanou. České překlady zůstanou u textů, které se v D&amp;D Beyond nezměnily.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-200/90">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GmImport() {
  const { importDdb, createCharacter, session, base } = useCampaign()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DdbImport | null>(null)

  const load = async () => {
    setBusy(true)
    setError(null)
    try {
      setResult(await importDdb(url))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import selhal')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const existing = session.characters.find((c) => c.ddbId === result.ddbId)
    return (
      <>
        <h1 className="mb-3 font-display text-2xl text-zinc-50">Import: {result.sheet.name}</h1>
        {existing && (
          <p className="mb-3 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            Tahle postava už v kampani je ({existing.sheet.name}). Pro aktualizaci použij „Znovu načíst“ v její úpravě, jinak vznikne
            druhá kopie.
          </p>
        )}
        <ImportNotes warnings={result.warnings} />
        <SheetEditor
          initial={result.sheet}
          onCancel={() => setResult(null)}
          onSave={async (s) => {
            const c = await createCharacter(s, { state: result.state, ddbId: result.ddbId })
            navigate(`${base}/postava/${c.id}`)
          }}
        />
      </>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 pb-10">
      <Link to={base} className="inline-block text-sm text-zinc-400">
        ← Družina
      </Link>
      <h1 className="font-display text-2xl text-zinc-50">Import z D&amp;D Beyond</h1>
      <Section title="Odkaz na postavu">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.dndbeyond.com/characters/123456789"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button kind="primary" type="submit" disabled={busy || !url.trim()}>
            {busy ? 'Načítám…' : 'Načíst'}
          </Button>
        </form>
        <p className="mt-3 text-xs text-zinc-500">
          Postava musí být veřejná: v D&amp;D Beyond na webu Character Settings → Character Privacy → Public. Nic se neuloží, dokud
          výsledek nezkontroluješ a neklepneš na Uložit.
        </p>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------- Party (read-only)

export function PartyHome() {
  const { session } = useCampaign()
  return (
    <div className="grid gap-4 pb-10 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {session.characters.map((c) => (
          <PartyCard key={c.id} c={c} />
        ))}
      </div>
      <Section title="Log hodů">
        <RollLog rolls={session.rolls} />
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------- Player

export function PlayerHome() {
  const { session, patchState, base } = useCampaign()
  const navigate = useNavigate()
  const me = session.characters.find((c) => c.id === session.meId)
  const onRoll = useLogRoll(me?.id ?? null)
  if (!me) return <p className="py-10 text-center text-zinc-500">Postava nenalezena.</p>
  return (
    <RollerProvider onRoll={onRoll}>
      <CharacterSheet c={me} rolls={session.rolls} patch={(p) => patchState(me.id, p)} onEdit={() => navigate(`${base}/upravit`)} />
    </RollerProvider>
  )
}

export function PlayerEdit() {
  const { session, saveSheet, base } = useCampaign()
  const navigate = useNavigate()
  const me = session.characters.find((c) => c.id === session.meId)
  if (!me) return null
  return (
    <>
      <h1 className="mb-3 font-display text-2xl text-zinc-50">Upravit kartu</h1>
      <SheetEditor
        initial={me.sheet}
        onCancel={() => navigate(base)}
        onSave={async (s) => {
          await saveSheet(me.id, s)
          navigate(base)
        }}
      />
    </>
  )
}
