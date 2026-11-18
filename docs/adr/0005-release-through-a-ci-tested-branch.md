---
status: accepted
---

# Release through a pull request opened with a GitHub App token

The ruleset "main: CI required" only lets changes onto `main` through a pull request with a green `test` check from
GitHub Actions; only admins may bypass it. The release workflow commits the rebuilt `editor/index.html` and the
version bump, so it needs a way onto `main` that passes this check.

## Considered Options

- **Release pull request with a GitHub App token** (chosen): the publish job takes a short-lived token of the GitHub
  App `orca-asciidoc-release` (installed on this repository only, Contents and Pull requests: write), pushes the
  release commit to `release/vX.Y.Z`, opens a pull request and enables auto-merge with `--match-head-commit`. Because
  the pull request comes from the app and not from `GITHUB_TOKEN`, CI starts as for any pull request and its `test`
  check counts. GitHub merges once it is green; the merge is a normal push to `main`, so `tag-release.yml` tags the
  release commit and publishes, and CodeQL and Scorecard run by themselves. Needs the variable `RELEASE_APP_ID` and
  the secret `RELEASE_APP_PRIVATE_KEY`.
- **`GITHUB_TOKEN` with CI started by `workflow_dispatch`** (tried on 2026-11-18): CI runs started that way attach
  their check to the commit, but GitHub does not count it for the ruleset, neither for a direct push (run
  44281917429: "Required status check "test" is expected") nor for a pull request (run 44284955915: pull request #12
  showed no checks and stayed blocked).
- **GitHub Actions as a bypass actor of the ruleset**: GitHub refuses it for a repository owned by a personal account
  ("Actor GitHub Actions integration must be part of the ruleset source or owner organization").
- **A person merges the release pull request**: no secret, but every release waits for a click.
- **Fine-grained personal access token**: works like the app, but acts as the maintainer and expires within a year.

## Consequences

- The repository holds one secret, the app's private key. The app can only write contents and pull requests of this
  repository; its tokens live for an hour.
- The workflow has two jobs. `build` runs npm and the build scripts with a read-only token and passes the release
  commit on as a patch; `publish` gets the app token and runs only git and gh.
- The publish job accepts the patch only as exactly one commit that changes nothing but `RELEASE_PATHS` (renames
  counted as deletions), with `package.json`, `package-lock.json` and `orca-plugin.json` changed only in their
  version, and a version that matches the manifest. CI on the release pull request checks that the committed
  `editor/index.html` equals the bundle it built and tested from the merge result.
- If `main` moves before the merge so that the bundle no longer matches, CI on the pull request turns red and it does
  not merge. The next run of the same version force-pushes a new build to the same branch and pull request.
- `main` gets a merge commit per release; the tag points at the release commit below it.
- This guards against a build job that was tampered with, not against a compromised dependency in CI itself: CI
  runs the same dependencies.
