---
phase: 06-analysis
plan: 03
subsystem: upstream-sync

tags:
  - structural-conflicts
  - rename-detection
  - delete-detection
  - acknowledgment-workflow
  - conflict-resolution

dependency_graph:
  requires:
    - upstream.cjs module (5-01)
    - config.json upstream section
  provides:
    - detectStructuralConflicts function
    - acknowledgeConflict function
    - checkAllAcknowledged function
    - cmdUpstreamResolve command
  affects:
    - Phase 7 merge operations (blocks until acknowledged)

tech_stack:
  added: []
  patterns:
    - git diff -M90 --diff-filter=R for rename detection
    - git diff --diff-filter=D for delete detection
    - Analysis state persistence in config.json
    - 1-based index for conflict acknowledgment

key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/upstream.cjs

decisions:
  - Rename threshold at 90% similarity (M90) to reduce false positives
  - Only conflicts where fork has modifications trigger warnings
  - Acknowledgment state persists to survive session restarts
  - Sync analysis state on each resolve call to handle upstream changes

metrics:
  duration_seconds: 526
  completed: 2026-02-24
---

# Phase 6 Plan 3: Structural Conflict Resolution Summary

Rename/delete conflict detection with acknowledgment workflow for safe upstream merges.

## Changes Made

### Task 1: Structural Conflict Detection Functions
**Commit:** e41a7e6

Added detection functions for renames and deletes:
- `getForkModifications(cwd, file)` - Returns +/- line counts for fork's changes
- `detectRenames(cwd)` - Uses `git diff -M90 --diff-filter=R` with similarity percentage
- `detectDeleteConflicts(cwd)` - Only returns files where fork has modifications
- `detectStructuralConflicts(cwd)` - Combines renames and deletes, counts conflicts

Key implementation detail: The -M90 threshold ensures 90% similarity for rename detection, reducing false positives while catching genuine file moves.

### Task 2: Acknowledgment Tracking Functions
**Commit:** c3cb060

Added state management for tracking acknowledged conflicts:
- `loadAnalysisState(cwd)` - Reads `upstream.analysis` section from config.json
- `saveAnalysisState(cwd, state)` - Persists analysis state
- `acknowledgeConflict(cwd, index, ackAll)` - Marks conflicts as acknowledged with timestamp
- `checkAllAcknowledged(cwd)` - Returns `ready_to_merge` status and pending list
- `clearAnalysisState(cwd)` - Removes analysis state after merge completes

### Task 3: cmdUpstreamResolve Command
**Commit:** 1c4f74b

Added command supporting list/acknowledge/status modes:
- Default (list): Shows all structural conflicts with acknowledgment status
- `--ack N`: Acknowledges specific conflict by 1-based index
- `--ack-all`: Acknowledges all conflicts at once
- `--status`: Shows merge readiness summary

Also added `syncAnalysisState()` to keep stored conflicts in sync with live detection.

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| 90% similarity threshold | Reduces false positives from unrelated files with similar boilerplate |
| Fork modification check | Only flag conflicts where fork actually changed the file |
| 1-based conflict indices | More intuitive for CLI users than 0-based |
| Auto-sync on resolve | Handles upstream changes between resolve calls |

## Verification Results

All functions exported and working:
- `detectStructuralConflicts` returns proper structure with renames/deletes/total
- `acknowledgeConflict` persists state to config.json
- `checkAllAcknowledged` correctly reports merge readiness
- `cmdUpstreamResolve` supports all three modes

Syntax check passed: `node -c upstream.cjs`

## Files Changed

| File | Changes |
|------|---------|
| `get-shit-done/bin/lib/upstream.cjs` | +585 lines (detection, acknowledgment, resolve command) |

## Self-Check: PASSED

All commits verified:
- e41a7e6: Task 1 - structural conflict detection
- c3cb060: Task 2 - acknowledgment tracking
- 1c4f74b: Task 3 - cmdUpstreamResolve command
