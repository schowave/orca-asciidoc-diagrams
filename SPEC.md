# Spec: AsciiDoc Preview – PlantUML & Mermaid (Orca plugin)

## Goal

An Orca plugin that renders AsciiDoc files as easily as possible, including inline PlantUML and Mermaid diagrams, fully offline.

## Identity & distribution

- Name: **AsciiDoc Preview – PlantUML & Mermaid**, id `asciidoc-diagrams`, publisher `schowave`
- License: MIT. Public GitHub repo with topic `orca-plugin`; later an Orca catalog entry
- `manifestVersion: 2`, `execution: "sandboxed-ui"`, `pluginApi: 1`, `engines.orca: ">=1.4.245"` (custom editors exist since 1.4.245; keep `publisher` in the manifest)
- Independent of the existing `Mbirepinte/Orca-asciidoc-viewer`, which has no diagram support

## Scope (v1)

- `contributes.customEditors` for `.adoc`, `.asciidoc` and `.asc`, with `priority: "default"` and `contentKind: "text"`
- **Read-only view.** Editing happens in Orca's Source view (view toggle). The plugin never calls `orca.document.applyEdit`
- Live re-render on `orca.document.onDidChange` (works on unsaved changes too):
  - Debounce of about 250 ms
  - The scroll position is preserved
  - Rendered diagrams are cached by source hash
- AsciiDoc rendering with **asciidoctor.js 4.x**
- Diagram syntax as in asciidoctor-diagram: `[plantuml]` and `[mermaid]` blocks (`----` delimited, optional title and attributes). `[source,plantuml]` and `[source,mermaid]` are shown as plain code
- **PlantUML:** `@plantuml/core` (≥ 1.2026.6, MIT; the TeaVM JS build)
  - Uses the **Smetana layout only**. Do **not** bundle `viz-global.js`: its wasm init fails under the CSP and then breaks graph diagrams instead of falling back to Smetana
  - Stdlib bundles **C4, kubernetes, k8s, azure, archimate, eip, DomainStory, office, logos and tupadr3** are embedded. They are served lazily via `PLANTUML_STDLIB_LOADER` (decoded only when a diagram includes them). `gcp`, `elastic` and `edgy` are excluded because they declare no license; AWS (`awslib14`, 4.7 MB gzip) does not fit
  - Any other stdlib produces a clear "library not bundled" error
- **Mermaid:** 12.x, embedded compressed
- **Diagram errors:** an error box with the message and the diagram source in its place; the rest of the document still renders
- **Theme:**
  - The document follows Orca's theme via the `--orca-*` CSS vars and `orca.on('theme')`
  - Mermaid uses `dark` or `default` to match
  - PlantUML stays light on its own light surface
- **TOC:** only when the document sets `:toc:`. With `toc: left` it is a sticky sidebar; otherwise it stays inline
- **Links:**
  - Internal anchors work
  - External links and `xref:` to other files are displayed with their target in a tooltip but cannot be followed (the sandbox has no popups and the host API has no open method). This is documented
- **Wide diagrams** scroll horizontally. No zoom, fullscreen or export in v1

## Security

- Sanitize the rendered HTML with DOMPurify. Passthrough HTML is allowed; scripts and event handlers are removed. Reason: a script in a foreign `.adoc` could otherwise call `applyEdit` and modify the open file
- The plugin never calls `applyEdit`

## Known limitations (documented in the README)

The frame has no file system, no network and no wasm. As a result:

- `include::` directives render as a visible placeholder ("include not resolvable: <path>")
- Relative images render as a placeholder with their alt text. `data:` images and rendered diagrams work
- PlantUML `!include` of local files is unsupported

## Platform constraints (verified against Orca 1.4.245 source)

- The frame is `<iframe sandbox="allow-scripts">` with this CSP:
  `default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'`
- What is blocked:
  - `eval` and `new Function`
  - WebAssembly
  - `fetch` and Workers
  - External scripts
