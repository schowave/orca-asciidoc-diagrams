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
import { changedLibs } from './stdlib-lock.mjs'
import { nextVersion, withInstallUrlVersion } from './version.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const writeJson = (f, data) => fs.writeFileSync(path.join(ROOT, f), JSON.stringify(data, null, 2) + '\n')

const lastTag = git('tag', '--list', 'v*', '--sort=-v:refname').split('\n')[0]
if (!lastTag) {
  console.error('No release tag yet. Tag the first release (v1.0.0) by hand after testing it in Orca.')
  process.exit(1)
}

// What Orca installs (or what feeds the build) and the listing shows. A release is due when any of
// it differs from the last tag: committed by hand since then, or rebuilt/refetched in this run.
const PLUGIN_PATHS = [
  'editor/index.html',
  'vendor/plantuml-stdlib.lock.json',
  'images',
  'orca-plugin.json',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
]
const changed =
  git('status', '--porcelain', '--', ...PLUGIN_PATHS) ||
  git('diff', '--name-only', lastTag, 'HEAD', '--', ...PLUGIN_PATHS)
// A dispatched minor/major release also happens without such changes.
const forced = ['minor', 'major'].includes(process.env.RELEASE_BUMP ?? '')
if (!changed && !forced) process.exit(0) // the released plugin is up to date

const manifest = readJson('orca-plugin.json')
// RELEASE_BUMP=minor|major for feature releases (workflow_dispatch input); scheduled runs are patches.
const bump = process.env.RELEASE_BUMP || 'patch'
const version = nextVersion(manifest.version, bump)

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
const LOCK = 'vendor/plantuml-stdlib.lock.json'
const lockAt = (ref) => {
  try {
    return JSON.parse(git('show', `${ref}:${LOCK}`))
  } catch {
    return {} // not committed yet at that ref
  }
}
const stdlib = changedLibs(lockAt('HEAD'), readJson(LOCK))
const lines = [
  ...commits.map((s) => `- ${s}`),
  ...(stdlib.length ? [`- Update PlantUML stdlib bundles: ${stdlib.join(', ')}`] : []),
]
const entry = `## ${version}\n\n${lines.length ? lines.join('\n') : '- Rebuild'}\n\n`
const readme = path.join(ROOT, 'README.md')
fs.writeFileSync(readme, withInstallUrlVersion(fs.readFileSync(readme, 'utf8'), version))
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')
fs.writeFileSync(path.join(ROOT, 'CHANGELOG.md'), changelog.replace(/^(# Changelog\n\n)/, `$1${entry}`))
fs.writeFileSync(path.join(ROOT, 'release-notes.md'), lines.join('\n') || '- Rebuild')

console.log(version)
