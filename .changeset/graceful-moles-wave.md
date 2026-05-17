---
type: Fixed
pr: 3526
---
**`/gsd-quick` worktree-merge cleanup loop no longer silently no-ops the main-branch merge when orchestrator CWD leaks into a worktree (#3521)** — the post-merge cleanup loop now resolves `PROJECT_ROOT` via `git -C "$WT" rev-parse --git-common-dir` and pins CWD with `cd "$PROJECT_ROOT"` at the top of each iteration body before any bare `git` command; iterations that cannot resolve the root log a skip message and continue safely.
