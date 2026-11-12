// AsciiDoc → HTML with the preview's extensions. No DOM, so the unit tests can run it in Node.
import { load, Extensions } from '@asciidoctor/core'
import { escapeHtml, cssLength, type Diagram, type DiagramKind } from './text.ts'

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
const ALIGNMENTS = new Set(['left', 'center', 'right'])

// A diagram is a figure, as in asciidoctor-diagram: it gets its caption number while the document is parsed,
// so diagrams and images share one counter in document order. Its HTML is written after load() (see
// writeFigures), once titles have their substitutions applied. The pass block carries what it needs in
// `diagram-idx` (a block) or `diagram-target` (a block macro, whose file the preview cannot read).
function figure(dsl: any, parent: any, kind: DiagramKind, attrs: any, data: Record<string, string | number>) {
  const block = dsl.createPassBlock(parent, [], { 'diagram-kind': kind, ...data })
  if (attrs.title) {
    block.title = attrs.title
    block.assignCaption(attrs.caption, 'figure')
  }
  return block
}

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
        return figure(this, parent, kind, attrs, { 'diagram-idx': idx })
      })
    })
    // plantuml::file.puml[] reads a file, which the frame cannot: show a placeholder that keeps the figure.
    registry.blockMacro(function (this: any) {
      this.named(kind)
      this.process(function (this: any, parent: any, target: string, attrs: any) {
        return figure(this, parent, kind, attrs, { 'diagram-target': target })
      })
    })
  }
}

function figureHtml(block: any): string {
  const kind = block.getAttribute('diagram-kind')
  const classes = ['diagramblock']
  const align = block.getAttribute('align')
  if (ALIGNMENTS.has(align)) classes.push(`text-${align}`)
  if (block.role) classes.push(block.role)
  const id = block.id ? ` id="${escapeHtml(block.id)}"` : ''
  const title = block.hasTitle() ? `<div class="title">${block.captionedTitle()}</div>` : ''
  let body: string
  if (block.hasAttribute('diagram-idx')) {
    const size = (['width', 'height'] as const)
      .map((dim) => [dim, cssLength(block.getAttribute(dim))])
      .filter(([, value]) => value)
      .map(([dim, value]) => ` data-${dim}="${value}"`)
      .join('')
    body = `<div class="diagram" data-kind="${kind}" data-idx="${block.getAttribute('diagram-idx')}"${size}></div>`
  } else {
    const target = escapeHtml(block.getAttribute('diagram-target'))
    body =
      `<div class="sidebarblock unresolved-include"><div class="content"><div class="paragraph">` +
      `<p>Diagram file not resolvable in the preview: <code>${target}</code></p></div></div></div>`
  }
  return `<div${id} class="${escapeHtml(classes.join(' '))}" data-kind="${kind}">${body}${title}</div>`
}

function writeFigures(doc: any) {
  const figures = doc.findBy({ context: 'pass', traverseDocuments: true }, (b: any) => b.hasAttribute('diagram-kind'))
  for (const block of figures) block.lines = [figureHtml(block)]
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
  writeFigures(doc)
  const html = (await doc.convert()) as string
  return {
    html,
    diagrams,
    tocPosition: (doc.getAttribute('toc-position') as string | null) ?? undefined,
    stem: doc.hasAttribute('stem'),
  }
}
