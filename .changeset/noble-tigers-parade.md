---
type: Fixed
pr: 3796
---
**`parseChangelog` now captures multi-line bullets** — bullets where the `(#NNNN)` PR trailer appears on a continuation line are no longer silently dropped. Adds `changeset/cli.cjs extract --from VERSION --to VERSION` for deterministic range-aware changelog extraction in `/gsd:update`.
