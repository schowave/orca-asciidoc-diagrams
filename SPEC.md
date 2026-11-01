# Spec: AsciiDoc Preview – Diagrams, Code & Math (Orca plugin)

## Goal

An Orca plugin that renders AsciiDoc files as easily as possible, with inline diagrams (PlantUML, Mermaid, Graphviz), highlighted code and math. It works fully offline: no server, no Java, and no diagram source leaves the machine.

## Identity & distribution

- **Plugin:**
  - Name: **AsciiDoc Preview – Diagrams, Code & Math**
  - id `asciidoc-diagrams`; publisher `schowave`, the repository owner
  - Install key `schowave.asciidoc-diagrams`
- **Repository:** MIT license, public `github.com/schowave/orca-asciidoc-diagrams`, GitHub topic `orca-plugin`
- **Manifest:**
  - `manifestVersion: 2`, `execution: "sandboxed-ui"`, `engines.orca: ">=1.4.245"`, because custom editors exist since 1.4.245
  - Keep `publisher` while supporting 1.4.245; it can be omitted only from `>=1.4.246`
- **Layout:** the plugin lives at the repository root, because Orca installs from a Git commit:
  - `orca-plugin.json`
  - `editor/index.html`: committed build output
  - `images/`, `LICENSE`, `THIRD_PARTY_NOTICES.md`
  - `dist/plugin` mirrors only these files, for Orca's development folders
- **Distribution:**
  - **Community catalog / onorca.dev:** it is generated automatically from the topic plus the newest `vX.Y.Z` tag, pinned to that commit and its content hash. There is no PR. Orca auto-updates a release once it has been listed for 12 h. A size review may hold large plugins.
  - **Git URL install:** `https://github.com/schowave/orca-asciidoc-diagrams#vX.Y.Z`. Orca requires an explicit `#ref` (a tag or a commit); such installs are shown as *Unverified*.
- **Relation to `Mbirepinte/Orca-asciidoc-viewer`:** independent of it. That plugin has no diagram support; diagrams are the distinguishing feature here.

## Features

- **Opening files:**
  - `contributes.customEditors` for `.adoc`, `.asciidoc` and `.asc`
  - `priority: "default"`, `contentKind: "text"`
- **Read-only:**
  - Editing happens in Orca's Source view (view toggle)
  - The plugin never calls `orca.document.applyEdit`
- **Live updates:** `orca.document.onDidChange` triggers a re-render, including on unsaved changes
  - Debounced by about 250 ms
  - Versions already rendered are skipped
  - The scroll position is preserved
  - Diagrams are cached by source; failures are cached too
- **AsciiDoc:** asciidoctor.js 4 in `safe: secure` mode
- **Diagrams:** asciidoctor-diagram block syntax, `----` delimited, with optional title and attributes. `[source,<lang>]` stays code.
  - `[plantuml]`:
    - Rendered by `@plantuml/core` (≥ 1.2026.6, MIT, TeaVM JS build), with the **Smetana layout only**
    - `@startuml`/`@enduml` are optional
  - `[mermaid]`: Mermaid 12, `securityLevel: 'strict'`, `suppressErrorRendering: true`
  - `[graphviz]`:
    - viz.js 2.1.2: Graphviz 2.40.1 compiled to asm.js, so no wasm is needed
    - Optional `layout=` (`dot`, `neato`, `fdp`, `sfdp`, `twopi`, `circo`, `osage`, `patchwork`)
- **PlantUML stdlib:**
  - Bundled: C4, kubernetes, k8s, azure, archimate, eip, DomainStory, office, logos, tupadr3
  - Loaded lazily via `PLANTUML_STDLIB_LOADER`
  - Others produce a clear "library not bundled" error
  - Excluded:
    - `gcp`, `elastic`, `edgy`: no declared license
    - `awslib14`: about 3 MiB, too large for the default build
  - **Custom builds:** `PLANTUML_STDLIB=a,b` overrides `scripts/stdlib-list.mjs` for `fetch-stdlib.mjs` and `build.mjs`
- **Syntax highlighting:**
  - highlight.js with its common languages, applied to `pre.highlight > code[data-lang]`
  - Asciidoctor runs with `source-highlighter=highlight.js`
  - GitHub light and dark themes, scoped to `html.dark`
- **Math (`:stem:`):**
  - KaTeX, with its woff2 fonts inlined as `data:` URIs
  - asciimath goes through asciimath2tex first
  - Delimiters as Asciidoctor emits them: `\$…\$` (asciimath), `\(…\)` and `\[…\]` (latexmath)
  - Inside `.stemblock` the output is display mode
