// AsciiDoc → HTML with the preview's extensions. No DOM, so the unit tests can run it in Node.
import { load, Extensions } from '@asciidoctor/core'
import { escapeHtml, type Diagram, type DiagramKind } from './text.ts'

export type Converted = {
  html: string
  /** Diagram sources, in document order; each placeholder carries its index as `data-idx`. */
  diagrams: Diagram[]
  /** `left` or `right` when the document asks for a TOC sidebar. */
  tocPosition?: string
  /** `:stem:` is set: the document wants its math rendered. */
  stem: boolean
}

const KINDS: DiagramKind[] = ['plantuml', 'mermaid', 'graphviz']

// [plantuml] / [mermaid] / [graphviz] blocks become empty placeholders with an index into `diagrams`.
// The source stays out of the HTML: DOMPurify drops attributes that contain "-->", common in diagrams.
function diagramBlocks(registry: any, diagrams: Diagram[]) {
  for (const kind of KINDS) {
    registry.block(function (this: any) {
      this.named(kind)
      this.onContexts('listing', 'literal', 'open', 'paragraph')
      this.parseContentAs('raw')
      this.process(function (this: any, parent: any, reader: any, attrs: any) {
        // The reader holds only this block's raw content; readLines() is async in asciidoctor 4.
        const idx = diagrams.push({ kind, src: reader.getLines().join('\n'), layout: attrs.layout }) - 1
        const title = attrs.title ? `<div class="title">${escapeHtml(attrs.title)}</div>` : ''
        const html =
          `<div class="diagramblock" data-kind="${kind}">` +
          `<div class="diagram" data-kind="${kind}" data-idx="${idx}"></div>${title}</div>`
        return this.createPassBlock(parent, html, {})
      })
    })
  }
}

// The frame has no file system: every include:: becomes a visible placeholder.
function unresolvedIncludes(registry: any) {
  registry.includeProcessor(function (this: any) {
    this.handles(() => true)
    this.process(function (_doc: any, reader: any, target: string, attrs: any) {
      const shown = target.replace(/[+`]/g, '')
      reader.pushInclude(
        ['[.unresolved-include]', '****', `Include not resolvable in the preview: \`+${shown}+\``, '****'],
        target,
        target,
        1,
        attrs,
      )
    })
  })
}

/** Converts one document. Each call gets its own extension registry, so overlapping calls share no state. */
export async function convertAdoc(text: string): Promise<Converted> {
  const diagrams: Diagram[] = []
  const registry = Extensions.create()
  diagramBlocks(registry, diagrams)
  unresolvedIncludes(registry)
  const doc = await load(text, {
    safe: 'secure',
    extension_registry: registry,
    // highlight.js is the only highlighter that works here (client-side, see highlightCode in editor.ts).
    attributes: { showtitle: true, 'source-highlighter': 'highlight.js' },
  })
  const html = (await doc.convert()) as string
  return {
    html,
    diagrams,
    tocPosition: (doc.getAttribute('toc-position') as string | null) ?? undefined,
    stem: doc.hasAttribute('stem'),
  }
}
