// Downloads the PlantUML stdlib bundles the build embeds into vendor/plantuml-stdlib/ (a gitignored
// cache) and checks them against vendor/plantuml-stdlib.lock.json.
//   node scripts/fetch-stdlib.mjs            fetch what is missing; warn when upstream differs from the lock
//   node scripts/fetch-stdlib.mjs --update   fetch everything and pin the current upstream in the lock
//   PLANTUML_STDLIB=c4,awslib14 node scripts/fetch-stdlib.mjs   custom selection (see stdlib-list.mjs)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatLock, sha256 } from './stdlib-lock.mjs'
import { STDLIB, selectedStdlib } from './stdlib-list.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'vendor/plantuml-stdlib')
const LOCK = path.join(ROOT, 'vendor/plantuml-stdlib.lock.json')
const BASE = 'https://plantuml.github.io/plantuml/js-plantuml/'
const update = process.argv.includes('--update')

const lock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {}
fs.mkdirSync(DIR, { recursive: true })

for (const lib of selectedStdlib()) {
  const file = path.join(DIR, `${lib}.min.js`)
  const pinned = lock[lib]
  if (!update && pinned && fs.existsSync(file) && sha256(fs.readFileSync(file)) === pinned) {
    console.log(`cached ${lib}`)
    continue
  }
  const res = await fetch(`${BASE}${lib}.min.js`)
  if (!res.ok) throw new Error(`${lib}: HTTP ${res.status}`)
  const js = Buffer.from(await res.arrayBuffer())
  const hash = sha256(js)
  fs.writeFileSync(file, js)
  if (update && STDLIB.includes(lib)) {
    console.log(pinned === hash ? `unchanged ${lib}` : `pinned ${lib} ${hash.slice(0, 12)}`)
    lock[lib] = hash
  } else if (pinned && pinned !== hash) {
    console.warn(`warning: ${lib} differs from the lock (upstream changed); the release workflow pins it`)
  } else {
    console.log(`fetched ${lib}${pinned ? '' : ' (not pinned)'}`)
  }
}
if (update) fs.writeFileSync(LOCK, formatLock(lock))