- **Diagram errors:** an error box (monospace, line breaks kept) followed by the source. The rest of the document still renders.
- **Theme:**
  - The document follows Orca's theme (`--orca-*` vars, `orca.on('theme')`), and Mermaid follows with `dark`/`default`
  - PlantUML and Graphviz sit on a light card
- **Layout:**
  - Wide diagrams scale down to the column width; small ones are never scaled up
  - Table cells are left-aligned and respect the `halign-*`/`valign-*` classes
- **TOC:** only with `:toc:`. `toc: left`/`right` renders a sticky sidebar, which stacks on narrow widths.
- **Links:**
  - Orca's frame shell cancels every click on `<a href>`. So `href` moves to `data-href`:
    - Internal anchors (`<<id>>`, TOC) scroll to their target, by click or Enter
    - External links and `xref:` to other files show their target as a tooltip only
- **Not in scope:** zoom, fullscreen and export

## Security

- The rendered HTML is sanitized with DOMPurify. Passthrough HTML is allowed; scripts and event handlers are removed. Without this, a script in a foreign `.adoc` could call `applyEdit` and modify the open file.
- The plugin never calls `applyEdit`.
- Payloads are executed as inline scripts. They come only from the plugin's own build, never from the document.

## Known limitations

The frame has no file system, no network and no wasm.

