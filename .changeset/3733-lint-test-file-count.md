---
type: Added
pr: 3733
---
<!-- docs-exempt: internal CI lint rule only — adds scripts/, tests/, and a workflow step; no user-facing commands, output, or configuration changed -->
**New CI lint rule `lint-test-file-count` prevents per-feature test-file proliferation** — a recurring pattern where one production module (e.g. `phase.cjs`, `init.cjs`) accumulates 5–20 separate test files over time as PRs add issue-stamped files (`bug-NNNN-*.test.cjs`, `feat-NNNN-*.test.cjs`) next to an existing primary. The rule scans `sdk/src/query/`, `sdk/src/`, `get-shit-done/bin/lib/`, and `bin/` for production modules, then counts matching test files in `tests/` and `sdk/src/**/`. Each module is capped at 2 (primary + one integration). Existing over-limit clusters are frozen in `scripts/lint-test-file-count.allowlist.json` at their current count (30 modules; `phase` is the worst at 20 files). The allowlist ratchets downward automatically — reducing a cluster is always allowed; increasing it requires a PR-description justification. Added `"lint:test-file-count"` npm script and a `Lint — test file count per module` step in the `lint-tests` CI job.
