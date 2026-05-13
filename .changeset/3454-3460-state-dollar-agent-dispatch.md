---
type: Fixed
pr: 0
---
**Fix two confirmed bug regressions in debug/session and STATE mutation flows** — the debug session manager now dispatches subagents with `Agent(...)` (not stale `Task(...)` syntax), restoring intended isolated delegation (`#3460`). STATE mutation paths now use function-form `String.replace` for Current Position and metrics table rewrites so literal dollar amounts like `$2,500` are treated as plain text rather than backreferences, preventing body corruption during `state advance-plan`, `state begin-phase`, and `state complete-phase` (`#3454`).