| What | Behaviour |
| --- | --- |
| `include::` | A visible placeholder ("Include not resolvable in the preview: <path>"), via an include processor |
| Images | Anything that is not a `data:` URI becomes a placeholder showing the alt text and path |
| PlantUML `!include` of local files | Unsupported |
| Libraries | Cannot be installed at runtime: the frame has no storage, and frames of different plugins cannot talk to each other. A future Orca frame↔worker channel (stablyai/orca#36429, panels only so far) could change that |

## Platform constraints (verified against Orca 1.4.245)

- **Frame:** `<iframe sandbox="allow-scripts">` (srcdoc) with this CSP:
  `default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'`
- **Blocked:**
  - `eval` and `new Function`
  - WebAssembly
  - `fetch` and Workers
  - External scripts
  - `DecompressionStream('brotli')`; only gzip and deflate are available
- **Allowed:**
  - Inline `<script>` elements, including ones inserted at runtime
  - `Blob`, `Response`, `DecompressionStream('gzip')`
  - `data:` fonts and images
- **Limits:**
  - 10 MiB for the entry HTML
  - 50 MiB and 2000 files for the whole plugin
  - Listing images: icon ≥ 128 px, square, ≤ 256 KB; cover ≥ 800×500, ≤ 1 MB; screenshots ≥ 1280×800, ≤ 1.5 MB
  - Orca shows the cover cropped to a wide banner, roughly its middle third
- **Frame API:**
  - `orca.document.get()`
  - `orca.document.onDidChange(cb)`: delivers the current document right away, then each change
  - `orca.on('theme', cb)`
  - The theme also arrives as the `light`/`dark` class on `<html>`

## Architecture

- **`editor/index.html`:** one self-contained file of about **7 MiB**. Its contents:
  - Inline CSS and `<div id="content">`
  - Inert `<script type="application/x-payload" data-payload="…" data-length="…">` blocks holding compressed code, encoded as base-122 text (`src/base122.ts`): about 14 % overhead instead of base64's 33 %. The variant avoids NUL, CR and `<`, which the HTML parser would change or which could end the script element
  - The only uncompressed script, `src/bootstrap.ts`
- **Startup:**
  - The bootstrap inflates the **`app`** payload (gzip) natively and runs it
  - `app` contains asciidoctor.js, DOMPurify, the preview code and the brotli decoder
- **On demand (`src/payloads.ts`):** every other payload is **brotli** (quality 11, 16 MiB window), decoded by the pure-JS `brotli` decoder (90 KB) and run once. It is about 25 % smaller than gzip. The payloads:
  - `plantuml`: the engine plus `themes.js`, run in its own function scope
  - `mermaid`
  - `graphviz`
  - `hljs`
  - `katex`: KaTeX with its fonts, plus asciimath2tex
  - `stdlib:<lib>`, one per PlantUML stdlib library
- **First render** (headless Chromium, including page setup):
  - ~0.4 s for text only
  - ~0.6 s with PlantUML or Mermaid
  - ~0.85 s with tupadr3

## Tech, tests and maintenance

- **Build:**
  - TypeScript and esbuild
  - fflate for gzip, because `node:zlib` gzip differs between platforms
  - Node's brotli for the other payloads
- **Size guard:** the build fails above **9.5 MiB**. Size history:
  - 7.31 MiB for the spike
  - 8.29 MiB with three stdlib libraries
  - 8.19 MiB after gzip, with ten libraries
  - 5.96 MiB after brotli
  - 6.96 MiB with Graphviz, highlight.js and KaTeX
  - 5.97 MiB with base-122 instead of base64 (in-browser load about 25 ms slower)
- **Tests:** `tests/sandbox-harness.mjs` runs headless Chromium in a replica of Orca's frame (`tests/orca-frame.mjs`):
  - The replica has the same srcdoc, sandbox, CSP and link-click policy as Orca, and a mocked `window.orca` that delivers on subscribe like Orca
  - The run fails on:
    - CSP violations, errors, or stray elements outside `#content`
    - Missing or wrongly failed diagrams
    - Highlighting, math or Graphviz not rendered
    - Overflowing or upscaled diagrams
    - A broken link scroll
    - A script surviving sanitization, or a call to `applyEdit`
- **Media:** `scripts/media.mjs` generates the icon, cover, screenshots and demo GIF from the real build in the same replica frame.
- **Tooling:**
  - `mise.toml` pins Node and defines the tasks (`setup`, `test`, `build`, `media`, `fetch-stdlib`)
  - `mise.lock` holds checksums for all platforms
  - CI uses `jdx/mise-action`
- **Dependencies:** Renovate (GitHub App) covers npm, mise and GitHub Actions
  - Patch and minor updates automerge once CI is green
  - Major updates wait for review
  - The PlantUML stdlib bundles come from plantuml.github.io and are not in npm; the release workflow refreshes them
- **Releases:** `.github/workflows/release.yml` runs weekly on Mondays, or by dispatch with `patch`/`minor`/`major`:
  1. Refresh the stdlib bundles
  2. Build and test
  3. If the build differs from the committed one (or on a dispatched minor/major), bump the version and changelog, commit, tag and create a GitHub release
  - `editor/index.html` on `main` is therefore the last *released* build. CI tests the build but does not require a committed rebuild in every PR.

## Implementation notes

- **asciidoctor.js 4:**
  - It is a native ESM port (no Opal) and runs under the CSP
  - `load()`/`convert()` and `reader.readLines()` are async; block processors use `reader.getLines()`
  - Its guarded `import('node:…')` calls resolve to a throwing stub at build time; left external, they cause CSP violations
- **DOMPurify:** it drops attributes whose value contains `-->`, so diagram sources live in a side table indexed by placeholder, not in `data-*`.
- **The PlantUML engine:**
  - Must run in its own function scope: as a classic script, its top-level names (for example `CSS`) shadow browser globals
  - Do not bundle its `viz-global.js`: under the CSP its wasm init fails and breaks graph diagrams instead of falling back to Smetana
- **Mermaid:**
  - On parse errors it appends an error SVG to `<body>` unless `suppressErrorRendering` is set
  - Its inline `max-width` must stay in force, or small diagrams are scaled up
- **highlight.js themes:** strip CSS comments before scoping selectors to light/dark, or the leading rule escapes the scope.
- **Orca development folders:**
  - Overwrite the build in place, never delete the folder, or Orca's watcher loses it
  - A rebuild may still need a reinstall and reopening the tab

## Decisions

| Topic | Decision |
| --- | --- |
| Scope | Read-only preview, default view for `.adoc`, published as a separate plugin rather than contributed upstream |
| PlantUML | Engine in the browser with Smetana; no server and no Java; no Graphviz layout for PlantUML |
| Stdlib | A broad default set (licensed libraries only); custom selection via `PLANTUML_STDLIB` for anything else, e.g. AWS |
| Unresolvable content | `include::` and images become placeholders; no local preview server |
| Security | Sanitize everything; never write to the document |
| Size | Compress the embedded code (A + B); no base122 encoding, no trimming of tupadr3 |
| Extra formats | Syntax highlighting, KaTeX math and Graphviz. WaveDrom, Nomnoml, Bytefield and BPMN only on request. D2, Svgbob, Pikchr, BlockDiag, Structurizr and Vega are impossible in the sandbox |
| Maintenance | Renovate with automerge for patch and minor updates; weekly automatic patch releases through the community catalog |
