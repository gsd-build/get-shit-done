---
"get-shit-done": patch
---

<!-- docs-exempt: internal test refactor only — no user-facing surface changed -->

refactor(tests): consolidate Worktree Module — 13 files → 2

Reduces the `worktree` lint cluster from 13 test files to 2, satisfying the
`lint-test-file-count` ratchet ceiling introduced in PR #3738.

Closes #3742
