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
