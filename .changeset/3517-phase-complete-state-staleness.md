---
type: Fixed
pr: 3520
---
**`phase.complete` STATE.md staleness and idempotency fixed** — Two root causes corrected atomically: (1) `completed_phases` was blindly incremented (`+1`), making `phase.complete N` non-idempotent — running it twice on the same phase double-counted (4→5→6). It now derives the count from the ROADMAP progress table's `Complete` rows, so repeated calls produce the same result. (2) Eight STATE.md fields were left stale after phase completion: `stopped_at`, `last_updated`, `total_plans`, `completed_plans` (frontmatter) and `Current focus:`, `Status:`, `Progress:` bar, `By Phase` table row (body). All fields are now updated in the same atomic write guarded by the existing `acquireStateLock`/`releaseStateLock` pair. `completed_plans` is derived from on-disk `*-SUMMARY.md` file counts; `total_plans` from ROADMAP M/N plan column sums; `percent` from the freshly-derived phase counts. (#3517)
