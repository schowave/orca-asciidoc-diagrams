// AsciiDoc preview frame. Runs inside Orca's sandboxed custom-editor iframe:
// no network, no eval, no wasm, no file system. The engines (PlantUML and its bundled stdlib libraries,
// Mermaid, Graphviz, highlight.js, KaTeX) are embedded compressed and loaded on first use (src/payloads.ts).
// The AsciiDoc conversion is in src/convert.ts, the pure helpers in src/text.ts.
import DOMPurify from 'dompurify'
import { convertAdoc } from './convert'
import { loadPayload, payloadIds } from './payloads'
import {
  anchorId,
  diagramKey,
  escapeHtml,
  notBundledMessage,
  splitMath,
  unbundledStdlib,
  wrapPlantUml,
  type Diagram,
} from './text'

declare const mermaid: any
declare const PlantUML: {
  renderToString(lines: string[], ok: (svg: string) => void, err: (msg: string) => void, opts?: object): void
}
declare const orca: any

type Doc = { version: number; content: { kind: 'text'; text: string } }

const w = window as any

// ---------------------------------------------------------------------------------------------
// PlantUML stdlib: bundled libraries are decompressed and run only when a diagram includes them.

const BUNDLED_STDLIB = new Set(
  payloadIds()
    .filter((id) => id.startsWith('stdlib:'))
    .map((id) => id.slice(7)),
)
const notBundled = (lib: string) => notBundledMessage(lib, BUNDLED_STDLIB)

w.PLANTUML_STDLIB_LOADER = (url: string, ok: () => void, err: (msg: string) => void) => {
  const m = /([^/]+)\.min\.js$/.exec(url)
  if (!m) return false // themes.js, emoji.js, ...: let the engine handle (or fail) them
  const lib = m[1].toLowerCase()
  if (!BUNDLED_STDLIB.has(lib)) {
    err(notBundled(lib))
    return true
  }
  loadPayload(`stdlib:${lib}`).then(ok, (e) => err(String(e)))
  return true
}

// ---------------------------------------------------------------------------------------------
// Diagrams

const root = document.getElementById('content')!
let mermaidSeq = 0

const isDark = () => document.documentElement.classList.contains('dark')

