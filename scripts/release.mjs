// Cuts a patch release when the freshly built plugin differs from the committed one.
// Used by .github/workflows/release.yml after `npm test` has rebuilt editor/index.html:
//   node scripts/release.mjs        → prints the new version, or nothing when there is nothing to release
// It bumps the version in orca-plugin.json, package.json and package-lock.json and prepends a
// CHANGELOG entry listing the commits since the last tag. Committing, tagging and pushing are left
// to the workflow.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const writeJson = (f, data) => fs.writeFileSync(path.join(ROOT, f), JSON.stringify(data, null, 2) + '\n')

const changed = git('status', '--porcelain', '--', 'editor/index.html', 'vendor/plantuml-stdlib')
if (!changed) process.exit(0) // the released build is up to date

const lastTag = git('tag', '--list', 'v*', '--sort=-v:refname').split('\n')[0]
if (!lastTag) {
  console.error('No release tag yet. Tag the first release (v1.0.0) by hand after testing it in Orca.')
  process.exit(1)
}

const manifest = readJson('orca-plugin.json')
const [major, minor, patch] = manifest.version.split('.').map(Number)
const version = `${major}.${minor}.${patch + 1}`

manifest.version = version
writeJson('orca-plugin.json', manifest)
for (const f of ['package.json', 'package-lock.json']) {
  const data = readJson(f)
  data.version = version
  if (data.packages?.['']) data.packages[''].version = version
  writeJson(f, data)
}

const commits = git('log', '--no-merges', '--format=%s', `${lastTag}..HEAD`)
  .split('\n')
  .filter((s) => s && !s.startsWith('Release '))
const stdlib = git('status', '--porcelain', '--', 'vendor/plantuml-stdlib')
  .split('\n')
  .filter(Boolean)
  .map((l) => path.basename(l.slice(3), '.min.js.gz'))
const lines = [
  ...commits.map((s) => `- ${s}`),
  ...(stdlib.length ? [`- Update PlantUML stdlib bundles: ${stdlib.join(', ')}`] : []),
]
const entry = `## ${version}\n\n${lines.length ? lines.join('\n') : '- Rebuild'}\n\n`
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')
fs.writeFileSync(path.join(ROOT, 'CHANGELOG.md'), changelog.replace(/^(# Changelog\n\n)/, `$1${entry}`))
fs.writeFileSync(path.join(ROOT, 'release-notes.md'), lines.join('\n') || '- Rebuild')

console.log(version)
