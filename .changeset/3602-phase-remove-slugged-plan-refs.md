---
type: Fixed
issue: 3602
---
**`phase remove N` now renumbers slugged plan references in ROADMAP.md** — the plan-reference renumbering regex in `get-shit-done/bin/lib/phase.cjs:updateRoadmapAfterPhaseRemoval` previously only matched compact filenames like `07-01-PLAN.md`. A slug between the plan number and the `-PLAN.md` / `-SUMMARY.md` suffix (e.g. `07-01-cherry-pick-foundation-PLAN.md`) broke the lookahead, so the on-disk file was renamed but the ROADMAP entry kept pointing at the stale `07-01-…` prefix. The suffix lookahead now allows an optional kebab-case slug segment between the number and the canonical suffix.
