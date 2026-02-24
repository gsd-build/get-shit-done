---
phase: 08-interactive-integration
plan: 04
subsystem: upstream-sync
tags: [worktree, health, sync, guards]
dependency-graph:
  requires:
    - get-shit-done/bin/lib/worktree.cjs (loadRegistry)
    - get-shit-done/bin/lib/upstream.cjs (existing functions)
  provides:
    - checkWorktreesBeforeSync (sync guard)
    - analyzeWorktreeDivergence (divergence metrics)
    - detectWorktreeConflictsPostMerge (post-merge analysis)
    - checkSyncHealth (health check integration)
  affects:
    - cmdHealthCheck (now includes sync issues)
tech-stack:
  added: []
  patterns:
    - Worktree registry integration for sync operations
    - Health check extensibility pattern
key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/upstream.cjs
    - get-shit-done/bin/lib/health.cjs
decisions:
  - Hard block on sync with active worktrees (per CONTEXT.md)
  - Force flag bypasses block with warning
  - Severity levels: none (<0), low (<=5), medium (<=20), high (>20) total divergence
  - Sync health detects: stale analysis, outdated SHA, incomplete merge, orphaned state
metrics:
  duration: 3m 44s
  completed: 2026-02-24
---

# Phase 8 Plan 04: Worktree Sync Guards and Health Checks Summary

Worktree integration for upstream sync with hard block protection and health monitoring

## One-liner

Sync guards block active worktrees with impact analysis, health checks detect stale/orphaned sync state

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add worktree sync guards to upstream.cjs | 926c688 | get-shit-done/bin/lib/upstream.cjs |
| 2 | Add sync health checks to health.cjs | 46a6079 | get-shit-done/bin/lib/health.cjs |

## Implementation Details

### Task 1: Worktree Sync Guards

Added four new functions to upstream.cjs for worktree-aware sync operations:

**checkWorktreesBeforeSync(cwd, options)**
- Loads worktree registry and finds active (status='active') entries
- Returns `blocked: true` with impact analysis if active worktrees exist
- Supports `force` option to bypass block with warning
- Impact includes: commits_behind, commits_ahead, divergence_severity, would_conflict

**analyzeWorktreeDivergence(cwd, registry)**
- Calculates divergence for each active worktree against main
- Uses `git merge-base`, `git rev-list --count` for metrics
- Uses `git merge-tree --write-tree` to detect potential conflicts with upstream
- Returns recommendation: 'rebase', 'merge', 'review', or 'none'

**calculateDivergenceSeverity(behind, ahead)**
- Returns severity level based on total divergence
- none (0), low (<=5), medium (<=20), high (>20)

**detectWorktreeConflictsPostMerge(cwd)**
- Checks each active worktree against new main after merge
- Identifies worktrees that would have conflicts
- Returns list with recommendations for each affected worktree

### Task 2: Sync Health Checks

Added `checkSyncHealth(cwd)` to health.cjs:

**Detected Issues:**
- `stale_analysis`: Analysis state older than 24 hours
- `analysis_outdated`: analyzed_sha differs from current upstream SHA
- `sync_merge_incomplete`: MERGE_HEAD file exists (in-progress merge)
- `orphaned_analysis_state`: Analysis exists but fork is up-to-date
- `binary_files_pending`: Binary files awaiting acknowledgment

**Integration:**
- Sync issues integrated into cmdHealthCheck output
- Summary includes `sync_issue_count` field
- Each issue has type, message, suggested_action, repairable flag

## Key Links Verified

- upstream.cjs imports loadRegistry from worktree.cjs
- health.cjs imports loadUpstreamConfig, CONFIG_PATH from upstream.cjs

## Deviations from Plan

None - plan executed exactly as written.

## Artifacts

### upstream.cjs (3359 lines, min: 2600)
- New exports: checkWorktreesBeforeSync, analyzeWorktreeDivergence, calculateDivergenceSeverity, detectWorktreeConflictsPostMerge
- Pattern: Registry integration via loadRegistry

### health.cjs (900 lines, min: 780)
- New export: checkSyncHealth
- Pattern: Analysis state access via loadUpstreamConfig

## Success Criteria Verification

- [x] checkWorktreesBeforeSync() returns blocked=true for in_progress worktrees
- [x] Block message shows worktree names and impact analysis
- [x] --force bypasses block with warning
- [x] analyzeWorktreeDivergence() calculates: commits_behind, commits_ahead, severity, would_conflict
- [x] detectWorktreeConflictsPostMerge() shows which worktrees need attention
- [x] checkSyncHealth() detects: stale_analysis, analysis_outdated, sync_merge_incomplete
- [x] Health issues integrated into cmdHealthCheck

## Self-Check: PASSED

Files verified:
- FOUND: get-shit-done/bin/lib/upstream.cjs (3359 lines)
- FOUND: get-shit-done/bin/lib/health.cjs (900 lines)

Commits verified:
- FOUND: 926c688 (worktree sync guards)
- FOUND: 46a6079 (sync health checks)
