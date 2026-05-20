---
type: Fixed
pr: 3670
---
Windows --cursor --local install no longer self-deadlocks on gsd-install-migration.lock — release closure uses unlinkSync so Windows NTFS EPERM surfaces rather than being silently swallowed; stale-lock reclamation detects same-process PID re-entry and dead PIDs, reclaiming immediately instead of spinning for 30 s.
