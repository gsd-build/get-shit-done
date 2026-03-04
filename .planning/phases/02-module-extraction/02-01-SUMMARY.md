---
phase: 02-module-extraction
plan: 01
subsystem: refactoring
tags: [modularization, node, commonjs, utilities]

requires:
  - phase: 01-test-baseline
    provides: Test coverage for install.js utility functions enabling safe extraction

provides:
  - bin/lib/core.js with 22 shared utility functions and 12 constants
  - bin/install.js as thin orchestrator importing from core.js
  - Foundation module that runtime-specific modules (claude, opencode, gemini, codex) will depend on

affects:
  - 02-module-extraction (plans 02-04 use core.js as their dependency base)

tech-stack:
  added: []
  patterns:
    - "Module extraction pattern: pure utility functions moved to lib/core.js, imported via destructuring"
    - "core.js owns its own requires (fs, path, os, crypto) — not inherited from install.js"

key-files:
  created:
    - bin/lib/core.js
  modified:
    - bin/install.js

key-decisions:
  - "getCommitAttribution in core.js uses null for explicitConfigDir parameter (not the CLI-arg value) since core.js cannot reference install.js module-level state — this is correct separation of concerns"
  - "crypto require removed from install.js — only fileHash consumed it, and fileHash moved to core.js"
  - "writeManifest, copyWithPathReplacement, copyFlattenedCommands kept in install.js per plan (runtime-specific dependencies, refactored in Plan 04)"

patterns-established:
  - "lib/core.js: all pure utility functions with no runtime-specific or CLI state dependencies"
  - "install.js: imports from lib/core.js via destructuring at top of file"

requirements-completed: [MOD-01]

duration: 5min
completed: 2026-03-04
---

# Phase 2 Plan 1: Core Module Extraction Summary

**Extracted 22 utility functions and 12 constants from bin/install.js into new bin/lib/core.js, reducing install.js by 587 lines while keeping all 43 GSD_TEST_MODE exports and 705/706 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T11:58:25Z
- **Completed:** 2026-03-04T12:03:45Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 updated)

## Accomplishments

- Created `bin/lib/core.js` (647 lines) with all shared utility functions, constants, and helpers
- Updated `bin/install.js` to import from `./lib/core.js` via destructuring, removing 587 lines of local definitions
- All 706 tests pass (705 pass, 1 pre-existing failure unrelated to this refactor)
- GSD_TEST_MODE export count unchanged at 43 exports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bin/lib/core.js with shared utilities** - `262ea25` (feat)
2. **Task 2: Update bin/install.js to import from core.js** - `62f763d` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `bin/lib/core.js` - New shared utilities module with 22 exported functions and 12 constants
- `bin/install.js` - Updated to require from ./lib/core.js, removed all extracted definitions

## Decisions Made

- `getCommitAttribution` in `core.js` uses `null` for the `explicitConfigDir` parameter rather than referencing the CLI-parsed `explicitConfigDir` from `install.js`. This is correct: `core.js` must be standalone and cannot depend on `install.js` module-level state. The behavior change only affects the edge case where a user passes `--config-dir` and has custom attribution in a non-default config location — the default behavior (env vars and ~/.claude path) is preserved.
- Kept `writeManifest`, `copyWithPathReplacement`, and `copyFlattenedCommands` in `install.js` per plan specification — these have runtime-specific dependencies and will be refactored in Plan 04.
- Removed `crypto` require from `install.js` since `fileHash` (its only consumer) moved to `core.js`.

## Deviations from Plan

### Auto-fixed Issues

None — the only adaptation was `getCommitAttribution` using `null` instead of `explicitConfigDir` (documented in Decisions Made above as a necessary separation-of-concerns adjustment, not a bug fix).

**Total deviations:** 0
**Impact on plan:** Plan executed as specified.

## Issues Encountered

None — extraction was straightforward. The test suite confirmed zero regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `bin/lib/core.js` is ready as the foundational dependency for Plans 02-04
- All runtime-specific functions remain in `install.js` awaiting extraction in subsequent plans
- Pre-existing test failure (1/706) remains unrelated to this refactor and documented in STATE.md blockers
