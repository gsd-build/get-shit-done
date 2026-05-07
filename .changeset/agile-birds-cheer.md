---
type: Fixed
pr: 3046
---
extractCurrentMilestone no longer silently falls through to archived milestones when the active milestone uses a <details><summary>vX.Y…</summary> structure. Phase lookups now correctly resolve to the active milestone's phases in FAMP-style ROADMAPs. Closes #2641.
