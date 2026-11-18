// Server-sent events, one hub per process. Seven phones per campaign, so a Set is plenty.
import type { Response } from 'express'
import type { Role } from './lib'

interface Client {
  res: Response
  role: Role
}

const hubs = new Map<string, Set<Client>>()

export function subscribe(campaignId: string, role: Role, res: Response) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write('retry: 3000\n\n')

  const client = { res, role }
  let set = hubs.get(campaignId)
  if (!set) hubs.set(campaignId, (set = new Set()))
  set.add(client)

  // Proxies and phones drop idle connections; a comment every 25 s keeps it open.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
  res.on('close', () => {
    clearInterval(ping)
    set!.delete(client)
    if (set!.size === 0) hubs.delete(campaignId)
  })
}

/** gmOnly: hidden rolls go to GM connections only. */
export function publish(campaignId: string, event: string, data: unknown, gmOnly = false) {
  const set = hubs.get(campaignId)
  if (!set) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const c of set) {
    if (gmOnly && c.role !== 'gm') continue
    c.res.write(payload)
  }
}
