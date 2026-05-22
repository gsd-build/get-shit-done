---
type: Fixed
pr: 3798
---
**`phasePlanIndex` and `phase-plan-index` no longer drop `depends_on` edges when plan IDs and dep references differ in case** — fixes wrong wave assignment for plans with `depends_on` references that case-fold differently from canonical plan IDs (e.g. from gsd-planner output that occasionally lowercases IDs) now resolve correctly via case-insensitive lookups while preserving canonical on-disk casing in output. Lowercased identifier lookups now resolve case-mismatched `depends_on` references in the two resolution tiers present in both SDK and CJS (`planMap` + `canonicalToId`). The SDK has an additional `shortFormToId` short-form tier; CJS does not — this PR does not backfill that tier (tracked as a follow-up parity gap). An explicit collision error is thrown when two plan files in the same phase produce IDs that are identical after case-folding, preventing silent DAG rewiring.
