# AsciiDoc Preview – PlantUML, Mermaid & Graphviz (Orca plugin)

An Orca plugin that renders AsciiDoc with inline PlantUML, Mermaid and Graphviz diagrams, fully offline, inside Orca's sandboxed frame. It builds into one self-contained `editor/index.html` (about 6 MiB; Orca's limit is 10 MiB).

## Verify your work

Setup in a fresh clone: `mise trust && mise run setup`.

Run `mise run check` (same as `npm run check`) after every change. It runs Prettier, ESLint, `tsc --noEmit` (strict), the TODO rule and the unit tests, and stops at the first failure. Fix every failure it reports.

Slower stages and when they are required:

- `mise run test` (build, then render `tests/fixtures/*.adoc` in headless Chromium in a replica of Orca's frame): when `src/`, `scripts/build.mjs`, `tests/` or the dependencies change.
- `mise run check-deep` (knip, jscpd, license check): when you add or remove a dependency, a module or a script. CI runs it on every push.

When a check fails, fix the code. Changing a test's expectation, skipping a test or lowering a threshold needs a reason in the commit message (not enforced; `.only` and `.skip` in tests are rejected by ESLint).

Enforced by: lefthook pre-commit hooks (Prettier, ESLint, a 500 KB file limit) and the CI workflow `.github/workflows/ci.yml`, which runs the commands above.

## Working with the platform

Use `gh` for pull requests and CI results, for example `gh pr create` and `gh run list`. The repository is `schowave/orca-asciidoc-diagrams`.

Mark agent changes with the commit trailer `Assisted-by: Claude Code`, so the history can tell them apart (not enforced).

Work in a git worktree of your own, not in the main checkout. In a new worktree run `mise run setup`: it reuses the npm and Playwright caches. Tests use no ports or databases, so worktrees can run them in parallel; each writes to its own `test-results/` and `dist/`.

## Definition of done

- `mise run check` is green, and `mise run test` where the stages above require it.
- User-visible change → entry in `README.md` (features, limitations) and, if it changes the design, `SPEC.md`. `CHANGELOG.md` is written by `scripts/release.mjs`; do not edit it.
- Technical decision with real alternatives → new ADR in `docs/adr/` (not enforced).
- New domain term → entry in `GLOSSARY.md` (not enforced).

## Layout

- `src/`: the preview that runs in the frame. `bootstrap.ts` starts it, `editor.ts` renders (DOM), `text.ts` holds the pure helpers, `payloads.ts` loads the lazy compressed engines (decision: `docs/adr/0002-single-file-bundle-for-orca-frame.md`).
- `scripts/`: build (`build.mjs`), stdlib download and lock (`fetch-stdlib.mjs`, `stdlib-lock.mjs`), release and stats scripts. `tests/unit/`: unit tests. `tests/`: browser harness and fixtures.
- Generated, do not edit: `editor/index.html`, `dist/`, `vendor/plantuml-stdlib/` (a gitignored download cache), `vendor/plantuml-stdlib.lock.json`.

## Conventions

- Code style is Prettier's (no semicolons, single quotes, 120 columns) and ESLint's: camelCase for variables and functions (UPPER_CASE for constants, PascalCase for types and the engine globals `PlantUML` and `Viz`), complexity at most 11, files under 500 lines.
- Tests are `*.test.ts` in `tests/unit/` and use `node:test`. They import from `src/text.ts` and `scripts/`. Put logic you want to test in a module without DOM or bundler imports, as `src/text.ts` does; `src/editor.ts` needs the DOM and is covered by the browser harness.
- TODO and FIXME carry an author and a link: `// TODO(name): … https://…` (enforced by `npm run todo:check`).
- The frame has no network, no `eval`, no WebAssembly. Do not add code that needs them. Everything lazy-loaded goes through `src/payloads.ts`.
- `editor/index.html` and `dist/` are build output. Do not edit them; the weekly release workflow rebuilds and commits `editor/index.html`.
- The PlantUML stdlib bundles are not committed: the Orca catalog refuses archives in a plugin. `node scripts/fetch-stdlib.mjs` downloads them, and `mise run setup` does that too. Only `vendor/plantuml-stdlib.lock.json` (SHA-256 per library) is committed; `--update` rewrites it, and the weekly release workflow runs it. Never commit binary files: the catalog rejects the whole release.

## Hard limits

- Ask before adding or upgrading a dependency, or changing `orca-plugin.json`, the CSP-related code in `tests/orca-frame.mjs`, or `.github/workflows/`.
- Ask before pushing to `main`, creating tags or releases, or force-pushing. Releases come from the release workflow.
- Stop and ask when the task leaves room for two readings, a fix needs a change outside the task's module, or a check fails for reasons unrelated to your change.
- Keep secrets out of code, logs and prompts. The repo needs none; the release workflow uses GitHub's own token.

## Where to find context

- Design decisions and platform constraints: `SPEC.md`
- How it works, install and limits: `README.md`
- Glossary: `GLOSSARY.md`
- Architecture decisions: `docs/adr/`
- Dependency licenses: `LICENSE-POLICY.md` and `THIRD_PARTY_NOTICES.md`
- Agent contribution measures (share of agent commits, revert rate): `docs/agent-stats.md`, refreshed by the release workflow
