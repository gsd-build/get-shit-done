---
type: Fixed
pr: 3128
---
**`roadmap.cjs` plan_count now correctly detects `{N}-PLAN-{NN}-{slug}.md` files** — the manager-dashboard plan-count filter matched only `*-PLAN.md` and `PLAN.md`, missing the slug-form layout (`5-PLAN-01-setup.md`) that `gsd-plan-phase` actually writes. `init manager` returned `plan_count: 0` / `disk_status: "discussed"` for fully-planned phases, causing the manager to recommend and dispatch redundant background planner agents. Same regex flaw as #2893 (fixed in `phase.cjs` via PR #2896); `roadmap.cjs` was missed in that sweep. Fix applies the same `looksLikePlanFile` logic (with `PLAN-OUTLINE` and `pre-bounce` exclusions) to `countPhasePlansAndSummaries`. Closes #3128.
