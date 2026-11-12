---
status: accepted
---

# Encode the embedded payloads as base-122 text

The payloads (ADR 0002) are binary, brotli or gzip, but must sit as text inside `<script>` elements of the
single-file entry, which Orca caps at 10 MiB. Base64 adds 33 % to every payload; with Graphviz, highlight.js and KaTeX
the entry had reached 6.96 MiB, leaving little room for more renderers or stdlib libraries.

## Considered Options

- **A base-122 variant** (chosen, `src/base122.ts`): about 14 % overhead, so the entry drops to 5.97 MiB. Bytes are
  read as 7-bit groups and stored as ASCII; the three characters the HTML parser would change or that could end the
  script element (NUL, CR, `<`) are merged with the next group into one two-byte character. Decoding is a small pure
  function shared by the build and the frame; it makes the in-browser load about 25 ms slower.
- **Base64**: built into the browser and simplest, but costs about 1 MiB of the page budget.
- **Raw bytes or a binary format**: not possible, the entry is one HTML page parsed as UTF-8, and the frame cannot load
  separate files.

## Consequences

- `src/base122.ts` must stay free of DOM and imports, because `scripts/build.mjs` (Node) and the frame both run it.
  Its unit tests cover the round trip and the forbidden characters.
- Each payload records its byte length (`data-length`), since the encoded text does not determine it.
- Revisit if Orca lifts the page limit or lets a plugin load assets separately.
