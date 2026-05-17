---
type: Fixed
pr: 3462
---
**`/gsd-debug` session manager now dispatches via `Agent()`** — stale `Task()` invocation no longer collapses debugger work into inline execution.
