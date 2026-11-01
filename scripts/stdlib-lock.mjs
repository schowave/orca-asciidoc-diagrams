// Pinning of the PlantUML stdlib bundles. The bundles themselves are not committed (the Orca catalog
// refuses archives, and raw they are ~26 MB); vendor/plantuml-stdlib.lock.json records the SHA-256 of
// each library's JavaScript instead, so builds can tell which upstream content they use and the
// release workflow can tell when a library changed.
import { createHash } from 'node:crypto'

export const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Libraries whose pinned hash differs between two locks, or that only one of them has. */
export function changedLibs(before, after) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].filter((name) => before[name] !== after[name]).sort()
}

/** The lock as committed: keys sorted, one library per line. */
export const formatLock = (lock) =>
  JSON.stringify(Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n'
