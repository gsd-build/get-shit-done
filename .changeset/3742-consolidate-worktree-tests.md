---
type: Changed
pr: 3752
---
<!-- docs-exempt: internal test refactor only — no user-facing surface changed -->

Consolidates the Worktree Module test cluster from 13 files to 3, satisfying the lint-test-file-count allowlist ceiling.

- Merged 11 bug-fix CJS test files into `tests/worktree.test.cjs` (branch-check/workspace-safety) and `tests/worktree-cleanup.test.cjs` (HEAD-attachment/cleanup, split along cleanup seam, each ≤ 800 LOC)
- Retained `tests/worktree-safety.test.cjs` with safety policy tests merged in
- No `worktree` entry needed in allowlist (3 files ≤ 4 cluster budget)
- Added Worktree Workstream Seam Module glossary entry to `CONTEXT.md`

Closes #3742
