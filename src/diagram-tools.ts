// Toolbar on each diagram: zoom (rendered diagrams only), copy the source, copy the SVG. It shows on hover and on
// keyboard focus, and sits over the diagram, so it never shifts the layout.
import { openZoom } from './zoom'

const ICONS = {
  zoom: '<path d="M7 2a5 5 0 1 0 3.2 8.9l3.4 3.4 1.1-1.1-3.4-3.4A5 5 0 0 0 7 2Zm0 1.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM6.25 5v1.25H5v1.5h1.25V9h1.5V7.75H9v-1.5H7.75V5Z"/>',
  source:
    '<path d="M5.3 4.2 1.5 8l3.8 3.8 1.06-1.06L3.62 8l2.74-2.74Zm5.4 0L9.64 5.26 12.38 8l-2.74 2.74 1.06 1.06L14.5 8Z"/>',
  svg: '<path d="M4 1.5h6.5L13 4v8.5H4Zm1.5 1.5v8h6V4.6L9.9 3ZM2 4.5h1.5v9h7V15H2Z"/>',
}

// The frame has no clipboard-write permission, so navigator.clipboard rejects; execCommand('copy') on a selected
// textarea still works after a click. It is deprecated, but it is the only way that works in Orca's frame.
function copyText(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0'
  document.body.append(ta)
  ta.focus()
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

function toolButton(action: keyof typeof ICONS, label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.dataset.action = action
  b.title = label
  b.setAttribute('aria-label', label)
  b.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONS[action]}</svg>`
  return b
}

let statusTimer: ReturnType<typeof setTimeout> | undefined

function report(status: HTMLElement, message: string) {
  status.textContent = message
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => (status.textContent = ''), 1500)
}

export type ToolSources = { source: string; svg?: string }

/** Adds the toolbar to a filled `.diagram`; `svg` is absent for a failed diagram, which gets only "Copy source". */
export function addDiagramTools(el: HTMLElement, { source, svg }: ToolSources) {
  const bar = document.createElement('div')
  bar.className = 'diagram-tools'
  if (svg) bar.append(toolButton('zoom', 'Zoom'))
  bar.append(toolButton('source', 'Copy source'))
  if (svg) bar.append(toolButton('svg', 'Copy SVG'))
  const status = document.createElement('span')
  status.className = 'diagram-tools-status'
  status.setAttribute('role', 'status')
  bar.append(status)
  bar.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button')
    const action = b?.dataset.action
    if (!b || !action) return
    if (action === 'zoom') return openZoom(el, b, zoomLabel(el))
    const ok = copyText(action === 'svg' ? svg! : source)
    b.focus() // copying moved the focus to the hidden textarea
    report(status, ok ? 'Copied' : 'Copy not available')
  })
  el.append(bar)
  if (svg) {
    el.addEventListener('dblclick', (e) => {
      if (!(e.target as Element).closest('.diagram-tools')) openZoom(el, bar.querySelector('button'), zoomLabel(el))
    })
  }
}

const zoomLabel = (el: HTMLElement) =>
  el.closest('.diagramblock')?.querySelector(':scope > .title')?.textContent || `${el.dataset.kind} diagram`
