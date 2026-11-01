// Large scripts (PlantUML engine, mermaid, PlantUML stdlib bundles) are embedded brotli-compressed
// and base-122-encoded (base122.ts) in inert <script type="application/x-payload" data-payload="…"> blocks by
// scripts/build.mjs. They are decoded and executed on first use. Everything stays inside the frame:
// the decoder is plain JS (the frame's DecompressionStream has no brotli) and inline <script>
// elements are allowed by the frame CSP; no fetch, no eval, no wasm.
import { decompress } from 'brotli/decompress.js'
import { decode as fromText } from './base122'

const loaded = new Map<string, Promise<void>>()

const block = (id: string) =>
  document.querySelector<HTMLScriptElement>(`script[type="application/x-payload"][data-payload="${CSS.escape(id)}"]`)

export const payloadIds = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/x-payload"]')).map(
    (s) => s.dataset.payload!,
  )

function decode(el: HTMLScriptElement): string {
  return new TextDecoder().decode(decompress(fromText(el.textContent ?? '', Number(el.dataset.length))))
}

/** Decode and run the payload once; later calls return the same promise. */
export function loadPayload(id: string): Promise<void> {
  let p = loaded.get(id)
  if (!p) {
    p = (async () => {
      const el = block(id)
      if (!el) throw new Error(`payload ${id} is not bundled`)
      // Yield first so the caller's UI (e.g. the rendered text) paints before a large decode.
      await new Promise((r) => setTimeout(r, 0))
      const code = decode(el)
      const script = document.createElement('script')
      script.textContent = code
      document.head.appendChild(script) // runs synchronously
      script.remove()
      el.remove() // free the encoded text
    })()
    loaded.set(id, p)
  }
  return p
}
