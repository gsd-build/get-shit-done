---
type: Fixed
pr: 3291
---
**`state record-metric` and `state add-decision` no longer silently lose data** — when their target sections are missing they now auto-create the canonical scaffold (matching `state begin-phase` / `state advance-plan` DWIM behavior). `state add-blocker` receives the same fix. All three verbs now also honor `--ws <name>` to route writes to `.planning/workstreams/<name>/STATE.md` instead of always hitting root `.planning/STATE.md`.
