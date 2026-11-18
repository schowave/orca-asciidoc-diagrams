---
status: accepted
---

# Use pnpm as the package manager

The project installed its packages with npm. pnpm installs the same packages from the same registry, but keeps them
in a content-addressed store with a strict `node_modules` layout, and runs no install scripts unless they are
allowed one by one.

## Considered Options

- **pnpm** (chosen): a package can only import what it declares, installs reuse one store across worktrees, and
  install scripts are off by default (`pnpm-workspace.yaml` denies the one that asks, esbuild's, which the build does
  not need). The version is pinned in `mise.toml` and in `packageManager`.
- **npm**: works and needs no extra tool, but runs install scripts by default and allows imports of undeclared
  packages through its flat `node_modules`.
- **Yarn or Bun**: no advantage over pnpm here that would justify the change.

## Consequences

- `pnpm-lock.yaml` replaces `package-lock.json`; it was created with `pnpm import`, so every package kept its
  version, and the build is byte-identical to the one from npm.
- Commands are `pnpm install --frozen-lockfile`, `pnpm run …` and `pnpm exec …`; `mise run` tasks are unchanged.
- The release commit no longer touches the lockfile: pnpm's lockfile holds no project version. The release
  workflow's patch check rejects any lockfile change in it.
- A new dependency with an install script fails `pnpm install` until it is allowed or denied in
  `pnpm-workspace.yaml`.
