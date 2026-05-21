---
type: Fixed
pr: 3762
---
<!-- docs-exempt: internal test refactor — no user-facing behavior changed -->

**Consolidate graphify Module tests — 7 files → 1 (#3761)** — collapses the test-as-changelog anti-pattern where each PR (`enh-3170`, `bug-3166`, `feat-3347-config`, `feat-3347-hook`, `bug-3579`) added a new standalone file instead of appending to the existing `graphify.test.cjs`. All 131 tests (plus one new counter-test for mvp-viz non-mvp path) are now in a single file organized into describe blocks by surface: `status`, `build`, `query`, `staleness`, `mvp-viz`, `auto-update`, `regressions`. Issue-stamped tests carry `// Regression for #NNNN` comments. Adds Knowledge Graph Module glossary entry to `CONTEXT.md`.
