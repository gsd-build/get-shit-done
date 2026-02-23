---
phase: 04-polish-and-recovery
plan: 01
subsystem: health-detection
tags: [worktree, recovery, health-check, orphan-detection]
dependency_graph:
  requires: [cmdWorktreeStatus, cmdLockStale]
  provides: [cmdHealthCheck, runQuickHealthCheck, finalization-markers]
  affects: [cmdWorktreeAdd, cmdWorktreeRemove, cmdWorktreeList, finalize-phase.md]
tech_stack:
  added: []
  patterns: [health-check-pipeline, marker-file-transaction, exit-code-semantics]
key_files:
  created:
    - .planning/worktrees/finalization/ (directory for marker files)
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/workflows/finalize-phase.md
decisions:
  - Default age threshold 7 days for potentially orphaned worktrees
  - Cross-host stale locks marked non-repairable (require --force)
  - Health warnings on stderr, non-blocking for operations
metrics:
  duration: 201s
  completed: 2026-02-23
  tasks_completed: 3
  files_modified: 2
---

# Phase 04 Plan 01: Health Detection Infrastructure Summary

**One-liner:** Comprehensive worktree health detection with orphan/stale-lock/incomplete-finalization detection and auto-warnings during operations.

## What Was Built

### cmdHealthCheck Function
Added comprehensive health detection combining:
- **Orphan detection (RECV-01):** Detects path_missing, not_in_git, not_in_registry, and age_exceeded issues
- **Stale lock detection (RECV-02):** Checks for dead PIDs with hostname awareness for cross-machine locks
- **Incomplete finalization detection (RECV-03):** Scans marker files in `.planning/worktrees/finalization/` and checks for MERGE_HEAD

### Exit Code Semantics
Per CONTEXT.md decision:
- 0 = healthy (no issues)
- 1 = orphans only
- 2 = incomplete only
- 3 = orphans and incomplete
- 4 = runtime error

### Finalization Marker System
Updated `finalize-phase.md` with:
- `write_finalization_marker` step before cleanup
- Marker JSON tracks: phase, worktree_path, branch, started, and step completion status
- `remove_finalization_marker` step after successful finalization
- Health check can detect and report incomplete finalization operations

### Auto-check During Operations
Added non-blocking health warnings to:
- `cmdWorktreeAdd` - warns after successful add
- `cmdWorktreeRemove` - warns after successful remove
- `cmdWorktreeList` - warns after listing

## Commits

| Hash | Message |
|------|---------|
| 2476c3d | feat(04-01): add cmdHealthCheck with comprehensive detection |
| 05e2abd | feat(04-01): add finalization marker file system |
| 7f64e9a | feat(04-01): add auto-check during worktree operations |

## Files Changed

### get-shit-done/bin/gsd-tools.cjs
- Added `HEALTH_EXIT_CODES` constant
- Added `runQuickHealthCheck()` for lightweight auto-warnings
- Added `cmdHealthCheck()` with full detection pipeline
- Added CLI routing for `health check [--age-threshold N]`
- Updated `cmdWorktreeAdd`, `cmdWorktreeRemove`, `cmdWorktreeList` with auto-check

### get-shit-done/workflows/finalize-phase.md
- Added `write_finalization_marker` step before cleanup
- Updated `cleanup_worktree` to update marker status
- Added `remove_finalization_marker` step after update_state

## Deviations from Plan

None - plan executed exactly as written.

## Testing Performed

1. Health check returns healthy status with exit_code 0:
   ```bash
   node get-shit-done/bin/gsd-tools.cjs health check --raw
   # Returns: {"status":"healthy","issues":[],"exit_code":0,"summary":{...}}
   ```

2. Marker file pattern documented in finalize-phase.md:
   ```bash
   grep "finalization/phase-" get-shit-done/workflows/finalize-phase.md
   # Found in both write and remove steps
   ```

3. Worktree list completes with health warning capability:
   ```bash
   node get-shit-done/bin/gsd-tools.cjs worktree list
   # Completes successfully
   ```

## Ready for Plan 04-02

The detection infrastructure is in place. Plan 04-02 can add:
- Interactive repair prompts for each issue type
- `--ci` / `--quiet` mode for non-interactive exit codes
- `/gsd:health` workflow wrapper

## Self-Check: PASSED

- FOUND: 04-01-SUMMARY.md
- FOUND: commit 2476c3d
- FOUND: commit 05e2abd
- FOUND: commit 7f64e9a
