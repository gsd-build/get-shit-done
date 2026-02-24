---
phase: 07-merge-operations
plan: 03
subsystem: upstream-sync
tags: [abort, backup-restore, merge-abort, safety]

dependency_graph:
  requires:
    - appendSyncHistoryEntry
    - getSyncHistory
    - listBackupBranches
    - SYNC_EVENTS
  provides:
    - cmdUpstreamAbort
    - detectMergeInProgress
    - checkWorkingTreeClean
    - getGitDir
  affects:
    - .planning/STATE.md (Sync History section)
    - get-shit-done/bin/lib/upstream.cjs
    - get-shit-done/bin/gsd-tools.cjs

tech_stack:
  added: []
  patterns:
    - MERGE_HEAD file detection for merge state
    - git status --porcelain parsing for working tree check
    - Three-argument output function pattern (result, raw, humanOutput)

key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/upstream.cjs
    - get-shit-done/bin/gsd-tools.cjs

decisions:
  - Block restore if working tree has uncommitted changes (preserves user work)
  - Use MERGE_HEAD file presence to detect in-progress merge
  - Human-readable output lists backup branches with numbered items and dates
  - Abort events logged to STATE.md Sync History section

metrics:
  duration: 4 minutes
  completed: 2026-02-24
---

# Phase 7 Plan 03: Abort Command Summary

Abort command for canceling incomplete sync operations and restoring from backup branches.

## What Was Built

### Abort Helpers

Added helper functions to detect merge state and working tree status:

- **getGitDir(cwd)**: Get .git directory path (handles worktrees correctly)
- **detectMergeInProgress(cwd)**: Check for MERGE_HEAD file presence
  - Returns `{ inProgress: true, merge_head: 'abc123d', type: 'merge' }` if merge in progress
  - Returns `{ inProgress: false }` otherwise
- **checkWorkingTreeClean(cwd)**: Check for uncommitted changes
  - Returns `{ clean: true }` if no changes
  - Returns `{ clean: false, staged: N, unstaged: N, untracked: N }` if dirty

### Abort Command

Added `cmdUpstreamAbort(cwd, options, output, error, raw)` with three operation modes:

1. **In-progress merge abort**
   - Detects MERGE_HEAD file
   - Runs `git merge --abort`
   - Logs abort event to STATE.md

2. **Backup branch restoration** (with `--restore <branch>`)
   - Blocks if working tree is dirty (preserves user's uncommitted work)
   - Runs `git reset --hard <backup-branch>`
   - Logs restore event to STATE.md

3. **Show available options** (no flags)
   - Lists backup branches with dates
   - Provides restore command suggestion

### CLI Routing

Added `upstream abort [--restore branch]` subcommand to gsd-tools.cjs:
- Routes to `cmdUpstreamAbort`
- Parses `--restore` option
- Updated help text and error messages

## Commit History

| Commit | Type | Description |
|--------|------|-------------|
| 82d8a6a | feat | Add abort command to upstream.cjs |
| ea041ae | feat | Add abort subcommand to gsd-tools.cjs |
| c361681 | fix | Improve human-readable output for abort command |

## Key Implementation Details

### Merge Detection Pattern

```javascript
function detectMergeInProgress(cwd) {
  const gitDir = getGitDir(cwd);
  const mergeHeadPath = path.join(gitDir, 'MERGE_HEAD');
  if (fs.existsSync(mergeHeadPath)) {
    const mergeHead = fs.readFileSync(mergeHeadPath, 'utf-8').trim();
    return { inProgress: true, merge_head: mergeHead.slice(0, 7), type: 'merge' };
  }
  return { inProgress: false };
}
```

### Human-Readable Output Example

```
No sync in progress.

Available backup branches (most recent first):
  1. backup/pre-sync-2026-02-24-143000 (2026-02-24 14:30)
  2. backup/pre-sync-2026-02-24-100000 (2026-02-24 10:00)

To restore from a backup:
  gsd-tools upstream abort --restore backup/pre-sync-2026-02-24-143000
```

### Safety Checks

- Working tree must be clean before restore (prevents data loss)
- Uses three-argument output pattern for consistent human/raw output
- Abort events logged to STATE.md for audit trail

## Verification Results

All verifications passed:
1. detectMergeInProgress checks for MERGE_HEAD file
2. checkWorkingTreeClean blocks restore on dirty tree
3. cmdUpstreamAbort shows available backup branches
4. Human-readable output formatted with numbered list
5. CLI routing works with --restore option
6. Events would be logged to STATE.md on actual abort

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: get-shit-done/bin/lib/upstream.cjs
- FOUND: get-shit-done/bin/gsd-tools.cjs

Commits verified:
- FOUND: 82d8a6a
- FOUND: ea041ae
- FOUND: c361681
