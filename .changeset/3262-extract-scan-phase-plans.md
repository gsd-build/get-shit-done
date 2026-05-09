---
type: Enhancement
pr: 3262
---
**Shared `scanPhasePlans()` helper extracted from four divergent copies (k014)** — `state.cjs` (3 copies), `roadmap.cjs`, and `init.cjs` each maintained their own plan-scan loop with subtly different regex shapes; divergence caused the plan-count drift that triggered #3257. All four call sites now delegate to `bin/lib/plan-scan.cjs:scanPhasePlans(phaseDir)` which returns `{ planCount, summaryCount, completed, hasNestedPlans, planFiles, summaryFiles }`. The canonical helper adopts roadmap.cjs's broader `isPlanFile` (matching the extended `5-PLAN-01-setup.md` layout gsd-plan-phase writes), adds the `-PLAN-\d+` nested-file variant init.cjs missed, and widens OUTLINE/pre-bounce exclusions to cover both flat and nested forms. (#3262)
