---
status: accepted
---

# Release through a CI-tested branch, not a direct push

The ruleset "main: CI required" only accepts commits on `main` that carry a green `test` check from GitHub Actions;
only admins may bypass it. The release workflow commits the rebuilt `editor/index.html` and the version bump with
`GITHUB_TOKEN`, so its direct push to `main` was rejected. Pushes and pull requests made with `GITHUB_TOKEN` start no
workflows, so CI would never run on such a commit by itself.

## Considered Options

- **Release branch plus dispatched CI** (chosen): the workflow pushes the release commit to `release/vX.Y.Z`, starts
  CI there with `gh workflow run` (a dispatch is the one event `GITHUB_TOKEN` may trigger), waits for it, then
  fast-forwards `main` to the tested commit and tags it. No secret, and the tag points at exactly the commit CI tested.
- **Pull request with auto-merge**: CI would not start on a pull request opened with `GITHUB_TOKEN` either, and a
  squash merge changes the commit the tag must point at.
- **GitHub App or personal access token as a bypass actor**: works, but needs a secret in the repository, which the
  project avoids, and skips the check instead of passing it.

## Consequences

- `ci.yml` accepts `workflow_dispatch`; the release job needs `actions: write`.
- The workflow has two jobs. `build` runs npm and the build scripts with a read-only token and passes the release
  commit on as a patch; `publish` holds the write permissions and runs only git and gh. It does not test: the
  dispatched CI run does, so the tests run once per release.
- If `main` moves while CI runs (for example a Renovate merge), the fast-forward fails. The build is then stale, so
  the workflow dispatches itself again to build from the new `main`, up to three attempts.
- The release branch is deleted afterwards, and a leftover one is overwritten by the next run.
- The publish job pushes the patch only if it changes nothing but the release files, and CI on a release branch
  checks that the committed `editor/index.html` equals the bundle it built and tested.
- Only one run can wait in the `release` concurrency group: a manual dispatch made while a restart is pending (or
  the other way round) replaces it. Rare, and a later run releases the same changes.
- Push triggers do not fire for the release commit on `main`, so `publish` dispatches CodeQL and Scorecard for it.
