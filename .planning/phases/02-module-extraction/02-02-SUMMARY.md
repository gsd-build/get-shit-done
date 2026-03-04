---
phase: 02-module-extraction
plan: "02"
subsystem: refactoring
tags: [nodejs, codex, module-extraction, cjs]

requires:
  - phase: 02-module-extraction/02-01
    provides: bin/lib/core.js with shared utilities (GSD_CODEX_MARKER, CODEX_AGENT_SANDBOX, processAttribution, extractFrontmatterAndBody, getDirName, toHomePrefix, verifyInstalled, etc.)

provides:
  - bin/lib/codex.js with all 12 Codex-specific functions and toSingleLine/yamlQuote helpers
  - codex-config.test.cjs imports directly from bin/lib/codex.js (no GSD_TEST_MODE dependency)
  - bin/install.js with Codex functions removed and replaced by require('./lib/codex.js')

affects:
  - 02-module-extraction/02-03
  - 02-module-extraction/02-04

tech-stack:
  added: []
  patterns:
    - "Runtime module pattern: bin/lib/{runtime}.js owns all converter, config, and adapter logic for that runtime"
    - "Pure move refactor: toSingleLine/yamlQuote moved to codex.js since only Codex functions use them"
    - "Test direct import: codex-config.test.cjs imports from bin/lib/codex.js, removing GSD_TEST_MODE dependency"

key-files:
  created:
    - bin/lib/codex.js
  modified:
    - bin/install.js
    - tests/codex-config.test.cjs

key-decisions:
  - "toSingleLine and yamlQuote moved to codex.js — they are only used by Codex functions, so they belong in the Codex module"
  - "Both helpers re-exported from codex.js for backward compat with GSD_TEST_MODE in install.js"
  - "installCodexConfig integration test in codex-config.test.cjs updated to import from codex.js (second require on line 466)"

patterns-established:
  - "Runtime module: bin/lib/{runtime}.js is the single source of truth for all {runtime}-specific logic"
  - "Tests import directly from the module, not via GSD_TEST_MODE — cleaner separation"

requirements-completed: [MOD-05]

duration: 8min
completed: 2026-03-04
---

# Phase 2 Plan 02: Codex Module Extraction Summary

**12 Codex functions extracted from bin/install.js into bin/lib/codex.js, establishing the runtime module pattern for subsequent extractions**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-04T12:15:00Z
- **Completed:** 2026-03-04T12:23:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created bin/lib/codex.js with all 12 Codex-specific functions and local helpers toSingleLine/yamlQuote
- Removed all Codex function definitions from bin/install.js (32 → 18 top-level functions, -14)
- Updated codex-config.test.cjs to import directly from bin/lib/codex.js, eliminating GSD_TEST_MODE dependency
- All 705 passing tests continue to pass; pre-existing config-get failure unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bin/lib/codex.js with Codex functions** - `9049a6d` (feat)
2. **Task 2: Update test imports and verify backward compat** - `4c9f50b` (feat)

## Files Created/Modified
- `bin/lib/codex.js` - New Codex module: 12 functions + toSingleLine + yamlQuote + exports
- `bin/install.js` - Removed 14 function definitions, added require('./lib/codex.js') destructure
- `tests/codex-config.test.cjs` - Updated 2 require calls to import from bin/lib/codex.js; removed GSD_TEST_MODE setup

## Decisions Made
- toSingleLine and yamlQuote are used exclusively by Codex functions, so they moved to codex.js as local helpers and are re-exported for GSD_TEST_MODE backward compat
- The integration test's second require (for installCodexConfig, around line 466) also updated to point to codex.js

## Deviations from Plan

None - plan executed exactly as written. The toSingleLine/yamlQuote move was accounted for in the plan's note about keeping all function names in scope.

## Issues Encountered
None. The pre-existing config-get test failure (config.test.cjs:311) was present before this plan and is unrelated to install.js.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- bin/lib/codex.js module is live and tested — ready to be used as pattern for Plan 02-03 (Gemini extraction) and Plan 02-04 (OpenCode extraction)
- bin/install.js is 14 functions lighter; remaining Gemini and OpenCode functions are still inline
- Pattern established: create bin/lib/{runtime}.js, move functions, update imports, update test file

## Self-Check: PASSED

- bin/lib/codex.js: FOUND
- tests/codex-config.test.cjs: FOUND
- 02-02-SUMMARY.md: FOUND
- Commit 9049a6d (Task 1): FOUND
- Commit 4c9f50b (Task 2): FOUND

---
*Phase: 02-module-extraction*
*Completed: 2026-03-04*
