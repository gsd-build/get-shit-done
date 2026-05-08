---
type: Fixed
pr: 3247
---
**`gsd-sdk query phase-plan-index` now reads frontmatter from the file's leading block** — plans with embedded YAML examples or markdown horizontal rules no longer silently mis-parse to wave=1, autonomous=true.
