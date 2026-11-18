import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStatePatch } from './schema'

test('a state patch carries only the keys that were sent', () => {
  assert.deepEqual(parseStatePatch({ gold: 25 }), { gold: 25 })
  assert.deepEqual(parseStatePatch({ hp: 10, temp: 0 }), { hp: 10, temp: 0 })
})

test('an invalid patch is rejected', () => {
  assert.throws(() => parseStatePatch({ gold: -1 }))
  assert.throws(() => parseStatePatch({ items: [{ id: 'x', name: '', qty: 1 }] }))
})
