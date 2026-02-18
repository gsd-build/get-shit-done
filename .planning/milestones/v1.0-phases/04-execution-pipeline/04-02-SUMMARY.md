---
phase: 04-execution-pipeline
plan: 02
subsystem: execution
tags: [slash-command, orchestration, waves, parallel-agents, verification, meta-prompt]

# Dependency graph
requires:
  - phase: 04-execution-pipeline
    plan: 01
    provides: "compute-waves, generate-exec-plan, verify-wave CJS subcommands"
  - phase: 03-traceability-navigation
    provides: "buildDagFromDisk, traceUpward, visualize"
provides:
  - "execute.js: milestone execution data provider (actions, waves, trace context, folder path)"
  - "/declare:execute: full orchestration slash command with wave scheduling, parallel agents, verification"
  - "All Phase 4 CJS subcommands bundled and wired end-to-end"
affects: [phase-05-integrity, phase-06-alignment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Execute command as data provider: returns everything orchestrator needs in one call"
    - "Milestone picker mode: no --milestone flag returns selectable list"
    - "Slash command orchestration: CJS provides data, meta-prompt drives agent workflow"
    - "Two-layer verification: automated CJS checks + AI semantic review per wave"

key-files:
  created:
    - src/commands/execute.js
    - .claude/commands/declare/execute.md
  modified:
    - src/declare-tools.js
    - dist/declare-tools.cjs

key-decisions:
  - "execute.js returns milestone picker when called without --milestone (interactive mode support)"
  - "Slash command uses Task tool for parallel agent spawning within waves"
  - "On-demand exec plan generation per wave (not upfront for all actions)"
  - "Max 2 retries on verification failure before escalating to user"
  - "Action status updates in PLAN.md after each wave, milestone DONE update after all waves"

patterns-established:
  - "Data provider + slash command orchestrator: CJS returns JSON, meta-prompt drives multi-step flow"
  - "Interactive fallback: commands without required flags return picker data instead of errors"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03, EXEC-04]

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 4 Plan 2: Execution Pipeline Wiring and Slash Command Summary

**Full /declare:execute orchestration: wave-scheduled parallel agent spawning with two-layer verification and milestone auto-completion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T23:25:13Z
- **Completed:** 2026-02-16T23:28:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- execute.js data provider returns comprehensive milestone execution data (actions, waves, declarations, folder path) with interactive picker fallback
- /declare:execute slash command orchestrates the full pipeline: milestone selection, wave computation, on-demand plan generation, parallel Task agent spawning, per-wave verification with retries, and milestone DONE auto-update
- All four Phase 4 CJS subcommands (compute-waves, generate-exec-plan, verify-wave, execute) wired end-to-end in declare-tools.js and bundle
- Slash command installed to both project-level and user-level ~/.claude/commands/declare/

## Task Commits

Each task was committed atomically:

1. **Task 1: Create execute command and wire all subcommands** - `665f000` (feat)
2. **Task 2: Create /declare:execute slash command** - `6976b59` (feat)
3. **Task 3: Install and verify end-to-end wiring** - No commit (verification-only task, no file changes)

## Files Created/Modified
- `src/commands/execute.js` - Milestone execution data provider with picker mode (runExecute)
- `.claude/commands/declare/execute.md` - Full orchestration meta-prompt (198 lines)
- `src/declare-tools.js` - Added execute subcommand dispatch, updated command lists
- `dist/declare-tools.cjs` - Rebuilt bundle with all Phase 4 commands

## Decisions Made
- execute.js returns milestone picker data (not an error) when called without --milestone flag, enabling interactive mode in the slash command
- Exec plans generated on-demand per wave rather than upfront for all actions (per research recommendation, reduces wasted work if early waves fail)
- Slash command uses Task tool for parallel agent spawning, matching GSD executor patterns
- Two-layer verification: CJS automated checks (artifact existence, DAG consistency) then AI semantic review (does work advance the milestone's declarations?)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete execution pipeline operational for any Declare project with milestones and actions
- Ready for Phase 5 (Integrity) which can leverage the execution and verification infrastructure
- The verify-wave + AI review pattern establishes the foundation for integrity checks

## Self-Check: PASSED

- All created files exist on disk
- Both task commits (665f000, 6976b59) verified in git log
- All four CJS subcommands respond correctly (no "Unknown command")
- Slash command installed at project and user level

---
*Phase: 04-execution-pipeline*
*Completed: 2026-02-16*
