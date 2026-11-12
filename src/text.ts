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

export type DiagramKind = 'plantuml' | 'mermaid' | 'graphviz'
export type Diagram = { kind: DiagramKind; src: string; layout?: string }

/** PlantUML needs `@startuml … @enduml`; asciidoctor-diagram adds it when the block has no `@start…` line. */
export const wrapPlantUml = (src: string) => (/^\s*@start/.test(src) ? src : `@startuml\n${src}\n@enduml`)

/** Cache key of a rendered diagram. Only Mermaid follows the theme, so only its key carries it. */
export const diagramKey = ({ kind, src, layout }: Diagram, dark: boolean) =>
  `${kind}:${kind === 'mermaid' && dark ? 'dark' : 'light'}:${layout ?? ''}:${src}`

/** Target id of an in-document link (`#id`), percent-decoded when that is valid. */
export function anchorId(href: string): string {
  const id = href.slice(1)
  try {
    return decodeURIComponent(id)
  } catch {
    return id // a stray "%" is not an escape
  }
}

export type MathPart = string | { tex: string; notation: 'asciimath' | 'latexmath'; display: boolean }

// :stem: — Asciidoctor leaves the math for a client-side renderer: \$…\$ (asciimath), \(…\) (latexmath)
// inline, and \$…\$ / \[…\] inside .stemblock for blocks.
const MATH = /\\\$([\s\S]+?)\\\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g

/**
 * Splits a text node into plain text and formulas. `inBlock` is true inside a `.stemblock`, where every
 * formula is display math. Returns undefined when the text holds no formula.
 */
export function splitMath(text: string, inBlock: boolean): MathPart[] | undefined {
  const parts: MathPart[] = []
  let last = 0
  for (const m of text.matchAll(MATH)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const [, ascii, latexInline, latexBlock] = m
    parts.push(
      ascii !== undefined
        ? { tex: ascii, notation: 'asciimath', display: inBlock }
        : { tex: latexInline ?? latexBlock, notation: 'latexmath', display: inBlock || latexBlock !== undefined },
    )
    last = m.index + m[0].length
  }
  if (!last) return undefined
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
