---
status: accepted
---

# Release through a CI-tested pull request, not a direct push

The ruleset "main: CI required" only lets changes onto `main` with a green `test` check from GitHub Actions; only
admins may bypass it. The release workflow commits the rebuilt `editor/index.html` and the version bump with
`GITHUB_TOKEN`, so its direct push to `main` was rejected. Pushes and pull requests made with `GITHUB_TOKEN` start no
workflows, so CI would never run on such a commit by itself.

## Considered Options

- **Release pull request plus dispatched CI** (chosen): the workflow pushes the release commit to `release/vX.Y.Z`,
  opens a pull request from it, starts CI there with `gh workflow run` (a dispatch is the one event `GITHUB_TOKEN` may
  trigger), waits for it and merges the pull request with `--match-head-commit`, so only the tested commit goes in.
  The tag goes on that release commit, which the merge made part of `main`. No secret, and the ruleset stays as it is.
  Needs the repository setting "Allow GitHub Actions to create and approve pull requests".
- **Release branch, then a direct push of the tested commit** (tried first, release run 44281917429 on 2026-11-18):
  the commit had a green `test` check from GitHub Actions, yet the ruleset refused the push with "Required status
  check "test" is expected". A ruleset's required checks are met only through a pull request.
- **GitHub Actions as a bypass actor of the ruleset**: GitHub refuses it for a repository owned by a personal account
  ("Actor GitHub Actions integration must be part of the ruleset source or owner organization").
- **Deploy key, GitHub App or personal access token as a bypass actor**: works, but needs a secret in the repository,
  which the project avoids, and skips the check instead of passing it.

## Consequences

- `ci.yml` accepts `workflow_dispatch`; the publish job needs `actions: write` and `pull-requests: write`.
- The workflow has two jobs. `build` runs npm and the build scripts with a read-only token and passes the release
  commit on as a patch; `publish` holds the write permissions and runs only git and gh. It does not test: the
  dispatched CI run does, so the tests run once per release.
- The publish job accepts the patch only as exactly one commit that changes nothing but `RELEASE_PATHS` (renames
  counted as deletions), with `package.json`, `package-lock.json` and `orca-plugin.json` changed only in their
  version, and a version that matches the manifest. CI on a release branch checks that the committed
  `editor/index.html` equals the bundle it built and tested.
- If `main` moves while CI runs (for example a Renovate merge), the build is stale: the workflow closes the pull
  request and dispatches itself again to build from the new `main`, up to three attempts.
- `main` gets a merge commit per release; the tag points at the release commit below it.
- After the merge, the tag push and the GitHub release can still fail. The error then says what to finish by hand.
- A pull request left open by a failed run is closed and the release branch deleted; a leftover branch is
  overwritten by the next run.
- This guards against a build job that was tampered with, not against a compromised dependency in CI itself: CI
  runs the same dependencies.
- Only one run can wait in the `release` concurrency group: a manual dispatch made while a restart is pending (or
  the other way round) replaces it. Rare, and a later run releases the same changes.
- Merges made with `GITHUB_TOKEN` start no push workflows, so `publish` dispatches CodeQL and Scorecard for `main`.
