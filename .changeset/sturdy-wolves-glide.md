---
type: Fixed
pr: 3564
---
**validate.health no longer raises W007 for archived milestone phases** - archived `v*-phases` directories remain valid for historical W006 checks, but W007 now only reports unexpected active phase directories. Fixes #3560.
