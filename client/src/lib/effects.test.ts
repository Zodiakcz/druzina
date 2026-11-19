import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addToFormula, combineMode } from './dice.ts'
import { boost, fromPreset, labelWith, spendResource, suggestedPresets, toggleEffect } from './effects.ts'
import type { Sheet, State } from './types'

const sheet = (): Sheet => ({
  name: 'Oren', player: '', species: '', background: '', classes: [{ name: 'Barbar', subclass: '', level: 9 }], portrait: '',
  abilities: { str: 18, dex: 14, con: 16, int: 8, wis: 10, cha: 10 },
  saves: [], skills: {}, ac: 15, speed: 40, hpMax: 64, initiativeBonus: 0, hitDice: [],
  senses: '', proficiencies: '', notes: '', spellcasting: null,
  attacks: [{ id: 'a1', name: 'Sekera', toHit: 7, damage: '1d12+4', damageType: 'sečné', notes: '', ability: 'str' }],
  resources: [{ id: 'r1', name: 'Zuřivost', nameEn: 'Rage', max: 4, reset: 'long' }],
  features: [{ id: 'f1', name: 'Bezohledný útok', source: 'Barbar 2', text: '' }],
  effects: [],
})

const state = (): State => ({
  hp: 64, temp: 0, hitDiceUsed: {}, slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], pactUsed: 0, resources: {},
  conditions: [], exhaustion: 0, heroic: false, death: { ok: 0, fail: 0 }, concentration: 'Něco', active: [], items: [],
  coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
})

test('add to formula: flat folds in, dice go first', () => {
  assert.equal(addToFormula('1d12+3', 2), '1d12+5')
  assert.equal(addToFormula('1d20+4', 0, '+1d4'), '1d20+1d4+4')
  assert.equal(addToFormula('3', 2), '5')
  assert.equal(addToFormula('1d6-1', 1), '1d6')
  assert.equal(addToFormula('nonsense', 2), 'nonsense')
})

test('advantage and disadvantage cancel out', () => {
  assert.equal(combineMode('normal', 'adv'), 'adv')
  assert.equal(combineMode('dis', 'normal'), 'dis')
  assert.equal(combineMode('adv', 'dis'), 'normal')
})

test('rage preset scales with barbarian level and links the resource', () => {
  const rage = fromPreset(sheet(), 'rage', 'e1')!
  assert.equal(rage.resourceId, 'r1')
  assert.equal(rage.mods.find((m) => m.on === 'damage')!.bonus, '3')
})

test('rage: +3 to Strength damage, advantage on Strength checks, nothing for Dex', () => {
  const s = sheet()
  s.effects = [fromPreset(s, 'rage', 'e1')!]
  const st = { ...state(), active: ['e1'] }
  assert.deepEqual(boost(s, st, 'damage', 'str'), { flat: 3, dice: '', mode: 'normal', names: ['Zuřivost'] })
  assert.equal(boost(s, st, 'check', 'str').mode, 'adv')
  assert.equal(boost(s, st, 'damage', 'dex').flat, 0)
  assert.equal(boost(s, st, 'damage', '').flat, 0)
  assert.equal(labelWith('Sekera: zranění', boost(s, st, 'damage', 'str')), 'Sekera: zranění (Zuřivost)')
  assert.equal(boost(s, { ...st, active: [] }, 'damage', 'str').flat, 0)
})

test('preset rage follows the level; a hand-made copy keeps its number', () => {
  const s = sheet()
  s.classes = [{ name: 'Barbar', subclass: '', level: 5 }]
  s.effects = [fromPreset(s, 'rage', 'e1')!]
  const st = { ...state(), active: ['e1'] }
  assert.equal(boost(s, st, 'damage', 'str').flat, 2)
  s.classes = [{ name: 'Barbar', subclass: '', level: 16 }]
  assert.equal(boost(s, st, 'damage', 'str').flat, 4)
  s.effects = [{ ...s.effects[0], preset: '' }]
  assert.equal(boost(s, st, 'damage', 'str').flat, 2)
})

test('bless adds a die to every attack', () => {
  const s = sheet()
  s.effects = [fromPreset(s, 'bless', 'b')!]
  assert.equal(boost(s, { ...state(), active: ['b'] }, 'attack', 'dex').dice, '+1d4')
})

test('switching rage on spends a use and ends concentration; off only switches off', () => {
  const s = sheet()
  s.effects = [fromPreset(s, 'rage', 'e1')!]
  const on = toggleEffect(s, state(), 'e1')
  assert.deepEqual(on, { active: ['e1'], resources: { r1: 1 }, concentration: '' })
  assert.deepEqual(toggleEffect(s, { ...state(), active: ['e1'] }, 'e1'), { active: [] })
})

test('spending a rage pip switches rage on; giving it back does not', () => {
  const s = sheet()
  s.effects = [fromPreset(s, 'rage', 'e1')!]
  assert.deepEqual(spendResource(s, state(), 'r1', 1).active, ['e1'])
  assert.equal(spendResource(s, { ...state(), resources: { r1: 2 } }, 'r1', 1).active, undefined)
})

test('presets are suggested from features and resources on the sheet', () => {
  const s = sheet()
  assert.deepEqual(suggestedPresets(s), ['rage', 'reckless'])
  s.effects = [fromPreset(s, 'rage', 'e1')!]
  assert.deepEqual(suggestedPresets(s), ['reckless'])
})
