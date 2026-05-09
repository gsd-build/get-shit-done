---
type: Fixed
pr: 3306
---
**Phase directories in `/gsd-plan-milestone-gaps`, `/gsd-import`, and `/gsd-capture --backlog` now honour `project_code` prefix** — three workflow files were constructing phase directory paths using raw `{NN}-{slug}` patterns, bypassing the `project_code` prefix from `.planning/config.json`. In a project with `project_code: "XR"`, these workflows created `06-fix-auth/` instead of `XR-06-fix-auth/`, while `/gsd-plan-phase` and `/gsd-discuss-phase` (fixed in #3292) correctly produced the prefixed form. All three paths now resolve the directory name via `gsd-sdk query init.phase-op` (plan-milestone-gaps, import) or read `project_code` via `config-get` (add-backlog), consistent with the PRED.k015 requirement that project_code prefix is applied at all consumers. (#3298)
