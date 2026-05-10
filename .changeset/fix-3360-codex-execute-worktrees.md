---
type: Fixed
pr: 3365
---
**Codex `execute-phase` now fails closed when `workflow.use_worktrees=true`** — because Codex `spawn_agent` has no direct mapping for Claude Code's `isolation="worktree"`, the workflow now stops before executor dispatch instead of letting workspace-write agents edit the main checkout while the workflow assumes worktree isolation. (#3360)
