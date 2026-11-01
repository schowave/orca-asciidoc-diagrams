# Changelog

## 1.1.2

- Shrink the plugin by 1 MiB with base-122 payloads; README shows the newest install URL
- CHANGELOG: user-facing notes for 1.1.1

## 1.1.1

- New name: **AsciiDoc Preview – Diagrams, Code & Math**. The plugin id is unchanged, so existing installs update normally
- The cover lists all formats: PlantUML, Mermaid, Graphviz, code and math
- Internal: a developer harness (formatting, linting, unit tests and agent guide) and more reliable release automation

## 1.1.0

- Graphviz: `[graphviz]` blocks, with `layout=` (dot, neato, circo, …)
- Syntax highlighting for source blocks (highlight.js, light and dark themes)
- Math with `:stem:`: latexmath and asciimath, inline and as blocks (KaTeX)
- Custom PlantUML stdlib selection for your own builds: `PLANTUML_STDLIB=c4,awslib14`
- Development setup with mise: `mise run setup`, `mise run test`
- The demo document and screenshots show the new formats

## 1.0.0

First release.

- Preview for `.adoc`, `.asciidoc` and `.asc` files, with live updates
- PlantUML via the official JS engine (Smetana layout), with bundled stdlib libraries: C4, ArchiMate, tupadr3, logos, office, azure, kubernetes, k8s, eip and DomainStory
- Mermaid 12
- Light and dark theme, fit-to-width diagrams, error boxes for broken diagrams
- TOC (including a `toc: left/right` sidebar) and in-document links
- Placeholders for `include::` and images the sandbox cannot load
- Sanitized output
