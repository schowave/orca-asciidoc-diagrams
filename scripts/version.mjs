// The next plugin version for a release step ("patch" is the default, also for unknown values).
export function nextVersion(current, bump = 'patch') {
  const [major, minor, patch] = current.split('.').map(Number)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

// The README's Git URL install line, pointed at a new release tag.
export const withInstallUrlVersion = (readme, version) =>
  readme.replace(/(github\.com\/schowave\/orca-asciidoc-diagrams#v)\d+\.\d+\.\d+/g, `$1${version}`)
