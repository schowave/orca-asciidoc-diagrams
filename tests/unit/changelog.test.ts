import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { dependencyLine, unreleasedNotes, withRelease } from '../../scripts/changelog.mjs'

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

test('dependencyLine names changed, added and removed runtime dependencies, sorted', () => {
  const before = { dependencies: { mermaid: '12.2.0', dompurify: '3.4.17', katex: '0.19.1', brotli: '2.1.0' } }
  const after = { dependencies: { mermaid: '12.3.0', dompurify: '3.4.18', katex: '0.19.1', 'viz.js': '2.1.2' } }
  assert.equal(
    dependencyLine(before, after),
    '- Updated dependencies: brotli removed, dompurify 3.4.17 → 3.4.18, mermaid 12.2.0 → 12.3.0, viz.js 2.1.2 added',
  )
})

test('dependencyLine ignores dev dependencies and returns undefined when nothing changed', () => {
  const pkg = { dependencies: { mermaid: '12.3.0' }, devDependencies: { eslint: '10.14.0' } }
  assert.equal(dependencyLine(pkg, { ...pkg, devDependencies: { eslint: '10.15.0' } }), undefined)
  assert.equal(dependencyLine({}, {}), undefined)
})
