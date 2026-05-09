---
type: Fixed
pr: 3292
---
**`/gsd-discuss-phase` and `/gsd-plan-phase` first-touch creation now apply `project_code` prefix consistently with `phase.add`/`phase.insert`** — projects with `project_code` set in `.planning/config.json` no longer accumulate a two-headed naming convention (`01-foundation/` mixed with `XR-02.1-spike/`). Routes all phase-directory creation through a single shared `getPhaseDirName` helper to prevent future drift.
