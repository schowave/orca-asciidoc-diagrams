// AsciiDoc preview frame. Runs inside Orca's sandboxed custom-editor iframe:
// no network, no eval, no wasm, no file system. mermaid, PlantUML and the bundled PlantUML stdlib
// libraries are embedded compressed and loaded on first use (src/payloads.ts).
import { load, Extensions } from '@asciidoctor/core'
import DOMPurify from 'dompurify'
import { loadPayload, payloadIds } from './payloads'

declare const mermaid: any
declare const PlantUML: {
  renderToString(lines: string[], ok: (svg: string) => void, err: (msg: string) => void, opts?: object): void
}
declare const orca: any

type Kind = 'plantuml' | 'mermaid' | 'graphviz'
type Doc = { version: number; content: { kind: 'text'; text: string } }

const w = window as any

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// ---------------------------------------------------------------------------------------------
// AsciiDoc extensions

// [plantuml] / [mermaid] blocks become placeholders with an index into `sources`.
// The source stays out of the HTML: DOMPurify drops attributes that contain "-->", common in diagrams.
let sources: string[] = []
let layouts: (string | undefined)[] = [] // graphviz `layout=` attribute per diagram
const registry = Extensions.create()
for (const kind of ['plantuml', 'mermaid', 'graphviz'] as Kind[]) {
  registry.block(function (this: any) {
    this.named(kind)
    this.onContexts('listing', 'literal', 'open', 'paragraph')
    this.parseContentAs('raw')
    this.process(function (this: any, parent: any, reader: any, attrs: any) {
      // The reader holds only this block's raw content; readLines() is async in asciidoctor 4.
      const src: string = reader.getLines().join('\n')
      const title = attrs.title ? `<div class="title">${escapeHtml(attrs.title)}</div>` : ''
      const html =
        `<div class="diagramblock" data-kind="${kind}">` +
        `<div class="diagram" data-kind="${kind}" data-idx="${sources.push(src) - 1}"></div>${title}</div>`
      layouts[sources.length - 1] = attrs.layout
      return this.createPassBlock(parent, html, {})
    })
  })
}

// The frame has no file system: every include:: becomes a visible placeholder.
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

// ---------------------------------------------------------------------------------------------
// PlantUML stdlib: bundled libraries are decompressed and run only when a diagram includes them.

const BUNDLED_STDLIB = new Set(
  payloadIds()
    .filter((id) => id.startsWith('stdlib:'))
    .map((id) => id.slice(7)),
)
const notBundledMessage = (lib: string) =>
  `PlantUML library <${lib}> is not bundled in this preview. Bundled: ${[...BUNDLED_STDLIB].join(', ') || 'none'}.`

w.PLANTUML_STDLIB_LOADER = (url: string, ok: () => void, err: (msg: string) => void) => {
  const m = /([^/]+)\.min\.js$/.exec(url)
  if (!m) return false // themes.js, emoji.js, ...: let the engine handle (or fail) them
  const lib = m[1].toLowerCase()
  if (!BUNDLED_STDLIB.has(lib)) {
    err(notBundledMessage(lib))
    return true
  }
  loadPayload(`stdlib:${lib}`).then(ok, (e) => err(String(e)))
  return true
}

// ---------------------------------------------------------------------------------------------
// Diagrams

const root = document.getElementById('content')!
const cache = new Map<string, Promise<string>>()
let mermaidSeq = 0

const isDark = () => document.documentElement.classList.contains('dark')

// `!include <lib/...>` of a library we do not bundle: fail with a clear message instead of
// PlantUML's generic "cannot include" diagram.
function unbundledStdlib(src: string): string | undefined {
  for (const m of src.matchAll(/^\s*!include(?:_many|_once)?\s+<([^/>]+)/gim)) {
    if (!BUNDLED_STDLIB.has(m[1].toLowerCase())) return m[1]
  }
}

async function renderPlantUml(src: string): Promise<string> {
  const missing = unbundledStdlib(src)
  if (missing) return Promise.reject(new Error(notBundledMessage(missing)))
  await loadPayload('plantuml')
  const text = /^\s*@start/.test(src) ? src : `@startuml\n${src}\n@enduml`
  return new Promise((resolve, reject) =>
    PlantUML.renderToString(text.split('\n'), resolve, (msg) => reject(new Error(msg))),
  )
}

