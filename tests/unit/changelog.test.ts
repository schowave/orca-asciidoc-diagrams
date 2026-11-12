import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { unreleasedNotes, withRelease } from '../../scripts/changelog.mjs'

const CHANGELOG = '# Changelog\n\n## Unreleased\n\n- New thing\n- Fixed thing\n\n## 1.0.0\n\n- First\n'

test('unreleasedNotes returns the bullets under Unreleased only', () => {
  assert.deepEqual(unreleasedNotes(CHANGELOG), ['- New thing', '- Fixed thing'])
  assert.deepEqual(unreleasedNotes('# Changelog\n\n## Unreleased\n\n## 1.0.0\n\n- First\n'), [])
  assert.deepEqual(unreleasedNotes('# Changelog\n\n## 1.0.0\n\n- First\n'), [])
})

test('unreleasedNotes reads an Unreleased section at the end of the file', () => {
  assert.deepEqual(unreleasedNotes('# Changelog\n\n## Unreleased\n\n- Only\n'), ['- Only'])
})

test('withRelease turns Unreleased into the version and opens a new empty section', () => {
  assert.equal(
    withRelease(CHANGELOG, '1.1.0', ['- New thing', '- Fixed thing', '- Update PlantUML stdlib bundles: c4']),
    '# Changelog\n\n## Unreleased\n\n## 1.1.0\n\n- New thing\n- Fixed thing\n- Update PlantUML stdlib bundles: c4\n\n## 1.0.0\n\n- First\n',
  )
})

test('withRelease adds both sections when the changelog has no Unreleased section', () => {
  assert.equal(
    withRelease('# Changelog\n\n## 1.0.0\n\n- First\n', '1.0.1', ['- Rebuild']),
    '# Changelog\n\n## Unreleased\n\n## 1.0.1\n\n- Rebuild\n\n## 1.0.0\n\n- First\n',
  )
})
