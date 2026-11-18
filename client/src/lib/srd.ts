// SRD 5.2 spell texts, loaded once per page and cached by the service worker.
import { useEffect, useState } from 'react'

export interface SrdSpell {
  key: string
  name: string
  nameCs?: string
  level: number
  school: string
  time: string
  range: string
  components: string
  componentsCs?: string
  duration: string
  concentration: boolean
  ritual: boolean
  classes: string[]
  text: string
  textCs?: string
  higher: string
  higherCs?: string
}

export const SCHOOL: Record<string, string> = {
  abjuration: 'ochranná',
  conjuration: 'vyvolávací',
  divination: 'věštecká',
  enchantment: 'očarovávací',
  evocation: 'zaklínací',
  illusion: 'iluzorní',
  necromancy: 'nekromantská',
  transmutation: 'přeměňovací',
}

const TIME: Record<string, string> = {
  action: 'akce',
  'bonus-action': 'bonusová akce',
  reaction: 'reakce',
  '1minute': '1 minuta',
  '10minutes': '10 minut',
  '1hour': '1 hodina',
}

const UNIT: [RegExp, (n: number) => string][] = [
  [/^(\d+) feet$/, (n) => `${n} stop`],
  [/^(\d+) miles?$/, (n) => (n === 1 ? '1 míle' : n < 5 ? `${n} míle` : `${n} mil`)],
  [/^(\d+) minutes?$/, (n) => (n === 1 ? '1 minuta' : n < 5 ? `${n} minuty` : `${n} minut`)],
  [/^(\d+) hours?$/, (n) => (n === 1 ? '1 hodina' : n < 5 ? `${n} hodiny` : `${n} hodin`)],
  [/^(\d+) days?$/, (n) => (n === 1 ? '1 den' : n < 5 ? `${n} dny` : `${n} dní`)],
  [/^(\d+) rounds?$/, (n) => (n === 1 ? '1 kolo' : n < 5 ? `${n} kola` : `${n} kol`)],
]

const WORD: Record<string, string> = {
  self: 'sebe',
  touch: 'dotyk',
  sight: 'dohled',
  special: 'zvláštní',
  unlimited: 'neomezený',
  instantaneous: 'okamžité',
  'until dispelled': 'dokud není rozptýleno',
  'until dispelled or triggered': 'dokud není rozptýleno nebo spuštěno',
}

/** Casting time, range and duration in Czech; unknown values pass through unchanged. */
export function csMeta(value: string): string {
  const v = value.trim()
  if (TIME[v]) return TIME[v]
  const w = WORD[v.toLowerCase()]
  if (w) return w
  for (const [re, f] of UNIT) {
    const m = v.match(re)
    if (m) return f(Number(m[1]))
  }
  return v
}

let cache: Promise<Map<string, SrdSpell>> | null = null

export function loadSpells(): Promise<Map<string, SrdSpell>> {
  cache ??= fetch('/srd/spells.json')
    .then((r) => r.json() as Promise<SrdSpell[]>)
    .then((list) => new Map(list.map((s) => [s.key, s])))
    .catch((e) => {
      cache = null
      throw e
    })
  return cache
}

export function useSpells(enabled = true) {
  const [spells, setSpells] = useState<Map<string, SrdSpell> | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadSpells().then((m) => live && setSpells(m), () => {})
    return () => {
      live = false
    }
  }, [enabled])
  return spells
}
