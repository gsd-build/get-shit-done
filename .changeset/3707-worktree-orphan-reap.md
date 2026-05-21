---
type: Fixed
pr: 3707
---
**Locked worktrees now cleaned up correctly** — `executeWorktreeWaveCleanupPlan` previously issued a single `git worktree remove --force` which Git refuses on locked worktrees, blocking every post-merge cleanup when Claude Code's agent runtime held a lock file. The fix attempts `git worktree unlock` then retries the remove. A new `worktree.reap-orphans` command (`gsd-sdk query worktree.reap-orphans`) sweeps orphaned locked worktrees from prior crashed sessions at startup — it reaps entries whose pid is dead, branch is merged into the default branch, and lock mtime is older than 5 minutes. Wired into `quick.md` and `execute-phase.md` startup. (#3707)
