// Zoom overlay for one rendered diagram: it fills the frame, zooms with the wheel or a pinch (towards the
// pointer), pans by dragging, and closes with Esc, the close button or a click on the backdrop. It shows a
// copy of the diagram's SVG, so a re-render of the document underneath does not disturb it.

const MIN_SCALE = 0.05
const MAX_SCALE = 20
const FIT_MARGIN = 0.95

type View = { scale: number; x: number; y: number }

/** Natural size of a rendered SVG: its viewBox, else its width/height attributes, else its current box. */
function naturalSize(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.viewBox?.baseVal
  if (vb && vb.width && vb.height) return { w: vb.width, h: vb.height }
  const w = parseFloat(svg.getAttribute('width') ?? '')
  const h = parseFloat(svg.getAttribute('height') ?? '')
  if (w && h) return { w, h }
  const box = svg.getBoundingClientRect()
  return { w: box.width || 300, h: box.height || 150 }
}

function button(label: string, action: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = label
  b.dataset.action = action
  return b
}

const clamp = (n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))

/** Opens the overlay for `diagram` (a `.diagram.rendered`); focus returns to `opener` when it closes. */
export function openZoom(diagram: HTMLElement, opener: HTMLElement | null, label: string) {
  const source = diagram.querySelector<SVGSVGElement>(':scope > svg')
  if (!source || document.querySelector('.zoom-overlay')) return
  const { w, h } = naturalSize(source)
  const svg = source.cloneNode(true) as SVGSVGElement
  svg.removeAttribute('style') // drops the column fitting (max-width, width= / height= of the block)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))

  const overlay = document.createElement('div')
  overlay.className = 'zoom-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', label)
  const bar = document.createElement('div')
  bar.className = 'zoom-bar'
  const fitButton = button('Fit', 'fit')
  const actualButton = button('100 %', 'actual')
  const closeButton = button('Close', 'close')
  bar.append(fitButton, actualButton, closeButton)
  const stage = document.createElement('div')
  stage.className = 'zoom-stage'
  const canvas = document.createElement('div')
  canvas.className = 'zoom-canvas'
  canvas.dataset.kind = diagram.dataset.kind
  canvas.append(svg)
  stage.append(canvas)
  overlay.append(bar, stage)

  let view: View = { scale: 1, x: 0, y: 0 }
  const apply = () => {
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
    canvas.dataset.scale = view.scale.toFixed(3)
  }
  const centered = (scale: number): View => {
    const r = stage.getBoundingClientRect()
    return { scale, x: (r.width - w * scale) / 2, y: (r.height - h * scale) / 2 }
  }
  const fit = () => {
    const r = stage.getBoundingClientRect()
    view = centered(clamp(Math.min(r.width / w, r.height / h) * FIT_MARGIN))
    apply()
  }
  const actual = () => {
    view = centered(1)
    apply()
  }
  // Zoom by `factor`, keeping the point (px, py) of the stage where it is.
  const zoomAt = (factor: number, px: number, py: number) => {
    const scale = clamp(view.scale * factor)
    const k = scale / view.scale
    view = { scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k }
    apply()
  }
  const zoomCenter = (factor: number) => {
    const r = stage.getBoundingClientRect()
    zoomAt(factor, r.width / 2, r.height / 2)
  }

  // A trackpad pinch arrives as a wheel event with ctrlKey and small deltas, so it zooms faster per unit.
  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const r = stage.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top)
    },
    { passive: false },
  )

  // Dragging pans; a click without movement on the backdrop (not on the diagram) closes.
  let drag: { x: number; y: number; moved: boolean } | undefined
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    drag = { x: e.clientX, y: e.clientY, moved: false }
    stage.setPointerCapture(e.pointerId)
  })
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 3) return
    drag.moved = true
    view = { ...view, x: view.x + dx, y: view.y + dy }
    drag.x = e.clientX
    drag.y = e.clientY
    apply()
    stage.classList.add('dragging')
  })
  stage.addEventListener('pointerup', (e) => {
    const wasClick = drag && !drag.moved
    drag = undefined
    stage.classList.remove('dragging')
    if (wasClick && !canvas.contains(e.target as Node)) close()
  })

  const buttons = [fitButton, actualButton, closeButton]
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
    else if (e.key === '+' || e.key === '=') zoomCenter(1.25)
    else if (e.key === '-') zoomCenter(0.8)
    else if (e.key === '0') actual()
    else if (e.key === 'Tab') {
      // Keep the focus inside the dialog.
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus()
    } else return
    e.preventDefault()
  }
  bar.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest('button')?.dataset.action
    if (action === 'fit') fit()
    else if (action === 'actual') actual()
    else if (action === 'close') close()
  })

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onKey, true)
    opener?.focus()
  }

  document.addEventListener('keydown', onKey, true)
  document.body.append(overlay)
  fit()
  closeButton.focus()
}
