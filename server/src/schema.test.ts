import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStatePatch, readState } from './schema'

test('a state patch carries only the keys that were sent', () => {
  assert.deepEqual(parseStatePatch({ coins: { cp: 0, sp: 3, ep: 0, gp: 25, pp: 0 } }), { coins: { cp: 0, sp: 3, ep: 0, gp: 25, pp: 0 } })
  assert.deepEqual(parseStatePatch({ hp: 10, temp: 0 }), { hp: 10, temp: 0 })
})

test('an invalid patch is rejected', () => {
  assert.throws(() => parseStatePatch({ coins: { gp: -1 } }))
  assert.throws(() => parseStatePatch({ items: [{ id: 'x', name: '', qty: 1 }] }))
})

test('old rows migrate: gold becomes gp, coin items become coins', () => {
  const old = JSON.stringify({
    hp: 5,
    gold: 120,
    items: [
      { id: 'a', name: 'Lano', qty: 1 },
      { id: 'b', name: 'Stříbrňáky (st)', qty: 7 },
      { id: 'c', name: 'Elektrum (el)', qty: 2 },
      { id: 'd', name: 'Měďáky (md)', qty: 30 },
    ],
  })
  const s = readState(old)
  assert.deepEqual(s.coins, { cp: 30, sp: 7, ep: 2, gp: 120, pp: 0 })
  assert.deepEqual(s.items.map((i) => i.name), ['Lano'])
  assert.equal(s.items[0].weight, 0)
  assert.equal('gold' in s, false)
})

test('new rows are left alone', () => {
  const s = readState(JSON.stringify({ hp: 1, coins: { gp: 4 }, items: [{ id: 'b', name: 'Stříbrňáky (st)', qty: 7 }] }))
  assert.equal(s.coins.gp, 4)
  assert.equal(s.items.length, 1)
})
