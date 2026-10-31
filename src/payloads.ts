// Large scripts (PlantUML engine, mermaid, PlantUML stdlib bundles) are embedded brotli-compressed
// and base64-encoded in inert <script type="application/x-payload" data-payload="…"> blocks by
// scripts/build.mjs. They are decoded and executed on first use. Everything stays inside the frame:
// the decoder is plain JS (the frame's DecompressionStream has no brotli) and inline <script>
// elements are allowed by the frame CSP; no fetch, no eval, no wasm.
import { decompress } from 'brotli/decompress.js'

const loaded = new Map<string, Promise<void>>()

const block = (id: string) =>
  document.querySelector<HTMLScriptElement>(`script[type="application/x-payload"][data-payload="${CSS.escape(id)}"]`)

export const payloadIds = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/x-payload"]')).map(
    (s) => s.dataset.payload!,
  )

function decode(base64: string): string {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(decompress(bytes))
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
      const code = decode(el.textContent ?? '')
      const script = document.createElement('script')
      script.textContent = code
      document.head.appendChild(script) // runs synchronously
      script.remove()
      el.remove() // free the base64 text
    })()
    loaded.set(id, p)
  }
  return p
}
