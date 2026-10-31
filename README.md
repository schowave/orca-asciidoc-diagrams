# AsciiDoc Preview – PlantUML & Mermaid

An [Orca](https://github.com/stablyai/orca) plugin that renders AsciiDoc files (`.adoc`, `.asciidoc`, `.asc`) with inline **PlantUML** and **Mermaid** diagrams. Everything runs locally, inside Orca's plugin sandbox. No diagram source ever leaves your machine: there is no PlantUML server, no Kroki and no Java.

## Features

- **Preview** view for AsciiDoc files, the default for these files. Switch to **Source** in the editor tab to edit
- The preview updates live while you type, including unsaved changes
- **AsciiDoc rendering** by [Asciidoctor.js](https://github.com/asciidoctor/asciidoctor.js) 4: sections, tables, admonitions, lists and so on
- **Diagram blocks** in [asciidoctor-diagram](https://docs.asciidoctor.org/diagram-extension/latest/) syntax, so the same files also render in Asciidoctor, IntelliJ or GitLab:

  ```asciidoc
  .Login flow
  [plantuml]
  ----
  Alice -> Bob : Hello
  ----

  [mermaid]
  ----
  graph LR
    A --> B
  ----
  ```

  `@startuml` / `@enduml` are optional. `[source,plantuml]` is shown as plain code.
- **PlantUML** uses the official JS engine with the built-in Smetana layout. Bundled standard libraries:
  - `C4` (`!include <C4/C4_Context>`, …)
  - `archimate`
  - `tupadr3` (Font Awesome, Devicons, Material, … icons)
  - `logos`
  - `office`
  - `azure`
  - `kubernetes` and `k8s`
  - `eip`
  - `DomainStory`
- **Mermaid** 11
- **Theme:**
  - The document follows Orca's light/dark theme, and so do Mermaid diagrams
  - PlantUML diagrams sit on a light surface
- A **broken diagram** shows an error box with the diagram source. The rest of the document still renders
- **Table of contents** with `:toc:`. `:toc: left` / `:toc: right` render it as a sticky sidebar
- In-document links (`<<section>>`, the TOC) scroll to their target

## Limitations

The preview runs in Orca's sandboxed frame: no file system, no network, no WebAssembly. As a result:

| What | Behavior |
|---|---|
| `include::` | A placeholder naming the file |
| Relative or remote images | A placeholder with alt text and path. `data:` images work |
| PlantUML `!include` of local files | Not supported |
| PlantUML stdlib not listed above (e.g. AWS `awslib14`, `gcp`, `elastic`) | Error box: "not bundled". AWS is too large; `gcp`, `elastic` and `edgy` have no declared license |
| External links, `xref:` to other files | Shown with their target as a tooltip; clicking does nothing |
| Raw HTML (`++++` passthrough) | Rendered, with scripts and event handlers removed |
| Layout | Graphviz is not available, so PlantUML uses Smetana; complex graphs may lay out differently from `dot` |

## Install

The plugin is not in the Orca catalog yet. To use it now:

```sh
git clone https://github.com/schowave/orca-asciidoc-diagrams
cd orca-asciidoc-diagrams
npm ci
npm run build        # → dist/plugin
```

Then, in Orca:

1. Settings → Plugins → **Turn on plugins**
2. **Development folders…** → add `dist/plugin`
3. Enable it, and open any `.adoc` file

Requires Orca ≥ 1.4.245.

## Development

| Path | Content |
|---|---|
| `src/editor.ts`, `src/editor.css` | The preview frame |
| `scripts/build.mjs` | Builds `dist/plugin`: the manifest plus a single, fully inlined `editor/index.html` (the frame CSP only allows inline code). The PlantUML engine, Mermaid and the stdlib bundles are embedded gzip-compressed and only decompressed (`DecompressionStream`) when a document needs them; see `src/payloads.ts`. The build fails if the file exceeds 9.5 MiB, below Orca's 10 MiB limit |
| `tests/sandbox-harness.mjs` | `npm test` builds the plugin and renders the fixtures in headless Chromium inside an iframe that reproduces Orca's frame: same sandbox, same CSP, mocked `window.orca`. It fails on CSP violations, errors and missing diagrams |
| `vendor/plantuml-stdlib/` | The vendored stdlib bundles, gzipped. The list is in `scripts/stdlib-list.mjs`; refresh with `node scripts/fetch-stdlib.mjs` |

See [SPEC.md](SPEC.md) for design decisions.

## License

MIT. Bundled third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
