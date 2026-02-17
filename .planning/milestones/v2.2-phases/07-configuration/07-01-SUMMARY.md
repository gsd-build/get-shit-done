---
phase: 07-configuration
plan: 01
subsystem: config
tags: [co-planners, cli, settings, checkpoint-resolution]

requires:
  - phase: 06-foundation
    provides: "CLI adapters, kill switch, coplanner detect/invoke/enabled commands"
provides:
  - "getAgentsForCheckpoint() resolution function with fallback chain"
  - "coplanner agents <checkpoint> CLI subcommand"
  - "Config template with agents and checkpoints schema"
  - "Settings command co-planner questions with conditional flow"
affects: [08-workflows, co-planner-integration]

tech-stack:
  added: []
  patterns:
    - "Checkpoint-specific -> global -> empty fallback chain for agent resolution"
    - "filterValidAgents warn-and-continue pattern (invalid agents produce warnings, not errors)"
    - "Conditional settings flow (co-planner questions only shown when enabled)"

key-files:
  created: []
  modified:
    - "get-shit-done/bin/gsd-tools.cjs"
    - "get-shit-done/templates/config.json"
    - "commands/gsd/settings.md"

key-decisions:
  - "VALID_CHECKPOINTS constant matches the 4 adversary checkpoints: requirements, roadmap, plan, verification"
  - "Null checkpoint argument triggers global-agents-only path (distinct from invalid checkpoint which returns warning)"
  - "filterValidAgents uses warn-and-continue: invalid names are skipped with warnings, not errors"
  - "Config template uses empty defaults (agents: [], checkpoints: {}) for double opt-in"
  - "Per-checkpoint override questions only shown when user opts in (conditional flow)"

patterns-established:
  - "Fallback chain: checkpoint-specific agents -> global agents -> empty with warning"
  - "Null vs invalid argument distinction in CLI subcommands"

duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 1: Co-Planner Agent Configuration Summary

**Per-checkpoint agent resolution with fallback chain, CLI subcommand, config schema extension, and settings command integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T11:27:17Z
- **Completed:** 2026-02-17T11:30:32Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `getAgentsForCheckpoint()` with checkpoint-specific -> global -> empty fallback chain, kill switch integration, and invalid agent filtering
- Extended config template with `agents` array and `checkpoints` object in co_planners section
- Added 7 co-planner questions to settings command with conditional flow following adversary pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getAgentsForCheckpoint function and coplanner agents subcommand** - `dd1e2ca` (feat)
2. **Task 2: Extend config template with agents and checkpoints schema** - `949e014` (feat)
3. **Task 3: Add co-planner settings to the settings command** - `8fbac79` (feat)

## Files Created/Modified
- `get-shit-done/bin/gsd-tools.cjs` - Added VALID_CHECKPOINTS constant, filterValidAgents helper, getAgentsForCheckpoint resolution function, cmdCoplannerAgents command, and CLI router 'agents' case
- `get-shit-done/templates/config.json` - Extended co_planners with agents array and checkpoints object
- `commands/gsd/settings.md` - Added co-planner toggle, global agent selection, per-checkpoint override questions, merge rules, and confirm display rows

## Decisions Made
- VALID_CHECKPOINTS uses the same 4 checkpoints as adversary (requirements, roadmap, plan, verification) for consistency
- Null checkpoint (no argument) is distinct from invalid checkpoint -- null skips checkpoint lookup and returns global agents; invalid returns warning + empty
- filterValidAgents validates against SUPPORTED_CLIS with warn-and-continue pattern
- Config template defaults to empty arrays/objects (double opt-in: users must enable AND add agents)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Agent resolution function ready for Phase 8 workflow integration
- `coplanner agents <checkpoint>` available for workflows to query which agents to invoke
- Settings command allows users to configure co-planner agents before running workflows

## Self-Check: PASSED

All 3 modified files verified on disk. All 3 task commits (dd1e2ca, 949e014, 8fbac79) verified in git log.

---
*Phase: 07-configuration*
*Completed: 2026-02-17*
