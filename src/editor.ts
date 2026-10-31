// AsciiDoc preview frame. Runs inside Orca's sandboxed custom-editor iframe:
// no network, no eval, no wasm. mermaid and PlantUML are inlined as globals by the build.
import { convert, Extensions } from '@asciidoctor/core'
import DOMPurify from 'dompurify'

declare const mermaid: any
declare const PlantUML: {
  renderToString(lines: string[], ok: (svg: string) => void, err: (msg: string) => void, opts?: object): void
}
declare const orca: any

type Kind = 'plantuml' | 'mermaid'
type Doc = { version: number; content: { kind: 'text'; text: string } }

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// [plantuml] / [mermaid] blocks become placeholders with an index into `sources`.
// The source stays out of the HTML: DOMPurify drops attributes that contain "-->", common in diagrams.
let sources: string[] = []
const registry = Extensions.create()
for (const kind of ['plantuml', 'mermaid'] as Kind[]) {
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
      return this.createPassBlock(parent, html, {})
    })
  })
}

const root = document.getElementById('content')!
const cache = new Map<string, Promise<string>>()
let mermaidSeq = 0

const isDark = () => document.documentElement.classList.contains('dark')

function renderPlantUml(src: string): Promise<string> {
  const text = /^\s*@start/.test(src) ? src : `@startuml\n${src}\n@enduml`
  return new Promise((resolve, reject) =>
    PlantUML.renderToString(text.split('\n'), resolve, (msg) => reject(new Error(msg))),
  )
}

async function renderMermaid(src: string): Promise<string> {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'default' })
  const { svg } = await mermaid.render(`mermaid-${++mermaidSeq}`, src)
  return svg
}

function renderDiagram(kind: Kind, src: string): Promise<string> {
  const key = `${kind}:${kind === 'mermaid' && isDark() ? 'dark' : 'light'}:${src}`
  let p = cache.get(key)
  if (!p) {
    p = kind === 'plantuml' ? renderPlantUml(src) : renderMermaid(src)
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

async function renderDiagrams(gen: number) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.diagram'))) {
    const kind = el.dataset.kind as Kind
    const src = sources[Number(el.dataset.idx)] ?? ''
    try {
      const svg = await renderDiagram(kind, src)
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
  document.documentElement.dataset.renderState = 'done'
}

let generation = 0
async function render(text: string) {
  const gen = ++generation
  document.documentElement.dataset.renderState = 'rendering'
  sources = []
  const html = (await convert(text, {
    safe: 'secure',
    extension_registry: registry,
    attributes: { showtitle: true },
  })) as string
  if (gen !== generation) return
  const scrollY = window.scrollY
  root.innerHTML = DOMPurify.sanitize(html)
  window.scrollTo(0, scrollY)
  await renderDiagrams(gen)
}

let timer: ReturnType<typeof setTimeout> | undefined
function schedule(doc: Doc) {
  clearTimeout(timer)
  timer = setTimeout(() => render(doc.content.text).catch(showFatal), 250)
}

function showFatal(e: unknown) {
  root.innerHTML = `<div class="diagram-error"><strong>Render error:</strong> ${escapeHtml(String(e))}</div>`
  document.documentElement.dataset.renderState = 'done'
}

async function main() {
  const doc: Doc = await orca.document.get()
  render(doc.content.text).catch(showFatal)
  orca.document.onDidChange((d: Doc) => schedule(d))
  orca.on('theme', () => {
    // Mermaid colors depend on the theme; re-render with the current text.
    orca.document.get().then((d: Doc) => render(d.content.text).catch(showFatal))
  })
}

main().catch(showFatal)
