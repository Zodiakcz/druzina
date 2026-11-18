import { randomBytes } from 'crypto'
import { PrismaClient, type Campaign, type Character } from '@prisma/client'
import { sheetSchema, stateSchema } from './schema'

export const prisma = new PrismaClient()

import { HttpError } from './errors'
export { HttpError }

/** 128-bit random, URL-safe. The key is the only credential, so it must be unguessable. */
export function newKey(): string {
  return randomBytes(16).toString('base64url')
}

export type Role = 'gm' | 'party' | 'player'
export interface Access {
  role: Role
  campaign: Campaign
  /** Set when role is 'player': the one character this key controls. */
  character?: Character
}

export async function resolveKey(key: string | undefined): Promise<Access> {
  if (!key || key.length < 16 || key.length > 64) throw new HttpError(401, 'Chybí nebo je neplatný odkaz')
  const gm = await prisma.campaign.findUnique({ where: { gmKey: key } })
  if (gm) return { role: 'gm', campaign: gm }
  const party = await prisma.campaign.findUnique({ where: { partyKey: key } })
  if (party) return { role: 'party', campaign: party }
  const character = await prisma.character.findUnique({ where: { key }, include: { campaign: true } })
  if (character) {
    const { campaign, ...rest } = character
    return { role: 'player', campaign, character: rest }
  }
  throw new HttpError(404, 'Odkaz neplatí, zeptej se PJ na nový')
}

/** What everyone in the campaign may see. The key is added only for the GM. */
export function publicCharacter(c: Character, withKey = false) {
  return {
    id: c.id,
    sort: c.sort,
    ddbId: c.ddbId,
    updatedAt: c.updatedAt,
    sheet: sheetSchema.parse(JSON.parse(c.sheet)),
    state: stateSchema.parse(JSON.parse(c.state)),
    ...(withKey ? { key: c.key } : {}),
  }
}

export function publicRoll(r: { id: string; characterId: string | null; who: string; kind: string; label: string; formula: string; total: number; detail: string; hidden: boolean; createdAt: Date }) {
  return { ...r, detail: JSON.parse(r.detail) }
}
