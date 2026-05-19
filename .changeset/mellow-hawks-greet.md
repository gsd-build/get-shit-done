---
type: Fixed
pr: 3705
---
Repair Windows-only TOCTOU regression in acquireStateLock — last-retry stale-lock recovery now re-acquires the lock atomically before proceeding, so concurrent state writes to different fields both persist (fixes main CI red on locking-bugs regression test).
