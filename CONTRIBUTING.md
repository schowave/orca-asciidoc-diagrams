# Contributing

Thanks for helping. Bug reports, diagram examples that render wrongly and pull requests are all welcome. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting a problem

Open an [issue](https://github.com/schowave/orca-asciidoc-diagrams/issues/new/choose) with your Orca version, the plugin version and the smallest `.adoc` snippet that shows the problem. For security issues, see [SECURITY.md](SECURITY.md) instead.

## Development

Tool versions and tasks live in [`mise.toml`](mise.toml), with checksums in `mise.lock`. CI uses the same files, so local and remote builds run on the same Node.

```sh
mise trust && mise run setup   # once: pinned Node and lefthook, npm packages, headless Chromium, git hooks (https://mise.jdx.dev)
mise run check         # fast checks: format, lint, types, TODO rule, unit tests
mise run check-deep    # dead code, duplicate code, dependency licenses (CI runs these too)
mise run test          # build + render the fixtures in headless Chromium inside a replica of Orca's frame
mise run build         # build only: editor/index.html and dist/plugin
mise run media         # regenerate images/, docs/media/demo.gif and the GitHub social preview from the build
mise tasks             # list all tasks
```

| Path | Content |
|---|---|
| `src/` | The preview: `bootstrap.ts` (startup), `convert.ts` (AsciiDoc to HTML), `editor.ts` (rendering), `diagram-tools.ts` and `zoom.ts` (diagram toolbar and zoom overlay), `text.ts` (pure helpers), `payloads.ts` and `base122.ts` (lazy brotli payloads), `payloads/` (highlight.js and KaTeX entries), `editor.css` |
| `scripts/build.mjs` | Builds `editor/index.html`. It fails above 9.5 MiB, below Orca's 10 MiB limit |
| `tests/unit/` | Unit tests (`*.test.ts`, run by `node --test`) for `src/text.ts`, `src/convert.ts`, `src/base122.ts` and `scripts/` |
| `tests/` | Sandbox harness (`orca-frame.mjs`: same sandbox, CSP and click policy as Orca, mocked `window.orca`) and fixtures |
| `vendor/plantuml-stdlib.lock.json` | SHA-256 of each bundled PlantUML stdlib library. The libraries themselves are not committed, because the Orca catalog refuses archives. `mise run fetch-stdlib` downloads them into the gitignored `vendor/plantuml-stdlib/`, and `--update` pins new upstream versions; the release workflow does that weekly. The list is in `scripts/stdlib-list.mjs` |
| `orca-plugin.json`, `editor/`, `images/` | The plugin as Orca installs it. `editor/index.html` is committed build output; the release workflow rebuilds and commits it |

## Pull requests

- Run `mise run check` and `mise run test` before you push; CI runs the same, plus `mise run check-deep`.
- Changes users notice get a line under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md), written for users. The release workflow turns it into the release notes.
- Leave `editor/index.html` alone: the weekly release workflow rebuilds and commits it.
- Design decisions are in [SPEC.md](SPEC.md) and [docs/adr/](docs/adr/); rules for coding agents are in [AGENTS.md](AGENTS.md).

Releases are cut by the release workflow, weekly or by hand; the Orca plugin directory picks up each new tag.
