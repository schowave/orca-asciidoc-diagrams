# License policy

The plugin is MIT-licensed and redistributes its runtime dependencies inside `editor/index.html`, so every runtime dependency must carry a license that allows that.

## Allowed

MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, Unlicense, MPL-2.0 (also as `MPL-2.0 OR Apache-2.0`), EPL-2.0.

- **EPL-2.0** is allowed for `elkjs`, which Mermaid pulls in. It is weak copyleft and is bundled unmodified; its notice is in `THIRD_PARTY_NOTICES.md`.
- Anything else (GPL, AGPL, LGPL, proprietary, missing license) needs a decision and an ADR in `docs/adr/` before it is added.

## Enforced

`npm run licenses` (part of `npm run check:deep`, run by CI) fails when a production dependency has a license outside this list. The list lives in the `licenses` script in `package.json`; keep both in sync.

`khroma` is excluded from the check: the tool only guesses `MIT*` for it; its repository declares MIT.

Development dependencies are not redistributed and are not checked.
