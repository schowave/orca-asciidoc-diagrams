import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { nextVersion, withInstallUrlVersion } from '../../scripts/version.mjs'

test('nextVersion defaults to a patch bump', () => {
  assert.equal(nextVersion('1.0.0'), '1.0.1')
  assert.equal(nextVersion('1.2.9', 'patch'), '1.2.10')
  assert.equal(nextVersion('1.2.9', 'whatever'), '1.2.10')
})

test('nextVersion bumps minor and major and resets the lower parts', () => {
  assert.equal(nextVersion('1.2.9', 'minor'), '1.3.0')
  assert.equal(nextVersion('1.2.9', 'major'), '2.0.0')
})

test('withInstallUrlVersion points the README install URL at the new tag', () => {
  const readme =
    'Paste:\n\n   https://github.com/schowave/orca-asciidoc-diagrams#v1.1.1\n\nOther: github.com/other/repo#v9.9.9\n'
  assert.equal(
    withInstallUrlVersion(readme, '1.2.0'),
    'Paste:\n\n   https://github.com/schowave/orca-asciidoc-diagrams#v1.2.0\n\nOther: github.com/other/repo#v9.9.9\n',
  )
})
