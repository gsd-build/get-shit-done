---
type: Fixed
pr: 3283
---
**Worktree health paths no longer hang on stuck git subprocesses** — `execGit` / `execGitDefault` now bound their git subprocess calls with a 10s timeout (overridable), and downstream callers in `init.cjs` / `verify.cjs` / `worktree-safety.cjs` surface a structured WARNING instead of silently swallowing the timeout/error. Init progress and verify health remain non-crashing when git is unavailable but report degraded worktree health-check status.
