---
type: Changed
pr: 3738
---
<!-- docs-exempt: internal test refactor only — no user-facing surface changed -->

Consolidates the Worktree Module test cluster from 13 files to 2, satisfying the lint-test-file-count allowlist ceiling.

- Merged 11 bug-fix CJS test files into `tests/worktree.test.cjs`
- Retained `tests/worktree-safety.test.cjs` with safety policy tests merged in
- No `worktree` entry needed in allowlist (2 files ≤ 2 threshold)
- Added Worktree Workstream Seam Module glossary entry to `CONTEXT.md`

Closes #3742