async function renderMermaid(src: string): Promise<string> {
  await loadPayload('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true, // we show our own error box instead of mermaid's appended error SVG
    theme: isDark() ? 'dark' : 'default',
  })
  const id = `mermaid-${++mermaidSeq}`
  try {
    const { svg } = await mermaid.render(id, src)
    return svg
  } finally {
    // mermaid renders into a temporary element on <body>; make sure nothing is left behind.
    document.getElementById(id)?.remove()
    document.getElementById(`d${id}`)?.remove()
  }
}

const GRAPHVIZ_LAYOUTS = new Set(['dot', 'neato', 'fdp', 'sfdp', 'twopi', 'circo', 'osage', 'patchwork'])
let vizModule: any

async function renderGraphviz(src: string, layout = 'dot'): Promise<string> {
  await loadPayload('graphviz')
  const Viz = w.Viz
  if (!GRAPHVIZ_LAYOUTS.has(layout)) throw new Error(`Unknown Graphviz layout "${layout}"`)
  vizModule ??= Viz.Module()
  try {
    return Viz.render(vizModule, src, { format: 'svg', engine: layout, files: [], images: [] })
  } catch (e) {
    vizModule = undefined // a failed render can leave the emscripten module unusable
    throw e
  }
}

function renderDiagram(kind: Kind, src: string, layout?: string): Promise<string> {
  const key = `${kind}:${kind === 'mermaid' && isDark() ? 'dark' : 'light'}:${layout ?? ''}:${src}`
  let p = cache.get(key)
  if (!p) {
    p =
      kind === 'plantuml' ? renderPlantUml(src) : kind === 'mermaid' ? renderMermaid(src) : renderGraphviz(src, layout)
    cache.set(key, p) // failures are cached too: the same source fails the same way
    p.catch(() => {})
  }
  return p
}

async function renderDiagrams(gen: number) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.diagram'))) {
    const kind = el.dataset.kind as Kind
    const src = sources[Number(el.dataset.idx)] ?? ''
    try {
      const svg = await renderDiagram(kind, src, layouts[Number(el.dataset.idx)])
      if (gen !== generation) return
      el.innerHTML = svg
      el.classList.add('rendered')
    } catch (e) {
      if (gen !== generation) return
      el.classList.add('failed')
      el.innerHTML =
        `<div class="diagram-error"><strong>${kind} error:</strong> ${escapeHtml(String((e as Error)?.message ?? e))}</div>` +
        `<pre>${escapeHtml(src)}</pre>`
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Post-processing of the sanitized HTML

// Orca's frame shell cancels every click on <a href>. Move href to data-href and handle clicks
// ourselves: in-document anchors scroll, everything else only shows its target as a tooltip.
function rewriteLinks(container: HTMLElement) {
  for (const a of Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const href = a.getAttribute('href')!
    const internal = href.startsWith('#')
    a.removeAttribute('href')
    a.dataset.href = href
    a.classList.add(internal ? 'link-internal' : 'link-external')
    if (internal) {
      a.setAttribute('role', 'link')
      a.tabIndex = 0
    } else if (!a.title) {
      a.title = href
    }
  }
}

function followInternalLink(target: EventTarget | null) {
  const a = (target as Element | null)?.closest?.('a.link-internal') as HTMLElement | null
  if (!a) return false
  const id = decodeURIComponent(a.dataset.href!.slice(1))
  const dest = id ? document.getElementById(id) : null
  ;(dest ?? document.body).scrollIntoView({ block: 'start' })
  return true
}

root.addEventListener('click', (e) => {
  if (followInternalLink(e.target)) e.preventDefault()
})
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && followInternalLink(e.target)) e.preventDefault()
})

// The CSP only allows data: images; anything else (relative paths, URLs) becomes a placeholder.
function replaceImages(container: HTMLElement) {
  for (const img of Array.from(container.querySelectorAll<HTMLImageElement>('img'))) {
    const src = img.getAttribute('src') ?? ''
    if (src.startsWith('data:')) continue
    const ph = document.createElement('span')
    ph.className = 'image-placeholder'
    ph.title = src
    ph.textContent = `🖼 ${img.alt || 'image'} — ${src}`
    img.replaceWith(ph)
  }
}

