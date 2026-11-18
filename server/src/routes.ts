import { Router, type Request } from 'express'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { prisma, HttpError, newKey, resolveKey, publicCharacter, publicRoll, type Access } from './lib'
import { sheetSchema, stateSchema, statePatchSchema, initialState, rollSchema } from './schema'
import { subscribe, publish } from './events'

const r = Router()

const access = (req: Request) => resolveKey(req.get('x-key'))

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const res = schema.safeParse(body)
  if (!res.success) {
    const issue = res.error.issues[0]
    throw new HttpError(400, `Neplatná data: ${issue.path.join('.')} ${issue.message}`)
  }
  return res.data
}

/** The character this request may change: the GM any in the campaign, a player only their own. */
async function editable(a: Access, id: string) {
  if (a.role === 'player') {
    if (a.character!.id !== id) throw new HttpError(403, 'Tohle není tvoje postava')
    return a.character!
  }
  if (a.role !== 'gm') throw new HttpError(403, 'Odkaz družiny je jen pro čtení')
  const c = await prisma.character.findFirst({ where: { id, campaignId: a.campaign.id } })
  if (!c) throw new HttpError(404, 'Postava nenalezena')
  return c
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// Creating a campaign needs CREATE_KEY, otherwise anyone on the internet could fill the DB.
r.post('/campaigns', async (req, res) => {
  const createKey = process.env.CREATE_KEY
  if (!createKey || !safeEqual(req.get('x-create-key') ?? '', createKey)) throw new HttpError(403, 'Špatný klíč pro založení kampaně')
  const { name } = parse(z.object({ name: z.string().trim().min(1).max(80) }), req.body)
  const c = await prisma.campaign.create({ data: { name, gmKey: newKey(), partyKey: newKey() } })
  res.status(201).json({ id: c.id, name: c.name, gmKey: c.gmKey, partyKey: c.partyKey })
})

// Everything a screen needs in one call: who am I, the party, the last 100 rolls.
r.get('/session', async (req, res) => {
  const a = await access(req)
  const gm = a.role === 'gm'
  const [characters, rolls] = await Promise.all([
    prisma.character.findMany({ where: { campaignId: a.campaign.id }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
    prisma.roll.findMany({
      where: { campaignId: a.campaign.id, ...(gm ? {} : { hidden: false }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])
  res.json({
    role: a.role,
    campaign: { id: a.campaign.id, name: a.campaign.name, ...(gm ? { partyKey: a.campaign.partyKey } : {}) },
    meId: a.character?.id ?? null,
    characters: characters.map((c) => publicCharacter(c, gm)),
    rolls: rolls.map(publicRoll),
  })
})

r.post('/characters', async (req, res) => {
  const a = await access(req)
  if (a.role !== 'gm') throw new HttpError(403, 'Postavy zakládá PJ')
  const sheet = parse(sheetSchema, req.body.sheet)
  const ddbId = req.body.ddbId == null ? null : parse(z.number().int().positive(), req.body.ddbId)
  const count = await prisma.character.count({ where: { campaignId: a.campaign.id } })
  if (count >= 20) throw new HttpError(400, 'Kampaň už má 20 postav')
  const c = await prisma.character.create({
    data: {
      campaignId: a.campaign.id,
      key: newKey(),
      sheet: JSON.stringify(sheet),
      state: JSON.stringify(initialState(sheet)),
      ddbId,
      sort: count,
    },
  })
  publish(a.campaign.id, 'character', publicCharacter(c))
  res.status(201).json(publicCharacter(c, true))
})

r.put('/characters/:id/sheet', async (req, res) => {
  const a = await access(req)
  const c = await editable(a, req.params.id)
  const sheet = parse(sheetSchema, req.body.sheet)
  // Lowering max HP must not leave current HP above it.
  const state = stateSchema.parse(JSON.parse(c.state))
  if (state.hp > sheet.hpMax) state.hp = sheet.hpMax
  const updated = await prisma.character.update({
    where: { id: c.id },
    data: { sheet: JSON.stringify(sheet), state: JSON.stringify(state) },
  })
  publish(a.campaign.id, 'character', publicCharacter(updated))
  res.json(publicCharacter(updated, a.role === 'gm'))
})

// A patch, not the whole state: the GM fixing HP and the player spending a slot at the same
// moment must not overwrite each other.
r.patch('/characters/:id/state', async (req, res) => {
  const a = await access(req)
  const c = await editable(a, req.params.id)
  const patch = parse(statePatchSchema, req.body.patch)
  const state = stateSchema.parse({ ...JSON.parse(c.state), ...patch })
  const updated = await prisma.character.update({ where: { id: c.id }, data: { state: JSON.stringify(state) } })
  publish(a.campaign.id, 'character', publicCharacter(updated))
  res.json(publicCharacter(updated, a.role === 'gm'))
})

r.delete('/characters/:id', async (req, res) => {
  const a = await access(req)
  if (a.role !== 'gm') throw new HttpError(403, 'Mazat může jen PJ')
  const c = await editable(a, req.params.id)
  await prisma.character.delete({ where: { id: c.id } })
  publish(a.campaign.id, 'removed', { id: c.id })
  res.status(204).end()
})

r.post('/rolls', async (req, res) => {
  const a = await access(req)
  if (a.role === 'party') throw new HttpError(403, 'Odkaz družiny je jen pro čtení')
  const body = parse(rollSchema, req.body)
  let who = 'PJ'
  let characterId: string | null = null
  if (a.role === 'player') {
    characterId = a.character!.id
    who = sheetSchema.parse(JSON.parse(a.character!.sheet)).name
  } else if (body.characterId) {
    const c = await editable(a, body.characterId)
    characterId = c.id
    who = sheetSchema.parse(JSON.parse(c.sheet)).name
  }
  const hidden = a.role === 'gm' && body.hidden
  const detail = JSON.stringify(body.detail ?? null)
  if (detail.length > 4000) throw new HttpError(400, 'Příliš mnoho kostek')
  const roll = await prisma.roll.create({
    data: { campaignId: a.campaign.id, characterId, who, label: body.label, formula: body.formula, total: body.total, detail, hidden },
  })
  publish(a.campaign.id, 'roll', publicRoll(roll), hidden)
  res.status(201).json(publicRoll(roll))
})

// EventSource cannot send headers, so the key comes in the query string here.
r.get('/events', async (req, res) => {
  const a = await resolveKey(typeof req.query.key === 'string' ? req.query.key : undefined)
  subscribe(a.campaign.id, a.role, res)
})

export default r
