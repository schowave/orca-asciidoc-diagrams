<div align="center">

<img src="images/icon.png" width="96" height="96" alt="">

# AsciiDoc Preview – PlantUML & Mermaid

**Live AsciiDoc preview for [Orca](https://github.com/stablyai/orca), with PlantUML and Mermaid diagrams, rendered fully offline.**

[![CI](https://github.com/schowave/orca-asciidoc-diagrams/actions/workflows/ci.yml/badge.svg)](https://github.com/schowave/orca-asciidoc-diagrams/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Orca ≥ 1.4.245](https://img.shields.io/badge/Orca-%E2%89%A5%201.4.245-7c3aed.svg)](https://github.com/stablyai/orca)

<img src="docs/media/demo.gif" width="800" alt="Typing AsciiDoc with a PlantUML sequence diagram and a Mermaid state diagram; the preview updates as you type">

</div>

## Why

Architecture docs often live in AsciiDoc, as in arc42 or docs-as-code, with diagrams inline. This plugin shows those documents in Orca the way Asciidoctor and IntelliJ do, with the diagrams rendered:

- **No server, no Java, no Kroki.** PlantUML and Mermaid run inside Orca's plugin sandbox, so your diagram sources never leave your machine.
- **Same syntax as [asciidoctor-diagram](https://docs.asciidoctor.org/diagram-extension/latest/).** Files keep rendering in Asciidoctor, IntelliJ and GitLab.
- **Live.** The preview follows your edits, including unsaved ones.

## Features

- Opens `.adoc`, `.asciidoc` and `.asc` files in a **Preview** view. Toggle to **Source** in the editor tab to edit.
- [Asciidoctor.js](https://github.com/asciidoctor/asciidoctor.js) 4 renders the document: sections, tables, admonitions, lists, source blocks and more.
- PlantUML with the official JS engine and these bundled standard libraries:
  - **C4** and **ArchiMate**
  - **tupadr3**: Font Awesome, Devicons, Material and more
  - **logos** and **office**
  - **azure**
  - **kubernetes** and **k8s**
  - **eip**
  - **DomainStory**
- Mermaid 12: flowcharts, sequence, state, class, ER, Gantt, mindmaps and more.
- Follows Orca's light and dark theme.
- Wide diagrams scale to fit the page.
- A broken diagram shows an error box with its source. The rest of the document still renders.
- `:toc:` renders a table of contents. `:toc: left` and `:toc: right` render it as a sticky sidebar. In-document links scroll to their target.

## Usage

Write diagram blocks the asciidoctor-diagram way:

```asciidoc
.System context
[plantuml]
----
!include <C4/C4_Context>
Person(customer, "Customer")
System(shop, "Online Shop")
Rel(customer, shop, "Orders")
----

[mermaid]
----
stateDiagram-v2
  [*] --> Placed
  Placed --> Shipped
----
```

- `@startuml` / `@enduml` are optional.
- `[source,plantuml]` is shown as code, not rendered.

<table><tr>
<td><img src="images/screenshot-light.png" alt="Architecture document with C4, sequence and Mermaid diagrams in a light theme"></td>
<td><img src="images/screenshot-dark.png" alt="The same document in a dark theme"></td>
</tr></table>

## Installation

Requires **Orca 1.4.245 or newer**.

### From the Orca plugin directory

**[Open in Orca](https://onorca.dev/plugins/schowave.asciidoc-diagrams?catalog=community)**: the link opens the plugin's page in Orca under Settings → Plugins; press **Install**. Updates install automatically.

### From the Git URL

In Orca:

1. Settings → Plugins → install a plugin
2. Choose **Git URL**
3. Enter the repository URL with a release tag, for example `https://github.com/schowave/orca-asciidoc-diagrams#v1.0.0`. The newest tag is on the [releases page](https://github.com/schowave/orca-asciidoc-diagrams/releases)

Orca marks plugins installed this way as *Unverified*, and they update only when you click **Update**.

### From source

```sh
git clone https://github.com/schowave/orca-asciidoc-diagrams
cd orca-asciidoc-diagrams
npm ci
npm run build          # writes editor/index.html and mirrors the plugin to dist/plugin
```

Then, in Orca:

1. Settings → Plugins → **Turn on plugins**
2. **Development folders…** → add `dist/plugin`
3. Enable the plugin and open an `.adoc` file

> Orca may not pick up a rebuild while a document is open. Reopen the tab, or remove and re-add the folder.

## Limitations

The preview runs in Orca's sandboxed plugin frame, which has no file system, no network and no WebAssembly. That causes these limitations:

| What | Behavior |
|---|---|
| `include::` | Shown as a placeholder naming the file |
| Relative or remote images | Shown as a placeholder with alt text and path. `data:` images work |
| PlantUML `!include` of local files | Not supported |
| Other PlantUML stdlib libraries | An error box says the library is not bundled |
| External links, `xref:` to other files | The target is shown as a tooltip, but they are not clickable |
| Raw HTML (`++++` passthrough) | Rendered, with scripts and event handlers removed |
| PlantUML layout | Uses Smetana, because Graphviz is unavailable. Complex graphs can lay out differently from `dot` |

Why some PlantUML stdlib libraries are missing:

- **AWS** (`awslib14`) is too large for Orca's 10 MiB plugin page limit.
- **gcp**, **elastic** and **edgy** declare no license, so they are not redistributed.

## How it works

Orca hosts custom editors in a sandboxed iframe. Its CSP allows only inline scripts and blocks `eval`, WebAssembly, `fetch` and workers. So the build produces **one self-contained HTML file**:

- Asciidoctor.js, DOMPurify and the preview code are bundled with esbuild and embedded gzip-compressed. A tiny bootstrap inflates them with the browser's `DecompressionStream`.
- The PlantUML engine, Mermaid and the stdlib bundles are embedded **brotli-compressed**, which is about 25 % smaller than gzip. A pure-JS decoder unpacks each one only when a document first needs it.
- The result is a single file of about 6 MiB.
- The rendered HTML is sanitized, so a script in a foreign `.adoc` file cannot reach Orca's document API.

Design decisions are in [SPEC.md](SPEC.md).

## Development

Tool versions are pinned in [`mise.toml`](mise.toml), with checksums in `mise.lock`. CI uses the same files, so local and remote builds run on the same Node.

```sh
mise install           # installs the pinned Node (https://mise.jdx.dev)
npm ci
npx playwright install chromium
npm test               # build + render the fixtures in headless Chromium inside a replica of Orca's frame
npm run media          # regenerate images/ and docs/media/demo.gif from the build
```

| Path | Content |
|---|---|
| `src/` | The preview: `bootstrap.ts` (startup), `editor.ts`, `payloads.ts` (lazy brotli payloads), `editor.css` |
| `scripts/build.mjs` | Builds `editor/index.html`. It fails above 9.5 MiB, below Orca's 10 MiB limit |
| `tests/` | Sandbox harness (`orca-frame.mjs`: same sandbox, CSP and click policy as Orca, mocked `window.orca`) and fixtures |
| `vendor/plantuml-stdlib/` | Vendored stdlib bundles, gzipped. The list is in `scripts/stdlib-list.mjs`; refresh with `node scripts/fetch-stdlib.mjs` |
| `orca-plugin.json`, `editor/`, `images/` | The plugin as Orca installs it. `editor/index.html` is committed build output; CI checks that it matches the sources |

Contributions are welcome. Please run `npm test` and commit the rebuilt `editor/index.html` with your change.

## License

[MIT](LICENSE) © David Schowalter. Bundled third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This is a community plugin. It is not affiliated with Orca or Stably.
