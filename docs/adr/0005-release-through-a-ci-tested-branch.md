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
- The release job itself only builds; the dispatched CI run does the tests, so they run once per release.
- If `main` moves while CI runs (for example a Renovate merge), the fast-forward fails and the release is skipped
  until the next run (or a manual dispatch). The release branch is deleted afterwards, and a leftover one is
  overwritten by the next run.
