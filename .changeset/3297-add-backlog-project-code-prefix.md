---
type: Fixed
pr: 3297
---
**`/gsd-capture --backlog` now applies `project_code` prefix to the backlog phase directory** — projects with `project_code` set in `.planning/config.json` no longer accumulate a naming mismatch between active phases (e.g. `CK-01-foundation/`) and backlog items (e.g. `999.1-my-idea/`). `workflows/add-backlog.md` Step 4 now reads `project_code` via `gsd-sdk query config-get project_code` and prepends `${PREFIX:+${PREFIX}-}` to the `${NEXT}-${SLUG}` name, producing `CK-999.1-my-idea/` for projects with a prefix set. When `project_code` is empty or absent the path is unchanged (graceful fallback). (#3297)
