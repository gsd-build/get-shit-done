---
phase: 01-scheduler-and-isolation-model
plan: 01
subsystem: scheduler
tags: [dag, topological-sort, kahn-algorithm, dependency-graph, parser]

# Dependency graph
requires: []
provides:
  - "parseDependsOn() pure function converting dependsOn strings to phase number arrays"
  - "DependencyScheduler class with DAG scheduling, cycle detection, ready/complete tracking"
  - "SchedulerPhase interface and CycleError class"
affects: [01-02, 02-execution-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [hand-rolled-kahns-algorithm, pure-function-parser, lenient-missing-deps]

key-files:
  created:
    - autopilot/src/scheduler/parse-depends-on.ts
    - autopilot/src/scheduler/index.ts
    - autopilot/src/scheduler/__tests__/parse-depends-on.test.ts
    - autopilot/src/scheduler/__tests__/scheduler.test.ts
  modified: []

key-decisions:
  - "Hand-rolled Kahn's algorithm (~100 lines) instead of dependency-graph npm package -- no new dependencies needed"
  - "Missing dependency references warned via console.warn but treated as satisfied (lenient behavior per CONTEXT.md)"
  - "CycleError thrown at constructor time with participant phase numbers for fast failure"

patterns-established:
  - "Scheduler module in autopilot/src/scheduler/ as standalone directory"
  - "SchedulerPhase interface as scheduler's own type (not importing RoadmapPhase from orchestrator)"
  - "parseFloat() for phase numbers to support decimal inserted phases (e.g., 2.1)"

requirements-completed: [SCHED-02, SCHED-05, SCHED-06]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 1 Plan 01: DAG Dependency Scheduler Summary

**Hand-rolled Kahn's algorithm scheduler with dependsOn string parser, cycle detection, and ready/complete phase tracking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T04:50:09Z
- **Completed:** 2026-03-12T04:52:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- parseDependsOn() handles all known ROADMAP.md dependsOn format variations (null, empty, "Nothing", "Phase N", comma/and-separated, decimal phases, deduplication)
- DependencyScheduler provides correct topological scheduling from dependency DAG with getReady(), markInProgress(), markComplete(), isComplete()
- Cycle detection via Kahn's algorithm at constructor time with descriptive CycleError
- 25 tests covering all behavior cases, full test suite (793 tests) passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: parseDependsOn string parser with tests** - `b72514e` (feat)
2. **Task 2: DependencyScheduler class with tests** - `b767efe` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `autopilot/src/scheduler/parse-depends-on.ts` - Pure function parsing dependsOn strings into phase number arrays
- `autopilot/src/scheduler/index.ts` - DependencyScheduler class with DAG scheduling, cycle detection, ready/complete tracking
- `autopilot/src/scheduler/__tests__/parse-depends-on.test.ts` - 12 test cases for all string format variations
- `autopilot/src/scheduler/__tests__/scheduler.test.ts` - 13 test cases for DAG scheduling, cycles, missing deps, completion

## Decisions Made
- Hand-rolled Kahn's algorithm instead of dependency-graph npm: avoids adding a dependency with no TypeScript types for ~100 lines of straightforward code
- Missing dependency references (e.g., Phase 99 not in scheduler) are warned but treated as satisfied -- lenient per CONTEXT.md locked decision
- CycleError includes participants array identifying which phases form the cycle
- Scheduler defines its own SchedulerPhase interface rather than importing RoadmapPhase -- bridge code belongs in Phase 2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DependencyScheduler and parseDependsOn ready for consumption by Plan 01-02 (state isolation / event files) and Phase 2 (execution engine)
- Bridge code mapping RoadmapPhase[] to SchedulerPhase[] is Phase 2 scope as specified

---
*Phase: 01-scheduler-and-isolation-model*
*Completed: 2026-03-12*
