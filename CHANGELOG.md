# Changelog

## 1.1.3

- New name: **AsciiDoc Preview – PlantUML, Mermaid & Graphviz**. The plugin id is unchanged, so existing installs update normally
- Smaller install (about 3 MiB less): the PlantUML library sources are no longer part of the plugin. The preview itself is unchanged
- Meets the Orca plugin directory's rules: no archive files in the plugin

## 1.1.2

- About 1 MiB smaller (5.97 MiB instead of 6.96 MiB): the embedded libraries use a more compact text encoding
- The README shows a copyable Git URL for the newest release

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
