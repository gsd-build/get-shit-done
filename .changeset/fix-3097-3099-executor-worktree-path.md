---
type: Fixed
pr: 3097
---
**Executor agents now detect and halt on cwd-drift out of worktrees (#3097)** — when a Bash call `cd`'d out of a worktree, `[ -f .git ]` became false (main repo's `.git` is a directory), silently skipping all HEAD/branch guards and allowing commits to land on the main repo's branch. Adds step 0a (cwd-drift sentinel using `git rev-parse --git-dir` + a per-worktree sentinel file at `.git/worktrees/<name>/gsd-spawn-toplevel`) to `gsd-executor.md`'s `task_commit_protocol`. Closes #3097.

---
type: Fixed
pr: 3099
---
**Executor agents now detect absolute paths that resolve outside the worktree (#3099)** — absolute paths constructed from the orchestrator's `pwd` (main repo root) resolved to the main repo when used in Edit/Write calls from a worktree, silently losing work. Adds step 0b (absolute-path guard using `WT_ROOT=$(git rev-parse --show-toplevel)`) with a clear warning and instructions to prefer relative paths. Both guards are documented in `references/worktree-path-safety.md` (loaded into every executor spawn prompt via `<execution_context>`). Closes #3099.
