// One hook per screen: loads /api/session, keeps it live over SSE, and applies the user's own
// changes optimistically. A failed state change is queued and retried when the connection
// comes back, so a dropped Wi-Fi at the table loses nothing.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api'
import type { Character, HpDetail, LogKind, Roll, RollDetail, Session, Sheet, State } from './types'

/** Entries kept in memory; older ones come back through "Starší záznamy". */
const LOG_CAP = 300

export interface DdbImport {
  sheet: Sheet
  state: State
  ddbId: number
  warnings: string[]
}

type Pending = { id: string; patch: Partial<State> }

const queueKey = (key: string) => `druzina.pending.${key.slice(0, 8)}`
const cacheKey = (key: string) => `druzina.session.${key.slice(0, 8)}`

function loadQueue(key: string): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(key)) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(key: string, q: Pending[]) {
  try {
    localStorage.setItem(queueKey(key), JSON.stringify(q))
  } catch {
    // ignore
  }
}

export function useSession(key: string) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const cached = localStorage.getItem(cacheKey(key))
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  // loadOlderRolls needs the current oldest entry without re-creating itself on every change.
  const sessionRef = useRef(session)
  sessionRef.current = session
  const queue = useRef<Pending[]>(loadQueue(key))

  const upsert = useCallback((c: Character) => {
    // Changes still on their way to the server win over what the server sent, or quick taps
    // would flicker back and forth as the echoes of earlier taps arrive.
    const pending = queue.current.filter((p) => p.id === c.id).reduce((acc, p) => ({ ...acc, ...p.patch }), {})
    setSession((s) => {
      if (!s) return s
      const prev = s.characters.find((x) => x.id === c.id)
      // The public event has no key; keep the one the GM session already knows.
      const merged = { ...c, state: { ...c.state, ...pending }, key: c.key ?? prev?.key }
      const characters = prev ? s.characters.map((x) => (x.id === c.id ? merged : x)) : [...s.characters, merged]
      return { ...s, characters: characters.sort((a, b) => a.sort - b.sort) }
    })
  }, [])

  const flush = useCallback(async () => {
    while (queue.current.length) {
      const { id, patch } = queue.current[0]
      try {
        const c = await api<Character>(key, 'PATCH', `/characters/${id}/state`, { patch })
        upsert(c)
      } catch (e) {
        if (e instanceof ApiError && e.status < 500) {
          // Rejected for good (validation, deleted character): drop it rather than retry forever.
          setError(e.message)
        } else {
          setOnline(false)
          return
        }
      }
      queue.current.shift()
      saveQueue(key, queue.current)
    }
  }, [key, upsert])

  const load = useCallback(async () => {
    try {
      const s = await api<Session>(key, 'GET', '/session')
      setSession(s)
      setError(null)
      setOnline(true)
      try {
        localStorage.setItem(cacheKey(key), JSON.stringify(s))
      } catch {
        // ignore
      }
      await flush()
    } catch (e) {
      if (e instanceof ApiError) setError(e.message)
      else setOnline(false)
    }
  }, [key, flush])

  useEffect(() => {
    load()
    const es = new EventSource(`/api/events?key=${encodeURIComponent(key)}`)
    es.addEventListener('character', (ev) => upsert(JSON.parse((ev as MessageEvent).data)))
    es.addEventListener('removed', (ev) => {
      const { id } = JSON.parse((ev as MessageEvent).data)
      setSession((s) => (s ? { ...s, characters: s.characters.filter((c) => c.id !== id) } : s))
    })
    es.addEventListener('roll', (ev) => {
      const roll: Roll = JSON.parse((ev as MessageEvent).data)
      setSession((s) => (s && !s.rolls.some((r) => r.id === roll.id) ? capLog(s, [roll, ...s.rolls]) : s))
    })
    let wasDown = false
    es.onerror = () => {
      wasDown = true
      setOnline(false)
    }
    es.onopen = () => {
      setOnline(true)
      // Anything missed while the stream was down: reload once it is back.
      if (wasDown) load()
    }
    const onOnline = () => load()
    window.addEventListener('online', onOnline)
    return () => {
      es.close()
      window.removeEventListener('online', onOnline)
    }
  }, [key, load, upsert])

  const patchState = useCallback(
    (id: string, patch: Partial<State>) => {
      setSession((s) =>
        s ? { ...s, characters: s.characters.map((c) => (c.id === id ? { ...c, state: { ...c.state, ...patch } } : c)) } : s
      )
      // Merge into a queued patch for the same character so the queue stays short offline.
      const last = queue.current[queue.current.length - 1]
      if (last && last.id === id && queue.current.length > 1) last.patch = { ...last.patch, ...patch }
      else queue.current.push({ id, patch })
      saveQueue(key, queue.current)
      if (queue.current.length === 1) flush()
    },
    [key, flush]
  )

  const saveSheet = useCallback(
    async (id: string, sheet: Sheet, ddbId?: number) => {
      const c = await api<Character>(key, 'PUT', `/characters/${id}/sheet`, { sheet, ...(ddbId ? { ddbId } : {}) })
      upsert(c)
      return c
    },
    [key, upsert]
  )

  const createCharacter = useCallback(
    async (sheet: Sheet, extra: { state?: State; ddbId?: number } = {}) => {
      const c = await api<Character>(key, 'POST', '/characters', { sheet, ...extra })
      upsert(c)
      return c
    },
    [key, upsert]
  )

  const deleteCharacter = useCallback(
    async (id: string) => {
      await api(key, 'DELETE', `/characters/${id}`)
      setSession((s) => (s ? { ...s, characters: s.characters.filter((c) => c.id !== id) } : s))
    },
    [key]
  )

  const logRoll = useCallback(
    async (r: {
      characterId: string | null
      kind?: LogKind
      label: string
      formula?: string
      total: number
      detail: RollDetail | HpDetail | null
      hidden?: boolean
    }) => {
      try {
        const saved = await api<Roll>(key, 'POST', '/rolls', r)
        setSession((s) => (s && !s.rolls.some((x) => x.id === saved.id) ? capLog(s, [saved, ...s.rolls]) : s))
      } catch {
        // The roll still shows on this phone; only the shared log misses it.
        setOnline(false)
      }
    },
    [key]
  )

  const loadOlderRolls = useCallback(async () => {
    const last = sessionRef.current?.rolls.at(-1)
    const page = await api<{ rolls: Roll[]; hasMore: boolean }>(key, 'GET', `/rolls${last ? `?before=${encodeURIComponent(last.id)}` : ''}`)
    setSession((s) => {
      if (!s) return s
      const known = new Set(s.rolls.map((r) => r.id))
      return { ...s, rolls: [...s.rolls, ...page.rolls.filter((r) => !known.has(r.id))], hasMoreRolls: page.hasMore }
    })
  }, [key])

  const importDdb = useCallback(
    (url: string, characterId?: string) => api<DdbImport>(key, 'POST', '/import/ddb', { url, characterId }),
    [key]
  )

  return { session, error, online, patchState, saveSheet, createCharacter, deleteCharacter, logRoll, loadOlderRolls, importDdb, reload: load }
}

export type SessionApi = ReturnType<typeof useSession>

/** Newest entries first; past the cap the oldest drop out and can be loaded again. */
function capLog(s: Session, rolls: Roll[]): Session {
  return rolls.length > LOG_CAP ? { ...s, rolls: rolls.slice(0, LOG_CAP), hasMoreRolls: true } : { ...s, rolls }
}