async function renderPlantUml(src: string): Promise<string> {
  const missing = unbundledStdlib(src, BUNDLED_STDLIB)
  if (missing) return Promise.reject(new Error(notBundled(missing)))
  await loadPayload('plantuml')
  return new Promise((resolve, reject) =>
    PlantUML.renderToString(wrapPlantUml(src).split('\n'), resolve, (msg) => reject(new Error(msg))),
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

function renderDiagram({ kind, src, layout }: Diagram): Promise<string> {
  if (kind === 'plantuml') return renderPlantUml(src)
  if (kind === 'mermaid') return renderMermaid(src)
  return renderGraphviz(src, layout)
}

// Rendered SVGs by diagramKey. Failures are cached too: the same source fails the same way.
// After each completed render only the diagrams of the current document stay.
let cache = new Map<string, Promise<string>>()

async function renderDiagrams(container: HTMLElement, diagrams: Diagram[], isCurrent: () => boolean) {
  const kept = new Map<string, Promise<string>>()
  for (const el of Array.from(container.querySelectorAll<HTMLElement>('.diagram'))) {
    const diagram = diagrams[Number(el.dataset.idx)]
    if (!diagram) continue
    const key = diagramKey(diagram, isDark())
    let p = cache.get(key)
    if (!p) {
      p = renderDiagram(diagram)
      p.catch(() => {})
      cache.set(key, p)
    }
    kept.set(key, p)
    try {
      const svg = await p
      if (!isCurrent()) return
      el.innerHTML = svg
      el.classList.add('rendered')
      rewriteLinks(el) // links in diagrams (PlantUML [[url]], Graphviz URL=) are links too
    } catch (e) {
      if (!isCurrent()) return
      el.classList.add('failed')
      el.innerHTML =
        `<div class="diagram-error"><strong>${diagram.kind} error:</strong> ${escapeHtml(String((e as Error)?.message ?? e))}</div>` +
        `<pre>${escapeHtml(diagram.src)}</pre>`
    }
  }
  cache = kept
}

// ---------------------------------------------------------------------------------------------
// Post-processing of the sanitized HTML

// Orca's frame shell cancels every click on <a href>. Move href to data-href and handle clicks
// ourselves: in-document anchors scroll, everything else only shows its target as a tooltip.
const XLINK = 'http://www.w3.org/1999/xlink'

function rewriteLinks(container: HTMLElement) {
  for (const a of Array.from(container.querySelectorAll<HTMLElement | SVGAElement>('a'))) {
    const href = a.getAttribute('href') ?? a.getAttributeNS(XLINK, 'href')
    if (href === null) continue
    const internal = href.startsWith('#')
    a.removeAttribute('href')
    a.removeAttributeNS(XLINK, 'href')
    a.dataset.href = href
    a.classList.add(internal ? 'link-internal' : 'link-external')
    if (internal) {
      a.setAttribute('role', 'link')
      a.tabIndex = 0
    } else if (!a.hasAttribute('title')) {
      a.setAttribute('title', href) // a tooltip in HTML; harmless in SVG
    }
  }
}

function followInternalLink(target: EventTarget | null) {
  const a = (target as Element | null)?.closest?.('a.link-internal') as HTMLElement | null
  if (!a) return false
  const id = anchorId(a.dataset.href!)
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

// :stem: math, rendered by KaTeX, which is loaded on first use. splitMath (src/text.ts) finds the formulas.
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
    const parts = splitMath(node.nodeValue ?? '', !!node.parentElement?.closest('.stemblock'))
    if (!parts) continue
    const span = document.createElement('span')
    span.innerHTML = parts
      .map((p) => (typeof p === 'string' ? escapeHtml(p) : math.render(p.tex, p.display, p.notation)))
      .join('')
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

// The first render fills the page as diagrams arrive. Later renders (edits, theme changes) build the
// new page off-screen and swap it in complete, so the page keeps its height and the scroll position holds.
async function render(text: string) {
  const gen = ++generation
  const isCurrent = () => gen === generation
  try {
    document.documentElement.dataset.renderState = 'rendering'
    const { html, diagrams, tocPosition, stem } = await convertAdoc(text)
    if (!isCurrent()) return

    const fragment = document.createElement('div')
    fragment.innerHTML = DOMPurify.sanitize(html)
    rewriteLinks(fragment)
    replaceImages(fragment)
    layoutToc(fragment, tocPosition)

    const progressive = !root.hasChildNodes()
    const target = progressive ? root : fragment
    if (progressive) show(fragment)
    await Promise.all([highlightCode(target), stem && renderMath(target)])
    if (!isCurrent()) return
    await renderDiagrams(target, diagrams, isCurrent)
    if (!isCurrent()) return
    if (!progressive) show(fragment)
    document.documentElement.dataset.renderState = 'done'
  } catch (e) {
    if (isCurrent()) showFatal(e) // an older render's failure must not replace a newer page
  }
}

function show(fragment: HTMLElement) {
  const scrollY = window.scrollY
  root.className = fragment.className
  root.replaceChildren(...Array.from(fragment.childNodes))
  window.scrollTo(0, scrollY)
}

let timer: ReturnType<typeof setTimeout> | undefined
let lastVersion = -1
function schedule(doc: Doc) {
  // onDidChange also delivers the current document right away; skip versions we already have.
  if (doc.version === lastVersion) return
  lastVersion = doc.version
  clearTimeout(timer)
  timer = setTimeout(() => render(doc.content.text), 250)
}

function showFatal(e: unknown) {
  root.innerHTML = `<div class="diagram-error"><strong>Render error:</strong> ${escapeHtml(String(e))}</div>`
  document.documentElement.dataset.renderState = 'done'
}

async function main() {
  const doc: Doc = await orca.document.get()
  lastVersion = doc.version
  void render(doc.content.text)
  orca.document.onDidChange((d: Doc) => schedule(d))
  orca.on('theme', () => {
    // Mermaid colors depend on the theme; re-render with the current text.
    orca.document.get().then((d: Doc) => render(d.content.text), showFatal)
  })
}

main().catch(showFatal)
