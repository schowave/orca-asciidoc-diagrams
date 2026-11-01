import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { nextVersion } from '../../scripts/version.mjs'

test('nextVersion defaults to a patch bump', () => {
  assert.equal(nextVersion('1.0.0'), '1.0.1')
  assert.equal(nextVersion('1.2.9', 'patch'), '1.2.10')
  assert.equal(nextVersion('1.2.9', 'whatever'), '1.2.10')
})

test('nextVersion bumps minor and major and resets the lower parts', () => {
  assert.equal(nextVersion('1.2.9', 'minor'), '1.3.0')
  assert.equal(nextVersion('1.2.9', 'major'), '2.0.0')
})
