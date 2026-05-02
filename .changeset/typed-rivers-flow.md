---
type: Changed
pr: 2974
---
Migrated 8 test files from raw text matching (`stdout.includes(...)`, `assert.match(stderr, ...)`) to typed-IR assertions per CONTRIBUTING.md. Adds shared `ERROR_REASON` enum and `--json-errors` flag in `core.cjs`, typed `GRAPHIFY_REASON` in `graphify.cjs`, pure `buildSdkFailFastReport()` IR builder in `bin/install.js`, and Claude Code JSON envelope output (`hookSpecificOutput` with typed fields) for `gsd-session-state.sh` and `gsd-phase-boundary.sh`. Tests now assert on structured fields (`reason`, `context`, `state_present`, `planning_modified`, etc.) instead of substring matching. See #2974.
