---
phase: 03-traceability-navigation
plan: 02
subsystem: cli
tags: [ascii-tree, visualization, slash-commands, meta-prompt, unicode-connectors, dag-rendering]

# Dependency graph
requires:
  - phase: 03-traceability-navigation
    plan: 01
    provides: "buildDagFromDisk, trace command, prioritize command, shared graph loading"
  - phase: 01-foundation
    provides: "DeclareDag engine, CLI dispatch pattern, esbuild bundling"
provides:
  - "visualize command rendering full DAG as top-down ASCII tree with status markers"
  - "/declare:trace slash command with interactive picker"
  - "/declare:visualize slash command with subtree scoping"
  - "/declare:prioritize slash command with declaration filtering"
affects: [user-facing-commands, slash-command-ecosystem]

# Tech tracking
tech-stack:
  added: []
  patterns: [recursive-tree-rendering, status-marker-computation, meta-prompt-slash-commands]

key-files:
  created:
    - src/commands/visualize.js
    - .claude/commands/declare/trace.md
    - .claude/commands/declare/visualize.md
    - .claude/commands/declare/prioritize.md
  modified:
    - src/declare-tools.js
    - dist/declare-tools.cjs

key-decisions:
  - "Visualize duplicates nodes under each parent for many-to-many relationships (tree view, not graph view)"
  - "Status markers: checkmark=DONE, >=ACTIVE, circle=PENDING, !=BLOCKED (has non-done children)"
  - "Slash commands use relative dist/declare-tools.cjs path matching existing status.md pattern"

patterns-established:
  - "Slash command meta-prompt pattern: .md instructs Claude to run tool, parse JSON, render formatted output"
  - "Tree rendering: recursive renderChildren with prefix tracking for Unicode box-drawing connectors"

requirements-completed: [DAG-06, DAG-07, DAG-08]

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 3 Plan 02: Visualize Command and Slash Commands Summary

**ASCII tree visualization with Unicode connectors and status markers, plus three slash commands (trace, visualize, prioritize) following meta-prompt pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T20:17:09Z
- **Completed:** 2026-02-16T20:20:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Implemented visualize command rendering the full 3-layer DAG as a top-down ASCII tree with Unicode box-drawing connectors
- Status markers computed dynamically: DONE (checkmark), ACTIVE (>), PENDING (circle), BLOCKED (!) based on children status
- Created three slash commands following the established meta-prompt pattern from status.md
- All slash commands installed to ~/.claude/commands/declare/ for cross-project use

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement visualize command, wire into CLI, rebuild bundle** - `650509b` (feat)
2. **Task 2: Create trace, visualize, and prioritize slash commands** - `40639e3` (feat)

## Files Created/Modified
- `src/commands/visualize.js` - Top-down tree rendering with subtree scoping, status markers, --output support
- `src/declare-tools.js` - Added visualize case block and import, updated command listings
- `dist/declare-tools.cjs` - Rebuilt bundle with visualize command
- `.claude/commands/declare/trace.md` - Slash command with interactive picker when no args
- `.claude/commands/declare/visualize.md` - Slash command with optional subtree scoping
- `.claude/commands/declare/prioritize.md` - Slash command with optional declaration filter

## Decisions Made
- Visualize duplicates nodes under each parent in many-to-many scenarios (tree view per user decision and research recommendation)
- Blocked status computed dynamically: non-DONE node with at least one non-DONE child marked as [!]
- Slash commands use relative `dist/declare-tools.cjs` path matching existing pattern in status.md
- All three slash commands support --output flag passed through to the CLI tool

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 (Traceability and Navigation) fully complete
- All DAG requirements (DAG-06, DAG-07, DAG-08) from this plan satisfied
- Ready for Phase 4 (Integrity Checks and Status Propagation)

## Self-Check: PASSED

- All 6 key files verified present on disk
- Commits 650509b and 40639e3 verified in git log
- All 20 existing tests pass
- All slash commands installed at user level

---
*Phase: 03-traceability-navigation*
*Completed: 2026-02-16*
