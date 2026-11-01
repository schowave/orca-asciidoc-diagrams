// Writes docs/agent-stats.md: share of agent commits and revert rate, from the git history.
// Used by .github/workflows/release.yml; run by hand with `node scripts/agent-stats.mjs`.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { computeStats, renderStats } from './commit-stats.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })

const log = git('log', '--format=%s%x1f%B%x1e')
const commits = log
  .split('\x1e')
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => {
    const [subject, body] = r.split('\x1f')
    return { subject, body: body ?? '' }
  })

const asOf = git('log', '-1', '--format=%cs').trim()
fs.writeFileSync(path.join(ROOT, 'docs/agent-stats.md'), renderStats(computeStats(commits), asOf))
