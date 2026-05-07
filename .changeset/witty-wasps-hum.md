---
type: Fixed
pr: 3191
---
validate consistency, validate health, and find-phase now scan .planning/milestones/v*-phases/ dirs in addition to the flat .planning/phases/ layout. Projects using milestone-archive layout no longer receive spurious W006 warnings for every active phase. Fixes #3164.
