---
phase: 11-async-error-classification-fix
plan: 01
subsystem: adapters
tags: [classifyError, error-handling, async, exec, child_process, tdd]

requires:
  - phase: 06-co-planner-adapters
    provides: "CLI adapter infrastructure with classifyError, invoke, invokeAsync"
provides:
  - "Fixed classifyError handling both sync (err.status) and async (err.code) exit codes"
  - "classifyError exported from all 3 adapters for direct testing"
  - "27 unit tests covering all error shape classifications"
affects: [co-planner-invocation, adapter-testing]

tech-stack:
  added: []
  patterns:
    - "Dual exit code extraction: err.status || (typeof err.code === 'number' ? err.code : undefined)"

key-files:
  created: []
  modified:
    - get-shit-done/bin/adapters/codex.cjs
    - get-shit-done/bin/adapters/gemini.cjs
    - get-shit-done/bin/adapters/opencode.cjs
    - get-shit-done/bin/gsd-tools.test.cjs

key-decisions:
  - "Unified exitCode extraction via typeof guard: distinguishes numeric err.code (exit code) from string err.code (ENOENT)"

patterns-established:
  - "classifyError exported for unit testing: all 3 adapters expose classifyError in module.exports"

duration: 2min
completed: 2026-02-17
---

# Phase 11 Plan 01: Async Error Classification Fix Summary

**Fixed classifyError to handle async error shapes (numeric err.code) via typeof guard, with 27 TDD unit tests across all 3 CLI adapters**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T20:38:17Z
- **Completed:** 2026-02-17T20:40:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed classifyError in codex, gemini, and opencode adapters to correctly classify exit codes 127 (NOT_FOUND) and 126 (PERMISSION) from the async invocation path
- Added 27 unit tests (9 per adapter) covering all error shape classifications: sync, async, SIGTERM, ENOENT, and arbitrary exit codes
- Exported classifyError from all 3 adapters for direct testability

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- Export classifyError + add failing tests** - `49e04f7` (test)
2. **Task 2: GREEN -- Fix classifyError function body** - `930ded3` (fix)

## Files Created/Modified
- `get-shit-done/bin/adapters/codex.cjs` - Fixed classifyError + exported for testing
- `get-shit-done/bin/adapters/gemini.cjs` - Fixed classifyError + exported for testing
- `get-shit-done/bin/adapters/opencode.cjs` - Fixed classifyError + exported for testing
- `get-shit-done/bin/gsd-tools.test.cjs` - Added 27 classifyError unit tests (9 per adapter)

## Decisions Made
- Unified exitCode extraction using `err.status || (typeof err.code === 'number' ? err.code : undefined)` -- the typeof guard correctly distinguishes numeric exit codes from string codes like 'ENOENT', while preserving the ENOENT string check as a separate fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All adapter error classification is now correct for both sync and async paths
- 109 total tests pass with 0 failures
- No blockers or concerns

---
*Phase: 11-async-error-classification-fix*
*Completed: 2026-02-17*
