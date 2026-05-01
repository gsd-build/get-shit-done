---
type: Fixed
pr: 2990
---
gsd-code-fixer worktree no longer fails on the same-branch checkout — the agent now creates a new gsd-reviewfix/ branch via git worktree add -b and fast-forwards the user's branch on cleanup. See #2990.