// Source blocks with a language: highlight.js, loaded on first use.
async function highlightCode(container: HTMLElement) {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre.highlight > code[data-lang]'))
  if (!blocks.length) return
  await loadPayload('hljs')
  const hljs = w.hljs
  for (const code of blocks) {
    if (hljs.getLanguage(code.dataset.lang)) hljs.highlightElement(code)
  }
}

// :stem: — Asciidoctor leaves the math for a client-side renderer: \$…\$ (asciimath), \(…\) (latexmath)
// inline, and \$…\$ / \[…\] inside .stemblock for blocks. KaTeX renders them, loaded on first use.
const MATH = /\\\$([\s\S]+?)\\\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g

async function renderMath(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('pre, code, script, style, .diagram') || !/\\[$([]/.test(n.nodeValue ?? '')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  if (!nodes.length) return
  await loadPayload('katex')
  const math = w.adocMath
  for (const node of nodes) {
    const text = node.nodeValue ?? ''
    const display = !!node.parentElement?.closest('.stemblock')
    let html = ''
    let last = 0
    for (const m of text.matchAll(MATH)) {
      html += escapeHtml(text.slice(last, m.index))
      const [, ascii, latexInline, latexBlock] = m
      html +=
        ascii !== undefined
          ? math.render(ascii, display, 'asciimath')
          : math.render(latexInline ?? latexBlock, display || latexBlock !== undefined, 'latexmath')
      last = m.index! + m[0].length
    }
    if (!last) continue
    html += escapeHtml(text.slice(last))
    const span = document.createElement('span')
    span.innerHTML = html
    node.replaceWith(...Array.from(span.childNodes))
  }
}

// toc: left / right → move the TOC into a sticky sidebar.
function layoutToc(container: HTMLElement, position: string | undefined) {
  const toc = container.querySelector('#toc')
  if (!toc || (position !== 'left' && position !== 'right')) return
  const aside = document.createElement('aside')
  aside.className = 'toc-sidebar'
  const main = document.createElement('div')
  main.className = 'doc-main'
  aside.appendChild(toc)
  while (container.firstChild) main.appendChild(container.firstChild)
  container.append(aside, main)
  container.classList.add(`with-toc-${position}`)
}

// ---------------------------------------------------------------------------------------------
// Rendering

let generation = 0
async function render(text: string) {
  const gen = ++generation
  document.documentElement.dataset.renderState = 'rendering'
  sources = []
  layouts = []
  const doc = await load(text, {
    safe: 'secure',
    extension_registry: registry,
    // highlight.js is the only highlighter that works here (client-side, see highlightCode).
    attributes: { showtitle: true, 'source-highlighter': 'highlight.js' },
  })
  const html = (await doc.convert()) as string
  if (gen !== generation) return
  const tocPosition = doc.getAttribute('toc-position') as string | undefined

  const fragment = document.createElement('div')
  fragment.innerHTML = DOMPurify.sanitize(html)
  rewriteLinks(fragment)
  replaceImages(fragment)
  layoutToc(fragment, tocPosition)

  const scrollY = window.scrollY
  root.className = fragment.className
  root.replaceChildren(...Array.from(fragment.childNodes))
  window.scrollTo(0, scrollY)
  await Promise.all([highlightCode(root), renderMath(root)])
  if (gen !== generation) return
  await renderDiagrams(gen)
  if (gen === generation) document.documentElement.dataset.renderState = 'done'
}

let timer: ReturnType<typeof setTimeout> | undefined
let lastVersion = -1
function schedule(doc: Doc) {
  // onDidChange also delivers the current document right away; skip versions we already have.
  if (doc.version === lastVersion) return
  lastVersion = doc.version
  clearTimeout(timer)
  timer = setTimeout(() => render(doc.content.text).catch(showFatal), 250)
}

function showFatal(e: unknown) {
  root.innerHTML = `<div class="diagram-error"><strong>Render error:</strong> ${escapeHtml(String(e))}</div>`
  document.documentElement.dataset.renderState = 'done'
}

async function main() {
  const doc: Doc = await orca.document.get()
  lastVersion = doc.version
  render(doc.content.text).catch(showFatal)
  orca.document.onDidChange((d: Doc) => schedule(d))
  orca.on('theme', () => {
    // Mermaid colors depend on the theme; re-render with the current text.
    orca.document.get().then((d: Doc) => render(d.content.text).catch(showFatal))
  })
}

main().catch(showFatal)
