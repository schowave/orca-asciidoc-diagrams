// Large scripts (PlantUML engine, mermaid, PlantUML stdlib bundles) are embedded gzip+base64 in
// inert <script type="application/x-gzip-base64" data-payload="…"> blocks by scripts/build.mjs.
// They are decompressed and executed on first use. Everything stays inside the frame: Blob,
// DecompressionStream and inline <script> elements are all allowed by the frame CSP; no fetch.

const loaded = new Map<string, Promise<void>>()

const block = (id: string) =>
  document.querySelector<HTMLScriptElement>(`script[type="application/x-gzip-base64"][data-payload="${CSS.escape(id)}"]`)

export const hasPayload = (id: string) => !!block(id)

export const payloadIds = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/x-gzip-base64"]')).map(
    (s) => s.dataset.payload!,
  )

async function gunzip(base64: string): Promise<string> {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** Decompress and run the payload once; later calls return the same promise. */
export function loadPayload(id: string): Promise<void> {
  let p = loaded.get(id)
  if (!p) {
    p = (async () => {
      const el = block(id)
      if (!el) throw new Error(`payload ${id} is not bundled`)
      const code = await gunzip(el.textContent ?? '')
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
