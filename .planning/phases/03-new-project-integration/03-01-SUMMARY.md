---
phase: 03-new-project-integration
plan: 01
subsystem: commands
tags: [adversary, debate-loop, new-project, config-reading, orchestration]

# Dependency graph
requires:
  - phase: 01-core-agent
    provides: gsd-adversary agent definition with input/output format
  - phase: 02-configuration
    provides: adversary config schema and node-e reading block
provides:
  - Adversary debate loop at requirements checkpoint in new-project
  - Adversary debate loop at roadmap checkpoint in new-project
  - Model table entry for gsd-adversary (sonnet/sonnet/haiku)
  - Reusable debate loop pattern for Phase 4 and Phase 5
affects: [04-plan-phase-integration, 05-verify-work-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debate loop pattern: config read -> banner -> multi-round adversary spawn -> defense -> summary"
    - "Asymmetric commit handling: requirements gets separate revision commit, roadmap revisions folded into existing flow"
    - "CONV-01 hard cap enforcement via bash arithmetic: $((MAX_ROUNDS > 3 ? 3 : MAX_ROUNDS))"

key-files:
  created: []
  modified:
    - commands/gsd/new-project.md

key-decisions:
  - "Requirements commit moved before user approval to enable adversary review between commit and presentation"
  - "Roadmap adversary runs before commit so revisions fold into existing commit flow"
  - "No separate defender agent - orchestrator generates defense inline"

patterns-established:
  - "Debate loop: read config -> skip if disabled -> banner -> loop(read artifact, spawn adversary, parse, defend, iterate) -> summary -> conditional commit"
  - "Adversary spawn prompt template with XML tags: artifact_type, artifact_content, round, max_rounds, project_context, defense, previous_challenges"
  - "Summary display: checkmark for addressed, circle for noted, warning for unresolved"

# Metrics
duration: 7min
completed: 2026-02-13
---

# Phase 3 Plan 01: New-Project Integration Summary

**Adversary debate loop at requirements and roadmap checkpoints in /gsd:new-project with CONV-01 hard cap, config-driven skip logic, and severity-appropriate defense**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-13T11:37:05Z
- **Completed:** 2026-02-13T11:44:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Integrated adversary review at requirements checkpoint (Phase 7.5) with full debate loop
- Integrated adversary review at roadmap checkpoint (Phase 8.5) with full debate loop
- Added planning-config.md to execution_context for config reading reference
- Added gsd-adversary to model lookup table (sonnet/sonnet/haiku profile)
- Updated Phase 10 completion banner with conditional adversary checkpoint list
- Both checkpoints enforce CONV-01 hard cap of 3 rounds maximum
- Clean artifact guarantee: REQUIREMENTS.md and ROADMAP.md contain no adversary metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Add adversary infrastructure and requirements checkpoint** - `03379c3` (feat)
2. **Task 2: Add roadmap checkpoint and update completion banner** - `aa9784c` (feat)

## Files Created/Modified

- `commands/gsd/new-project.md` (1408 lines, +307 lines) - Added:
  - planning-config.md to execution_context (line 34)
  - gsd-adversary row in model lookup table (line 503)
  - Phase 7.5: Adversary Review for requirements (lines 870-1042)
  - Phase 8.5: Adversary Review for roadmap (lines 1136-1272)
  - Conditional adversary mention in Phase 10 banner (lines 1345-1348)

## Decisions Made

1. **Requirements flow reordering** - Moved commit before user presentation so adversary can review the committed artifact and create a separate revision commit if needed. User now sees the post-adversary version.

2. **Asymmetric commit handling** - Requirements checkpoint creates separate revision commit (artifact already committed). Roadmap checkpoint folds revisions into existing commit flow (artifact not yet committed when adversary runs).

3. **No separate defender agent** - Orchestrator generates defense inline, consistent with the advisory-only design from Phase 1.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The debate loop pattern established here is ready for reuse in Phase 4 (plan-phase integration) and Phase 5 (verify-work integration)
- Pattern elements to copy: config reading block, debate loop structure, adversary spawn prompts, summary display format
- Key difference for future phases: checkpoint names change (plan, verification) and artifact sources differ

### Requirements Covered

| Requirement | Status | Notes |
|-------------|--------|-------|
| INTG-01 | Covered | Requirements adversary checkpoint at Phase 7.5 |
| INTG-02 | Covered | Roadmap adversary checkpoint at Phase 8.5 |
| CONV-01 | Covered | Both checkpoints enforce max 3 round hard cap |

---
*Phase: 03-new-project-integration*
*Completed: 2026-02-13*
