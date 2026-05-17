---
type: Security
issue: 3589
---
**`relPlanningPath()` now validates explicit workstream names** — direct SDK callers passing a workstream argument to `relPlanningPath`, `planningPaths`, or `ContextEngine` previously had no path-traversal gate. A value like `'../../../outside'` flowed through `posix.join('.planning', 'workstreams', name)` and routed planning operations outside the intended `.planning/workstreams/<name>` subtree. The fix runs the shared `validateWorkstreamName` policy inside `relPlanningPath` so every consumer fails closed at the same seam. Env-sourced workstreams continue to fall back silently to root `.planning/` per the #2791 contract (they are filtered to `null` by `planningPaths` before reaching `relPlanningPath`).
