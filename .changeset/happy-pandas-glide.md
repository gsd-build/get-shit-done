---
type: Fixed
pr: 3765
---
**`--cursor --local` install no longer self-deadlocks on `gsd-install-migration.lock` on Windows** — release closure now uses `unlinkSync` so NTFS EPERM surfaces rather than being silently swallowed; stale-lock reclamation detects same-process PID re-entry and dead PIDs, reclaiming immediately instead of spinning for 30 s; empty lock files left by mid-write failures are also cleaned up to prevent orphan stale locks. (#3670)
