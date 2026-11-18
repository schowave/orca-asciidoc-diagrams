---
status: accepted
---

# Sign the released bundle with GitHub build provenance

Users install `editor/index.html` through the Orca catalog, which takes it from the tagged commit. Nothing showed that
this file was built by the release workflow from the repository's sources and not changed by hand. The OpenSSF
Scorecard (Signed-Releases) and the Best Practices badge ask for signed releases.

## Considered Options

- **`actions/attest-build-provenance`** (chosen): signs SLSA provenance for `editor/index.html` keylessly through
  Sigstore with the workflow's OIDC token, and stores it in GitHub's attestation store. `gh attestation verify`
  checks it. The release also attaches the bundle and the `.intoto.jsonl`, which Scorecard detects.
- **cosign with a key pair**: needs a secret in the repository, which the project avoids.
- **Checksums only** (`SHA256SUMS` on the release): shows integrity, not who built the file, and Scorecard does not
  count it.

## Consequences

- `tag-release.yml` signs the provenance when the release pull request is merged into `main` (ADR 0005); only that job has `id-token: write` and `attestations: write`.
- The provenance names the merge commit on `main` that started the job; the tag points at the release commit below it, whose `editor/index.html` is the attested file. A bundle is only signed once it is on `main`.
- Release assets are for verification only. The catalog keeps installing from the tag.
