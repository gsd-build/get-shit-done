---
type: Fixed
pr: 3804
---
**SDK `worktree.cleanup-wave` now rescues the executor's uncommitted `SUMMARY.md` instead of blocking on it** — worktree-isolated quick/phase executors leave `SUMMARY.md` uncommitted by contract (the orchestrator commits the docs bundle in a later step), but the SDK cleanup path's porcelain dirty-check was treating that contractual artifact as `worktree_dirty` and refusing to merge, stranding the worktree and the SUMMARY. `executeWorktreeWaveCleanupPlan` now mirrors the shell-fallback rescue (`workflows/quick.md:870-883`): it walks the worktree's `.planning` tree for `*SUMMARY.md` via filesystem traversal (not `git ls-files` — gitignored `.planning/` would silently return empty), copies any new-or-differing file into the main tree, and filters the rescued paths out of the dirty-state check. Genuine non-SUMMARY dirt still blocks. Copy failures surface as `summary_rescue_failed` rather than swallow silently. (#3804)
