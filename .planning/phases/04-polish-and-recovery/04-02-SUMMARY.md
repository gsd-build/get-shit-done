---
phase: 04-polish-and-recovery
plan: 02
subsystem: interactive-repair
tags: [worktree, recovery, health-repair, interactive, doctor-pattern]
dependency_graph:
  requires: [cmdHealthCheck, finalization-markers]
  provides: [cmdHealthRepair, /gsd:health, interactive-repair-workflow]
  affects: [finalize-phase.md, health.md, gsd-tools.cjs]
tech_stack:
  added: []
  patterns: [doctor-pattern, rollback-on-failure, interactive-confirmation]
key_files:
  created:
    - get-shit-done/commands/gsd/health.md
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/workflows/health.md
    - get-shit-done/workflows/finalize-phase.md
decisions:
  - Rollback pattern restores registry on repair failure
  - Remote host stale locks require --force flag
  - merge_in_progress requires manual intervention (no auto-fix)
  - Interactive mode processes one issue at a time with y/n confirmation
metrics:
  duration: 204s
  completed: 2026-02-23
  tasks_completed: 3
  files_modified: 4
---

# Phase 04 Plan 02: Interactive Repair Workflow Summary

**One-liner:** Doctor-pattern health command with interactive per-issue repair, safety checks for uncommitted changes, and rollback on failure.

## What Was Built

### cmdHealthRepair Function
Added comprehensive repair function to gsd-tools.cjs that handles all issue types:

| Issue Type | Repair Action | Safety Check |
|------------|---------------|--------------|
| path_missing | Remove registry entry + lock | None needed |
| not_in_git | git worktree prune + mark removed | None needed |
| not_in_registry | Add to registry as 'untracked' | None needed |
| stale_lock | Release lock + remove lock dir | Require --force for remote hosts |
| age_exceeded | Remove worktree + registry + lock | Block if uncommitted changes |
| incomplete_finalization | Resume from marker file state | Block if uncommitted changes |
| merge_in_progress | Return manual intervention guidance | Cannot auto-fix |

### Rollback Pattern
Implemented snapshot/restore for safe repairs:
- `captureRepairState()` saves registry state before repair
- `restoreRepairState()` restores on failure
- All repair failures report `rolled_back: true`

### /gsd:health Command
Created command and workflow implementing doctor pattern:
- Diagnose first (display issues in table format)
- Then offer fixes one at a time
- User confirms each repair with y/n
- Track fixed/skipped/failed counts

### Interactive vs CI Mode
- Default: Interactive prompts for each issue
- `--quiet` or `--ci`: Exit with code only, no prompts
- Exit codes per CONTEXT.md:
  - 0: Healthy
  - 1: Orphans remain
  - 2: Incomplete finalization remains
  - 3: Both types remain
  - 4+: Runtime errors

### Finalize-Phase Auto-Detect
Added `check_prior_finalization` step:
- Runs after initialize, before UAT check
- Detects any incomplete finalization markers
- Special handling for current phase's marker
- Guides user to /gsd:health for auto-resume

## Commits

| Hash | Message |
|------|---------|
| 7437b9d | feat(04-02): add cmdHealthRepair with safety checks and rollback |
| 539cb97 | feat(04-02): create /gsd:health command and interactive repair workflow |
| e0d5a96 | feat(04-02): add finalize-phase auto-detect for incomplete finalization |

## Files Changed

### get-shit-done/bin/gsd-tools.cjs
- Added `hasUncommittedChanges()` safety function
- Added `captureRepairState()` / `restoreRepairState()` for rollback
- Added `cmdHealthRepair()` with all issue type handlers
- Added CLI routing for `health repair <json> [--force]`

### get-shit-done/commands/gsd/health.md (NEW)
- Command entry point with proper frontmatter
- References workflows/health.md
- Allowed tools include AskUserQuestion for interactive prompts

### get-shit-done/workflows/health.md
- Complete rewrite for worktree health focus
- Implements doctor pattern (diagnose then fix)
- Interactive repair with per-issue confirmation
- CI mode support with exit codes only

### get-shit-done/workflows/finalize-phase.md
- Added `check_prior_finalization` step
- Detects incomplete markers at startup
- Shows completed vs pending steps from marker
- Guides to /gsd:health for recovery

## Deviations from Plan

None - plan executed exactly as written.

## Testing Performed

1. Health repair command handles unknown types gracefully:
   ```bash
   node get-shit-done/bin/gsd-tools.cjs health repair '{"type":"test"}' --raw
   # Returns: {"repaired":false,"issue_type":"test","reason":"unknown_type",...}
   ```

2. Health repair handles path_missing type:
   ```bash
   node get-shit-done/bin/gsd-tools.cjs health repair '{"type":"path_missing","key":"phase-99"}' --raw
   # Returns: {"repaired":true,"issue_type":"path_missing",...}
   ```

3. Command and workflow files exist and have correct content:
   ```bash
   ls -la get-shit-done/commands/gsd/health.md  # exists
   ls -la get-shit-done/workflows/health.md     # exists
   ```

4. Finalize-phase has auto-detect step:
   ```bash
   grep "check_prior_finalization" get-shit-done/workflows/finalize-phase.md
   # Found at line 44
   ```

## Ready for Plan 04-03

The interactive repair workflow is complete. Plan 04-03 can add:
- Emergency recovery for corrupted state
- Manual conflict resolution tools
- Advanced repair options

## Self-Check: PASSED

- FOUND: 04-02-SUMMARY.md
- FOUND: commit 7437b9d
- FOUND: commit 539cb97
- FOUND: commit e0d5a96
