// Pure text helpers of the preview. No DOM and no imports, so the unit tests can load this file directly.

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export const notBundledMessage = (lib: string, bundled: Iterable<string>) =>
  `PlantUML library <${lib}> is not bundled in this preview. Bundled: ${[...bundled].join(', ') || 'none'}.`

/**
 * `!include <lib/...>` of a library we do not bundle: returns its name, so the preview can fail with a
 * clear message instead of PlantUML's generic "cannot include" diagram.
 */
export function unbundledStdlib(src: string, bundled: ReadonlySet<string>): string | undefined {
  for (const m of src.matchAll(/^\s*!include(?:_many|_once)?\s+<([^/>]+)/gim)) {
    if (!bundled.has(m[1].toLowerCase())) return m[1]
  }
}
