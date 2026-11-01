import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { changedLibs, formatLock, sha256 } from '../../scripts/stdlib-lock.mjs'

test('sha256 hashes like sha256sum', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('changedLibs lists changed, added and removed libraries, sorted', () => {
  assert.deepEqual(changedLibs({ c4: 'a', azure: 'b', logos: 'c' }, { c4: 'a', azure: 'x', tupadr3: 'd' }), [
    'azure',
    'logos',
    'tupadr3',
  ])
  assert.deepEqual(changedLibs({ c4: 'a' }, { c4: 'a' }), [])
})

test('formatLock sorts keys and ends with a newline', () => {
  assert.equal(formatLock({ zeta: '2', alpha: '1' }), '{\n  "alpha": "1",\n  "zeta": "2"\n}\n')
})
