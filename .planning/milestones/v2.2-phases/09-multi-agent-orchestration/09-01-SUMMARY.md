---
phase: 09-multi-agent-orchestration
plan: 01
subsystem: infra
tags: [child_process, async, parallel, promise, adapters, cli]

# Dependency graph
requires:
  - phase: 06-co-planner-infra
    provides: "CLI adapters (codex, gemini, opencode) with sync invoke/detect"
  - phase: 07-config-resolution
    provides: "getAgentsForCheckpoint, filterValidAgents, checkKillSwitch helpers"
provides:
  - "invokeAsync() on all three CLI adapters for true parallel invocation"
  - "coplanner invoke-all command for batch parallel agent invocation"
affects: [09-multi-agent-orchestration, workflows, execute-phase, plan-phase]

# Tech tracking
tech-stack:
  added: []
  patterns: ["async exec with callback-based child_process.exec for true parallelism", "Promise.allSettled for partial failure tolerance", "collision-safe temp filenames with CLI name + random suffix"]

key-files:
  created: []
  modified:
    - "get-shit-done/bin/adapters/codex.cjs"
    - "get-shit-done/bin/adapters/gemini.cjs"
    - "get-shit-done/bin/adapters/opencode.cjs"
    - "get-shit-done/bin/gsd-tools.cjs"

key-decisions:
  - "Used child_process.exec (callback-based async) not execSync-in-Promise -- true parallelism requires non-blocking I/O"
  - "invokeAsync always resolves (never rejects) -- consistent with sync invoke error schema"
  - "Temp file includes CLI_NAME + Date.now() + random suffix to prevent collisions during parallel execution"
  - "invoke-all reads prompt from --prompt-file to avoid shell quoting issues with large artifacts"

patterns-established:
  - "Async adapter pattern: invokeAsync() returns Promise with same schema as sync invoke()"
  - "Parallel invocation pattern: Promise.allSettled with per-agent error mapping"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 9 Plan 1: Async Parallel Invocation Infrastructure Summary

**invokeAsync() on all CLI adapters plus coplanner invoke-all command for true parallel multi-agent invocation via Promise.allSettled**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T17:11:07Z
- **Completed:** 2026-02-17T17:13:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `invokeAsync()` to codex, gemini, and opencode adapters using `child_process.exec` for true parallelism (not execSync wrapped in Promise)
- Added `coplanner invoke-all` command that invokes all resolved agents in parallel via `Promise.allSettled()`
- Per-agent timeout isolation, collision-safe temp filenames, and partial failure tolerance built in
- Zero new npm dependencies -- Node.js stdlib only

## Task Commits

Each task was committed atomically:

1. **Task 1: Add invokeAsync() to all three CLI adapters** - `4ca998a` (feat)
2. **Task 2: Add coplanner invoke-all command to gsd-tools.cjs** - `8c94efb` (feat)

## Files Created/Modified
- `get-shit-done/bin/adapters/codex.cjs` - Added invokeAsync() with async exec, collision-safe temp files
- `get-shit-done/bin/adapters/gemini.cjs` - Added invokeAsync() with sanitized env and JSON response parsing
- `get-shit-done/bin/adapters/opencode.cjs` - Added invokeAsync() with extractOpenCodeResponse parsing
- `get-shit-done/bin/gsd-tools.cjs` - Added cmdCoplannerInvokeAll function and invoke-all case in coplanner switch

## Decisions Made
- Used `child_process.exec` (callback-based async) instead of wrapping execSync in a Promise -- true parallelism requires non-blocking I/O
- invokeAsync() always resolves (never rejects) to maintain consistent error schema with sync invoke()
- Temp file names include CLI_NAME + Date.now() + random suffix to prevent collisions during parallel execution
- invoke-all reads prompt from `--prompt-file` path to avoid shell quoting issues with large artifact content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Async parallel invocation infrastructure complete
- Ready for remaining 09 plans to build orchestration workflows on top of invoke-all
- All existing sync APIs unchanged -- backward compatible

---
*Phase: 09-multi-agent-orchestration*
*Completed: 2026-02-17*
