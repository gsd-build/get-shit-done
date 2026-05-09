---
type: Fixed
pr: 3273
---
Orchestrators now have a documented cleanup-tail snippet to run when wave merges deviate from the templated path (e.g., cross-wave dependency merges with custom messages) — residual worktree-agent-* directories can be removed without manual forensics.
