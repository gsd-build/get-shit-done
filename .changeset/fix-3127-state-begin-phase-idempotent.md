---
type: Fixed
pr: 3127
---
**`state.begin-phase` is now idempotent** — when called on a phase already in-flight (e.g. `--wave N` resume), it no longer overwrites `Current Plan`, `stopped_at` narrative, `Plan: N of M` body line, or `Last Activity Description` with stale values from the last `plan-phase` run. An idempotency guard reads the current `Status` field before writing: if it already contains `Executing Phase N`, only the `Last Activity` date and a resume-specific activity line are updated; all execution-progress fields are preserved. First-time execution (Status ≠ Executing) continues to write all fields as before. Closes #3127.
