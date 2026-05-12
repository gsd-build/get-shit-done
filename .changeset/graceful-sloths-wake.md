---
type: Fixed
pr: 3420
---
**`/gsd-progress --next` no longer falls through to the default route** — the command now surfaces raw arguments on a dedicated line before flag parsing so `--next`, `--do`, and `--forensic` routing instructions remain stable for the model.
