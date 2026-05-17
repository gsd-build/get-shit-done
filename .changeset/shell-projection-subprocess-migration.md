---
type: Changed
pr: 3476
---
Migrate all subprocess call sites to the shell-command-projection seam (`execGit`, `execNpm`, `execTool`, `probeTty`). Removes scattered platform-conditional logic and normalizes subprocess error handling. Local `execGit` wrapper removed from `core.cjs`; `verify.cjs` and `worktree-safety.cjs` migrated to the seam's `(args, opts)` signature. See #3466.
