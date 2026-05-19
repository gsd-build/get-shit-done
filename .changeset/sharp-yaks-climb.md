---
type: Fixed
pr: 3714
---
Restore mutual exclusion in acquireStateLock: only unlink locks past staleness threshold, deadline-driven retry. Fixes lost-update regression from #3711 where concurrent state mutations could clobber each other under CI/instrumented load.
