// The only uncompressed script in editor/index.html. It inflates the gzip-compressed app payload
// (asciidoctor, DOMPurify, the preview code and the brotli decoder) with the browser's built-in
// DecompressionStream and runs it. All other payloads are brotli and decoded by the app (payloads.ts).
async function main() {
  const el = document.querySelector<HTMLScriptElement>('script[data-payload="app"]')
  if (!el) throw new Error('app payload missing')
  const bin = atob(el.textContent ?? '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const code = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
  el.remove()
  const script = document.createElement('script')
  script.textContent = code
  document.head.appendChild(script)
  script.remove()
}

main().catch((e) => {
  const root = document.getElementById('content')
  if (root) root.textContent = `AsciiDoc preview failed to start: ${e}`
})
