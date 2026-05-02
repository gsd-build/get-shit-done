---
type: Added
pr: 2795
---
**Optional update banner for non-GSD statusline users** — when the installer detects you've declined or kept a non-GSD statusline, it now offers an opt-in `SessionStart` banner that surfaces update availability via the existing `~/.cache/gsd/gsd-update-check.json` cache. Silent when up-to-date, rate-limits failure diagnostics to once per 24h, removed cleanly by `npx get-shit-done-cc --uninstall`.
