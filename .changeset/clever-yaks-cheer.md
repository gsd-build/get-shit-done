---
type: Fixed
pr: 3798
---
**`phasePlanIndex` no longer drops `depends_on` edges when plan IDs and dep references differ in case** — fixes wrong wave assignment for plans whose filenames contain uppercase characters when referenced in `depends_on` with different casing.
