---
phase: 02-module-extraction
plan: 05
subsystem: refactoring
tags: [install, claude, hooks, settings, module-extraction]

# Dependency graph
requires:
  - phase: 02-04
    provides: claude.js module boundary (empty) and test import migration for Claude runtime
provides:
  - registerHooks function in claude.js owns hook registration logic (SessionStart, PostToolUse/AfterTool)
  - configureStatusline function in claude.js owns statusline settings mutation
  - install.js delegates hook and statusline setup to claude.js via require
affects: [02-module-extraction, verification, MOD-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [extract-and-delegate refactor — inline logic moved to module, pure mutation functions returned for chaining]

key-files:
  created: []
  modified:
    - bin/lib/claude.js
    - bin/install.js

key-decisions:
  - "console.log statements moved INTO claude.js registerHooks (they are part of the extracted logic, not orchestrator output)"
  - "configureStatusline is a pure data mutation — no console.log inside; log remains in install.js finishInstall"
  - "Removed now-unused postToolEvent variable from install.js after extraction"

patterns-established:
  - "Module functions own their own console output when the output is intrinsic to the operation (hook registration)"
  - "Pure data-mutation helpers (configureStatusline) stay silent; callers decide what to log"

requirements-completed: [MOD-02]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 02 Plan 05: Claude Module Gap Closure Summary

**registerHooks and configureStatusline extracted from install.js into claude.js, giving the Claude module real hook and settings registration responsibility and closing the MOD-02 verification gap**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T12:47:34Z
- **Completed:** 2026-03-04T12:49:14Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Replaced claude.js empty-object stub with two real exported functions: `registerHooks` and `configureStatusline`
- Removed ~45 lines of inline hook registration logic from install.js, replaced with a single `registerHooks(...)` call
- Replaced inline statusline assignment in `finishInstall()` with `configureStatusline(settings, statuslineCommand)` call
- Added `require('./lib/claude.js')` to install.js, wiring the key_link required by MOD-02
- All 705 tests pass unchanged — pure extract-and-delegate refactor with identical behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract hook and settings registration into bin/lib/claude.js** - `801051e` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `bin/lib/claude.js` - Replaced empty module with registerHooks and configureStatusline exports
- `bin/install.js` - Added claude.js require, replaced inline hook/statusline logic with function calls

## Decisions Made
- console.log statements moved INTO claude.js `registerHooks` since they are intrinsic to the hook registration operation, not orchestrator-level output
- `configureStatusline` is a pure data mutation — no logging inside; the `console.log` for statusline stays in `finishInstall()` in install.js
- Removed the now-unused `postToolEvent` variable from install.js after the extraction to avoid dead code

## Deviations from Plan

**1. [Rule 1 - Bug] Removed unused postToolEvent variable from install.js**
- **Found during:** Task 1 (post-extraction cleanup)
- **Issue:** After extracting the hook registration block, `postToolEvent` became an unused variable in install.js
- **Fix:** Removed the variable declaration and associated comment from install.js
- **Files modified:** bin/install.js
- **Verification:** Tests still pass; no references to postToolEvent remain in install.js
- **Committed in:** 801051e (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - dead code removal)
**Impact on plan:** Necessary cleanup for correctness; no scope creep.

## Issues Encountered
None — plan executed cleanly as a pure extract-and-delegate refactor.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MOD-02 gap fully closed: claude.js exports real functions (not empty object), install.js requires claude.js, hook/statusline logic is owned by the Claude module
- Phase 02 module extraction complete — all 5 plans done
- Ready for Phase 03 verification pass

---
*Phase: 02-module-extraction*
*Completed: 2026-03-04*
