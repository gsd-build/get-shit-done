---
type: Fixed
pr: 3753
---
<!-- docs-exempt: internal test refactor only — no user-facing surface changed -->

## Summary

Consolidates the Milestone Module test cluster from 10 files to 4, bringing the cluster within the lint-test-file-count allowlist ceiling introduced in PR #3738.

- Rewrote `tests/milestone.test.cjs` (869 → 720 LOC) with compact shared helpers, absorbing `milestone-regex-global.test.cjs` and `bug-3043-milestone-complete-scope.test.cjs`
- New `tests/milestone-archive.test.cjs` (505 LOC) absorbs `bug-2684`, `bug-2787`, `bug-3164`, `bug-3600` — milestone archive layout, fenced code block parsing, phase filter, version forwarding
- Expanded `tests/milestone-summary.test.cjs` (471 LOC) to absorb `milestone-audit.test.cjs`
- `sdk/src/milestone-runner.test.ts` unchanged (421 LOC)
- All 99 CJS assertions and 11 SDK assertions preserved (no regression)
- Added Milestone Module glossary entry to `CONTEXT.md`
- Allowlist update deferred to rebase after PR #3738 merges; pre-rebase, `milestone` entry would change from 10 → 4

Closes #3753
