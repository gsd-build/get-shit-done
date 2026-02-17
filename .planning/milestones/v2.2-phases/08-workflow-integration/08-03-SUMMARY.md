---
phase: 08-workflow-integration
plan: 03
subsystem: workflows
tags: [co-planner, synthesis, acceptance-criteria, flag-assignment, commit-scope]

# Dependency graph
requires:
  - phase: 08-02
    provides: Co-planner review sections in plan-phase.md and execute-phase.md
provides:
  - Fully functional co-planner synthesis with flag assignment, dynamic commit scope, acceptance criteria, and all-agents-failed handler in both workflow commands
affects: [plan-phase, execute-phase, co-planner-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Accept-if/Reject-if/Note-if criteria pattern for co-planner synthesis"
    - "Flag assignment before conditional check pattern"
    - "Dynamic commit scope using template variables"

key-files:
  created: []
  modified:
    - commands/gsd/plan-phase.md
    - commands/gsd/execute-phase.md

key-decisions:
  - "plan-phase.md uses ${PHASE} for dynamic commit scope (matches existing variable from step 2 normalization)"
  - "execute-phase.md uses {phase} for dynamic commit scope (matches existing template variable pattern)"
  - "Acceptance criteria are domain-specific: plan-phase checks for logical gaps/dependency conflicts/task ordering; execute-phase checks for missed verification cases/false positives/evidence gaps"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 8 Plan 3: Gap Closure Summary

**Closed 4 verification gaps in plan-phase.md and execute-phase.md co-planner sections -- flag assignment, dynamic commit scope, acceptance criteria, and all-agents-failed handler**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T16:16:49Z
- **Completed:** 2026-02-17T16:18:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed dead conditional commits by adding flag assignment (`CO_PLANNER_REVISED_PLANS=true` and `CO_PLANNER_REVISED_VERIFICATION=true`) before the conditional check in both files
- Replaced hardcoded `docs(08):` commit scope with dynamic template variables (`${PHASE}` in plan-phase.md, `{phase}` in execute-phase.md)
- Added explicit Accept-if/Reject-if/Note-if acceptance criteria with domain-appropriate thresholds for each workflow
- Added all-agents-failed handler in both files (skip to adversary review step)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix co-planner review section in plan-phase.md** - `d2bd97d` (fix)
2. **Task 2: Fix co-planner review section in execute-phase.md** - `b86803c` (fix)

## Files Created/Modified
- `commands/gsd/plan-phase.md` - Step 12.3 co-planner review: added all-agents-failed handler, acceptance criteria, flag assignment, dynamic commit scope
- `commands/gsd/execute-phase.md` - Step 7.3 co-planner review: added all-agents-failed handler, acceptance criteria, flag assignment, dynamic commit scope

## Decisions Made
- Used `${PHASE}` in plan-phase.md (matches existing bash variable from step 2 normalization)
- Used `{phase}` in execute-phase.md (matches existing template variable pattern used elsewhere in the file)
- Domain-specific acceptance criteria: plan-phase checks for logical gaps, dependency conflicts, task ordering, missing verification steps, feasibility concerns, and wiring gaps; execute-phase checks for missed verification cases, factually incorrect status, must-have/evidence gaps, false-positive verifications, and unsupported conclusions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 gaps from VERIFICATION.md are now closed in both files
- plan-phase.md and execute-phase.md co-planner sections match the quality standard set by new-project.md
- Phase 8 gap closure complete, ready for final verification or Phase 9

## Self-Check: PASSED

- [x] commands/gsd/plan-phase.md exists
- [x] commands/gsd/execute-phase.md exists
- [x] 08-03-SUMMARY.md exists
- [x] Commit d2bd97d exists (Task 1)
- [x] Commit b86803c exists (Task 2)

---
*Phase: 08-workflow-integration*
*Completed: 2026-02-17*
