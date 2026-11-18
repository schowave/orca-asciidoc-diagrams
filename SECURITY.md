# Security policy

The plugin renders `.adoc` files, which may come from other people, inside Orca's sandboxed plugin frame. It never writes to your files, has no network access, and sanitizes the rendered HTML, so a document cannot run scripts or reach Orca's document API. A way around any of that is a security issue.

## Reporting a vulnerability

Please report it privately through [GitHub's private vulnerability reporting](https://github.com/schowave/orca-asciidoc-diagrams/security/advisories/new), not in a public issue. Include the Orca and plugin versions and a document that shows the problem.

You can expect a first answer within a week. Fixes ship as a new release, which Orca installs automatically for users of the plugin directory.

## Verifying a release

Every release after 1.3.0 attaches `index.html` (the bundle Orca installs) and its signed build provenance. Download `index.html` from the release and check it with the [GitHub CLI](https://cli.github.com):

```sh
gh attestation verify index.html --repo schowave/orca-asciidoc-diagrams
```

## Supported versions

Only the newest release gets fixes.
