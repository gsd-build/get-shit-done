---
phase: 03-instructions-lifecycle
plan: 02
subsystem: testing
tags: [copilot, tests, instructions, merge, strip, uninstall, manifest, patches]

# Dependency graph
requires:
  - phase: 03-instructions-lifecycle
    plan: 01
    provides: mergeCopilotInstructions, stripGsdFromCopilotInstructions, uninstall fixes, manifest/patches fixes
provides:
  - 16 new tests covering all Phase 3 functions and fixes
  - Regression safety for instructions merge/strip, uninstall, manifest hashing, patch reporting
affects: [04-validation phase]

# Tech tracking
tech-stack:
  added: []
  patterns: [temp dir lifecycle with beforeEach/afterEach, console.log capture for output testing]

key-files:
  created: []
  modified:
    - tests/copilot-install.test.cjs
    - bin/install.js

key-decisions:
  - "Added writeManifest and reportLocalPatches to GSD_TEST_MODE exports for direct testing"
  - "Used gsd-* directory filter pattern test to verify uninstall skill identification logic"

patterns-established:
  - "Console capture pattern: replace console.log in try/finally for output assertions"
  - "Manifest integration test: create minimal dir structure, call writeManifest, verify JSON output"

requirements-completed: [INST-01, INST-02, LIFE-01, LIFE-02, LIFE-03]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 3 Plan 2: Instructions Lifecycle Tests Summary

**16 new tests for merge/strip functions, uninstall skill cleanup, manifest Copilot hashing, and patch command format with 543 total tests passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T13:39:23Z
- **Completed:** 2026-03-03T13:42:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 10 unit tests for mergeCopilotInstructions (5 cases: create, replace, append, GSD-only, preserve surrounding) and stripGsdFromCopilotInstructions (5 cases: null-return, before-only, after-only, both, no-markers)
- 3 integration tests for Copilot uninstall skill removal pattern, instructions cleanup, and GSD-only deletion signal
- 3 integration tests for writeManifest Copilot skill hashing, reportLocalPatches Copilot dash format, and Claude colon format regression check
- Full test suite: 543 tests pass, 0 failures (was 527, now +16 new)
- Test file at 975 lines (exceeds 800 minimum)

## Task Commits

Each task was committed atomically:

1. **Task 1: Unit tests for mergeCopilotInstructions and stripGsdFromCopilotInstructions** - `487e35e` (test)
2. **Task 2: Integration tests for uninstall, manifest, and reportLocalPatches** - `97128c3` (test)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `tests/copilot-install.test.cjs` - Added 16 new tests across 3 describe blocks (merge/strip, uninstall, manifest/patches)
- `bin/install.js` - Added writeManifest and reportLocalPatches to GSD_TEST_MODE exports; added beforeEach/afterEach to test imports

## Decisions Made
- Added `writeManifest` and `reportLocalPatches` to GSD_TEST_MODE exports in bin/install.js — these were not exported but needed for direct integration testing
- Used directory filter pattern (read + filter gsd-*) to test uninstall skill identification logic without calling the full uninstall() function which requires CLI context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added beforeEach/afterEach to node:test require**
- **Found during:** Task 1 (merge tests with temp dir lifecycle)
- **Issue:** Existing test file only imported `test` and `describe` from `node:test` — `beforeEach` and `afterEach` were not imported, causing ReferenceError
- **Fix:** Updated require to `const { test, describe, beforeEach, afterEach } = require('node:test')`
- **Files modified:** tests/copilot-install.test.cjs
- **Verification:** All 75 tests passed after fix
- **Committed in:** 487e35e (Task 1 commit)

**2. [Rule 3 - Blocking] Added writeManifest and reportLocalPatches to GSD_TEST_MODE exports**
- **Found during:** Task 2 setup (needed for integration tests)
- **Issue:** writeManifest and reportLocalPatches were not in the GSD_TEST_MODE exports block, making them unavailable for testing
- **Fix:** Added both functions to the module.exports block in the GSD_TEST_MODE conditional
- **Files modified:** bin/install.js
- **Verification:** Functions accessible from test file, integration tests pass
- **Committed in:** 487e35e (Task 1 commit, done preemptively)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required to make tests runnable. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 3 functions have automated test coverage
- INST-01, INST-02, LIFE-01, LIFE-02, LIFE-03 requirements verified with regression tests
- Ready for Phase 4: Validation

---
*Phase: 03-instructions-lifecycle*
*Completed: 2026-03-03*

## Self-Check: PASSED
