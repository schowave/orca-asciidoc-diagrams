---
status: accepted
---

# Ship the plugin as one self-contained HTML file with lazy compressed payloads

Orca runs a custom editor in a sandboxed frame with a strict CSP (inline scripts and styles only; no `eval`,
WebAssembly, `fetch` or workers) and caps the entry page at 10 MiB. The plugin must render AsciiDoc with PlantUML,
Mermaid and Graphviz fully offline inside it. The design is in `SPEC.md`; this ADR records the choice that shapes
the whole build (`scripts/build.mjs`, `src/payloads.ts`).

## Considered Options

- **One HTML file, engines embedded brotli-compressed and decoded on first use** (chosen): works under the CSP, keeps
  diagram sources on the machine, and stays near 7 MiB because each renderer loads only when a document uses it.
  The decoder is plain JavaScript, since the frame's `DecompressionStream` has no brotli.
- **Fetch engines or render on a server (Kroki, PlantUML server)**: rejected, the frame has no network and sources would
  leave the machine.
- **Embed everything uncompressed**: rejected, it exceeds the 10 MiB page limit.
- **Bundle PlantUML's wasm/Graphviz build for layout**: rejected, WebAssembly is blocked; Smetana layout is used instead.

## Consequences

- `editor/index.html` is generated output. The weekly release workflow rebuilds and commits it, so contributors do not.
- Every new renderer or library must fit the page limit (`scripts/build.mjs` fails above 9.5 MiB) and load as a payload.
- Some stdlib libraries are left out (AWS is too large; gcp, elastic and edgy declare no license); users can build their own selection.
- Revisit if Orca lifts the CSP restrictions or the page limit, or offers a way to load plugin assets separately.
