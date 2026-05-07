---
type: Fixed
pr: 3195
---
**`/gsd-quick` worktree-merge resurrection guard no longer deletes brand-new `.planning/` files (#3195)** — the inverted `PRE_MERGE_FILES` grep that caused any file absent from the pre-merge snapshot (including freshly created `SUMMARY.md`) to be deleted has been replaced with the git-history check already used by `execute-phase.md` since PR #2510; only files with a confirmed deletion event in main's ancestry are now removed.
