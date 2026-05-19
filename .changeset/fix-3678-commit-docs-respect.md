---
type: Fixed
pr: 3679
---
**`gsd-executor` no longer force-commits `.planning/` artifacts when `commit_docs: false`** — the executor agent prompt now explicitly handles the SDK's `{committed:false, skipped:true, reason:'skipped_commit_docs_false'}` envelope and is forbidden from falling back to raw `git add` / `git add -f` / `git commit`. The SDK's `cmdCommit` now sets `skipped: true` on both skip paths (`commit_docs:false` and `.planning gitignored`) so agents see the skip as a first-class signal. A structural regression test bans `git add -f` / `git add --force` from any agent or workflow body. (#3678)
