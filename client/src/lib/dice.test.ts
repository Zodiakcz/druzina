import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFormula, roll, critFormula, d20, poolFormula, prettyFormula } from './dice.ts'

test('pool formula', () => {
  assert.equal(poolFormula({ 8: 1, 6: 2 }, 3), '2d6+1d8+3')
  assert.equal(poolFormula({ 20: 1 }, -2), '1d20-2')
  assert.equal(poolFormula({ 6: 0 }, 4), '')
  assert.ok(parseFormula(poolFormula({ 4: 3, 100: 1 }, -1)))
  assert.equal(prettyFormula('2d6+1d8-1'), '2k6 + 1k8 − 1')
})

// Deterministic "random": returns values from a list (0-based, so 19 means a natural 20).
const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

test('parses and rejects formulas', () => {
  assert.ok(parseFormula('1d20+5'))
  assert.ok(parseFormula('2d6 + 1d4 - 1'))
  assert.ok(parseFormula('d12+3'))
  assert.ok(parseFormula('2k6'))
  assert.equal(parseFormula(''), null)
  assert.equal(parseFormula('1d20+'), null)
  assert.equal(parseFormula('abc'), null)
  assert.equal(parseFormula('101d6'), null)
  assert.equal(parseFormula('1d1'), null)
})

test('sums dice and modifiers', () => {
  const r = roll('2d6+3', 'normal', seq(1, 4))!
  assert.equal(r.total, 2 + 5 + 3)
  assert.deepEqual(r.detail.parts[0].rolls, [2, 5])
})

test('negative dice subtract', () => {
  const r = roll('1d8-1d4', 'normal', seq(7, 1))!
  assert.equal(r.total, 8 - 2)
})

test('advantage keeps the higher d20, disadvantage the lower', () => {
  const adv = roll('1d20+2', 'adv', seq(4, 14))!
  assert.equal(adv.total, 15 + 2)
  assert.deepEqual(adv.detail.parts[0].kept, [1])
  const dis = roll('1d20+2', 'dis', seq(4, 14))!
  assert.equal(dis.total, 5 + 2)
})

test('flags natural 20 and 1 on the kept die only', () => {
  assert.equal(roll('1d20', 'normal', seq(19))!.detail.nat, 20)
  assert.equal(roll('1d20', 'normal', seq(0))!.detail.nat, 1)
  assert.equal(roll('1d20', 'adv', seq(0, 10))!.detail.nat, undefined)
})

test('crit doubles dice, not modifiers', () => {
  assert.equal(critFormula('1d12+3'), '2d12+3')
  assert.equal(critFormula('2d6+1d4+2'), '4d6+2d4+2')
})

test('d20 helper', () => {
  assert.equal(d20(0), '1d20')
  assert.equal(d20(5), '1d20+5')
  assert.equal(d20(-1), '1d20-1')
})
