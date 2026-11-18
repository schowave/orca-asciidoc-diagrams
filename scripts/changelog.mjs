// Pure helpers for scripts/release.mjs: turn the CHANGELOG's "## Unreleased" section into a release entry.
// Changes add their user-facing notes under "## Unreleased" as they land; a release renames that section
// to the new version and opens an empty one above it.

const UNRELEASED = /^## Unreleased\n([\s\S]*?)(?=^## |(?![\s\S]))/m

/** The bullet lines under "## Unreleased" (empty when the section is missing or has none). */
export function unreleasedNotes(changelog) {
  const m = UNRELEASED.exec(changelog)
  return m ? m[1].split('\n').filter((l) => l.startsWith('- ')) : []
}

/**
 * The changelog with a "## <version>" entry holding `lines`, below a fresh, empty "## Unreleased" section.
 * The old "## Unreleased" section is replaced by the entry.
 */
export function withRelease(changelog, version, lines) {
  const entry = `## Unreleased\n\n## ${version}\n\n${lines.join('\n')}\n\n`
  if (UNRELEASED.test(changelog)) return changelog.replace(UNRELEASED, entry)
  return changelog.replace(/^(# Changelog\n\n)/, `$1${entry}`)
}

/**
 * The release-note line naming the runtime dependencies (package.json "dependencies", what ends up in the bundle)
 * that changed between two package.json objects, or undefined when none did.
 * Example: "- Updated dependencies: dompurify 3.4.17 → 3.4.18, mermaid 12.2.0 → 12.3.0".
 */
export function dependencyLine(before, after) {
  const was = before?.dependencies ?? {}
  const now = after?.dependencies ?? {}
  const changes = [...new Set([...Object.keys(was), ...Object.keys(now)])]
    .sort()
    .filter((name) => was[name] !== now[name])
    .map((name) => {
      if (!(name in now)) return `${name} removed`
      if (!(name in was)) return `${name} ${now[name]} added`
      return `${name} ${was[name]} → ${now[name]}`
    })
  return changes.length ? `- Updated dependencies: ${changes.join(', ')}` : undefined
}
