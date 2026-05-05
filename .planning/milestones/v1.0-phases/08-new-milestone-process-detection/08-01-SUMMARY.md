---
phase: 08-new-milestone-process-detection
plan: "01"
subsystem: workflows
tags: [sme, new-milestone, process-detection, workflow, tdd, structural-tests]

# Dependency graph
requires:
  - phase: 07-discuss-phase-integration
    provides: discuss-phase/sme-step.md structural pattern and CJS test analog
provides:
  - Lazy-loaded sme-step.md for new-milestone workflow (process detection + queuing)
  - Dispatch reference in new-milestone.md at step 5.5
  - Structural tests for DETECT-01 through DETECT-05
affects: [discuss-phase, plan-phase-gate, post-execution-refresh]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy-load dispatch reference pattern: step N.5 in workflow with conditional Read"
    - "SME detection+queuing: sme.list + sme.detect-processes + AskUserQuestion + frontmatter.merge"
    - "CJS structural test: node:test describe/test with file-read assertions and ordering constraint"
    - "Negative test pattern: assert forbidden strings do NOT appear in implementation file"

key-files:
  created:
    - tests/sme-new-milestone-detect.test.cjs
    - get-shit-done/workflows/new-milestone/sme-step.md
  modified:
    - get-shit-done/workflows/new-milestone.md

key-decisions:
  - "sme-step.md warning comment reworded to avoid forbidden strings state.update/state.patch — negative test assertions require literal absence of these strings from file content"
  - "Step 5.5 insertion point: after state.milestone-switch completes (prevents active_smes erasure on milestone switch), before step 6 cleanup/commit"
  - "Process name validation (T-08-01): [a-zA-Z0-9_-]+ regex guard before gsd-sme-creator spawn"

patterns-established:
  - "Negative assertion test: test that forbidden SDK call strings are literally absent from implementation files, not just from code blocks"
  - "Detection+queuing step pattern: config guard -> list -> detect -> confirm -> create -> write via frontmatter.merge"

requirements-completed:
  - DETECT-01
  - DETECT-02
  - DETECT-03
  - DETECT-04
  - DETECT-05

# Metrics
duration: 3min
completed: 2026-05-01
---

# Phase 08 Plan 01: SME New-Milestone Process Detection Summary

**Lazy-loaded sme-step.md for new-milestone workflow with config-gated process detection, AskUserQuestion confirmation, gsd-sme-creator offering, and frontmatter.merge write to active_smes in STATE.md**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-01T03:14:29Z
- **Completed:** 2026-05-01T03:17:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `tests/sme-new-milestone-detect.test.cjs` with 10 structural tests covering DETECT-01 through DETECT-05 plus ordering constraint (RED gate)
- Created `get-shit-done/workflows/new-milestone/sme-step.md` implementing 7-step detection+queuing workflow: config guard, sme.list, sme.detect-processes, AskUserQuestion confirmation, gsd-sme-creator offer, frontmatter.merge write (GREEN gate)
- Inserted step 5.5 dispatch reference in `new-milestone.md` after state.milestone-switch, ensuring active_smes are never erased on milestone switch
- All 10 structural tests pass; no regression in Phase 6 (16 tests), Phase 7 (12 tests), or workflow-size-budget (104 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - Write structural tests for SME new-milestone detection** - `558ead43` (test)
2. **Task 2: GREEN - Implement sme-step.md and add new-milestone.md dispatch** - `73ad61cb` (feat)

_TDD plan: RED commit precedes GREEN commit in git log._

## Files Created/Modified

- `tests/sme-new-milestone-detect.test.cjs` - 10 structural tests for DETECT-01 through DETECT-05 and ordering constraint
- `get-shit-done/workflows/new-milestone/sme-step.md` - 7-step lazy-loaded SME detection+queuing workflow
- `get-shit-done/workflows/new-milestone.md` - Added step 5.5 dispatch reference (4 lines inserted after step 5)

## Decisions Made

- Warning comment in sme-step.md step 6 reworded from "NEVER use `state.update` or `state.patch`" to "Use ONLY `frontmatter.merge`" — the negative test assertion (`!content.includes('state.update')`) fails if the literal string appears anywhere in the file, including in documentation comments.
- Step 5.5 inserted after Bug #2630 note (line 202 of new-milestone.md), before `## 6. Cleanup and Commit` — maintains ordering constraint that sme-step runs after state.milestone-switch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed forbidden strings from sme-step.md warning comment**

- **Found during:** Task 2 (GREEN implementation, test verification)
- **Issue:** The warning comment "NEVER use `state.update` or `state.patch`" contained the literal strings that the DETECT-05 negative assertion tests for. Test `sme-step.md uses frontmatter.merge to write active_smes (NOT state.update/state.patch)` failed because `content.includes('state.update')` matched the comment text.
- **Fix:** Reworded to "Use ONLY `frontmatter.merge` -- the SDK state mutation handlers go through `buildStateFrontmatter`..." — conveys same intent without the literal forbidden strings.
- **Files modified:** `get-shit-done/workflows/new-milestone/sme-step.md`
- **Verification:** 10/10 tests pass after fix
- **Committed in:** `73ad61cb` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in implementation)
**Impact on plan:** Fix required for test compliance. No scope change. Same semantic intent preserved in reworded comment.

## Issues Encountered

None beyond the auto-fixed deviation above.

## TDD Gate Compliance

- RED gate: `558ead43` -- `test(08-01): add failing structural tests for SME new-milestone detection (RED)` (all 10 tests fail)
- GREEN gate: `73ad61cb` -- `feat(08-01): implement SME new-milestone detection step (GREEN)` (all 10 tests pass)
- RED commit precedes GREEN commit in git log: CONFIRMED

## Next Phase Readiness

- SME detection at milestone start is complete; downstream phases (discuss-phase, plan-phase gate) can rely on `milestone.active_smes` being populated in STATE.md
- No blockers; all verification suites green

## Self-Check

Files exist:
- `tests/sme-new-milestone-detect.test.cjs`: FOUND
- `get-shit-done/workflows/new-milestone/sme-step.md`: FOUND
- `get-shit-done/workflows/new-milestone.md` (modified): FOUND

Commits exist:
- `558ead43` (RED test commit): FOUND
- `73ad61cb` (GREEN feat commit): FOUND

## Self-Check: PASSED

---
*Phase: 08-new-milestone-process-detection*
*Completed: 2026-05-01*
