import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { computeStats, renderStats } from '../../scripts/commit-stats.mjs'

const c = (subject: string, body = '') => ({ subject, body: `${subject}\n\n${body}` })

test('computeStats counts agent commits by trailer and ignores release commits', () => {
  const stats = computeStats([
    c('Add feature', 'Assisted-by: Claude Code'),
    c('Fix typo'),
    c('Release v1.0.1', 'Assisted-by: Claude Code'),
    c('Revert "Add feature"', 'Assisted-by: Claude Code'),
  ])
  assert.equal(stats.commits, 3)
  assert.equal(stats.agentCommits, 2)
  assert.equal(stats.agentShare, '66.7 %')
  assert.equal(stats.reverts, 1)
  assert.equal(stats.agentRevertRate, '50.0 %')
})

test('computeStats reports n/a without commits', () => {
  const stats = computeStats([])
  assert.equal(stats.agentShare, 'n/a')
  assert.equal(stats.agentRevertRate, 'n/a')
})

test('renderStats writes a table with the measures', () => {
  const md = renderStats(computeStats([c('Add', 'Assisted-by: Claude Code')]), '2026-11-01')
  assert.match(md, /as of 2026-11-01/)
  assert.match(md, /\| Agent share of commits \| 100\.0 % \|/)
})
