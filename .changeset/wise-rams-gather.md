---
type: Fixed
pr: 3318
---
**`detect-custom-files` now scans `skills/`** — SDK port omitted `skills` from `GSD_MANAGED_DIRS`, so user-added skills under `<config-dir>/skills/<name>/` were never detected and got silently destroyed during `/gsd-update` (no entry written to `gsd-user-files-backup/`). One-line parity with `bin/gsd-tools.cjs`. (#3317)
