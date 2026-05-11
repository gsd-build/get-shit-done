---
type: Fixed
pr: 3416
---
**`phase remove --force <phase>` now works correctly across both CLI and SDK query paths (#3409)** — flag parsing no longer treats `--force` as the phase id when the flag appears before the positional argument, preventing false success responses and unintended `STATE.md` phase-count drift.
