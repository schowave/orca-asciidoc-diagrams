// Refreshes the vendored PlantUML stdlib bundles. Run manually when bumping @plantuml/core.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://plantuml.github.io/plantuml/js-plantuml/'
for (const lib of ['c4', 'kubernetes', 'azure']) {
  const res = await fetch(`${BASE}${lib}.min.js`)
  if (!res.ok) throw new Error(`${lib}: HTTP ${res.status}`)
  fs.writeFileSync(path.join(ROOT, 'vendor/plantuml-stdlib', `${lib}.min.js`), await res.text())
  console.log(`updated ${lib}.min.js`)
}