- So all JS and CSS must be inlined into **one** entry HTML
- Limits: 10 MiB for the entry HTML, 50 MiB and 2000 files for the plugin
- Frame API:
  - `orca.document.get()` returns `{ version, readOnly, content: { kind: 'text', text } }`
  - `orca.document.onDidChange(cb)`
  - `orca.on('theme', cb)`

## Tech & tests

- TypeScript plus esbuild produce a single inlined `editor/index.html`
- Library versions are pinned
- The build fails if the entry HTML exceeds **9.5 MiB** (estimate: ~8–9 MiB)
- Inlining details for `@plantuml/core`:
  - Replace the trailing ESM `export` with a global
  - Escape `</script` and `<!--`
  - Make sure the page is decoded as UTF-8
- Playwright tests run in a harness that reproduces Orca's frame exactly (srcdoc, sandbox, CSP meta)
- Manual check in real Orca: Settings → Plugins → Development folders

## Plan

1. **Spike:** a minimal custom editor in real Orca 1.4.245 that renders one PlantUML and one Mermaid block inside an `.adoc`. This is the main risk, because so far it is only verified in headless Chrome
2. Full v1 per this spec
3. README, test suite and release; then the catalog

## Implementation notes (from the spike)

- asciidoctor.js 4 is a native ESM port (no Opal) and runs under the CSP
  - `convert()` and `reader.readLines()` are async
  - Block processors use `reader.getLines()`
  - Its guarded `import('node:…')` calls are resolved to a throwing stub at build time; left external, they cause CSP violations
- DOMPurify drops attributes whose value contains `-->`, so diagram sources must not travel in `data-*` attributes. They are kept in a side table, indexed by placeholder
- Orca's frame shell cancels **every** click on `<a href>`. For internal anchors (`<<id>>`, TOC) we need our own click handler that scrolls to the target
- Entry size: 7.31 MiB for the spike, 8.29 MiB with the C4, Kubernetes and Azure stdlib bundles
- Large scripts are embedded **gzip+base64** in inert `<script type="application/x-gzip-base64">` blocks. On first use they are decompressed with `DecompressionStream` (via `Blob`/`Response`, no fetch) and executed as inline `<script>` elements, which the CSP allows. This cut the base from ~7.3 to ~4 MiB and let tupadr3 fit. Entry: 7.27 MiB with ten stdlib libraries
- The PlantUML engine must run in its own function scope: as a classic script its top-level names (e.g. `CSS`) shadow browser globals
- Payload encoding:
  - The app bundle is gzip, inflated by a tiny uncompressed bootstrap via `DecompressionStream`
  - All other payloads are brotli (quality 11, 16 MiB window), decoded by the pure-JS `brotli` decoder (90 KB) because the frame's `DecompressionStream` has no brotli
  - Entry size: 5.96 MiB, down from 8.19 MiB
  - First render (headless Chromium): ~0.4 s for text only, ~0.6 s with PlantUML or Mermaid, ~0.85 s with tupadr3

## Additional renderers (after 1.0.0)

Each renderer is its own brotli payload and loads on first use:

- **Syntax highlighting:** highlight.js (common languages, GitHub light and dark themes scoped to `html.dark`), applied to `pre.highlight > code[data-lang]`. Asciidoctor runs with `source-highlighter=highlight.js`.
- **Math (`:stem:`):** KaTeX, with its woff2 fonts inlined as `data:` URIs. asciimath goes through asciimath2tex first. Delimiters as Asciidoctor emits them: `\$…\$` (asciimath), `\(…\)` and `\[…\]` (latexmath). Inside `.stemblock` the output is display mode.
- **Graphviz:** `[graphviz]` blocks with an optional `layout=`, rendered by viz.js 2.1.2. That is asm.js Graphviz 2.40.1, so no wasm is needed. It sits on a light card like PlantUML.
- **Custom stdlib selection:** `PLANTUML_STDLIB=a,b` overrides `scripts/stdlib-list.mjs` for both `fetch-stdlib.mjs` and `build.mjs`.
- **Entry size:** 6.96 MiB.
