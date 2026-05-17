---
type: Fixed
pr: 3565
---
**validate.health no longer warns W006 for not-started phases** - unchecked roadmap phase entries are treated as planned/future and no longer require on-disk phase directories until work has started. Fixes #3559.
