// Refreshes the vendored PlantUML stdlib bundles (stored gzip-compressed to keep the repo small).
// Run manually when bumping @plantuml/core: node scripts/fetch-stdlib.mjs
// Custom selection: PLANTUML_STDLIB=c4,awslib14 node scripts/fetch-stdlib.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { selectedStdlib } from './stdlib-list.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'vendor/plantuml-stdlib')
const BASE = 'https://plantuml.github.io/plantuml/js-plantuml/'
fs.mkdirSync(DIR, { recursive: true })
for (const lib of selectedStdlib()) {
  const res = await fetch(`${BASE}${lib}.min.js`)
  if (!res.ok) throw new Error(`${lib}: HTTP ${res.status}`)
  const js = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(path.join(DIR, `${lib}.min.js.gz`), zlib.gzipSync(js, { level: 9 }))
  console.log(`updated ${lib}.min.js.gz (${(js.length / 1024).toFixed(0)} KiB raw)`)
}
