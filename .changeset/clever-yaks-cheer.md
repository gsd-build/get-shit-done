---
type: Fixed
pr: 3798
---
**`phasePlanIndex` and `phase-plan-index` no longer drop `depends_on` edges when plan IDs and dep references differ in case** — fixes wrong wave assignment for plans whose filenames contain uppercase characters when referenced in `depends_on` with different casing. Both the SDK query path and the CJS CLI path now normalize identifiers to lowercase on write and lowercase dep strings before lookup. An explicit collision error is thrown when two plan files in the same phase produce IDs that are identical after case-folding, preventing silent DAG rewiring.
