# Phase 7: Merge Operations - Research

**Researched:** 2026-02-24
**Domain:** Git merge operations with backup, rollback, and event logging
**Confidence:** HIGH

## Summary

Phase 7 delivers the actual merge capability for upstream sync. Building on Phase 5 (fetch/status) and Phase 6 (analysis/conflict preview), this phase implements safe merge operations with automatic backup branches, atomic execution with rollback on failure, abort/restore functionality, and comprehensive event logging to STATE.md. The merge must be recoverable under all circumstances.

The implementation follows existing GSD patterns: extending `lib/upstream.cjs` with merge commands, adding STATE.md sync history logging, and providing clear UX for success, failure, and abort scenarios. All operations use native Git commands (Git 2.17+ already required). The key insight is that merge operations are **dangerous by nature** - the value is in safety nets (backup branches), atomicity (rollback on any failure), and audit trails (event logging).

**Primary recommendation:** Implement three commands (`/gsd:sync-merge`, `/gsd:sync-abort`, and a merge helper subcommand) backed by extensions to `lib/upstream.cjs`. Create backup branches before merge, detect failures and rollback automatically, and log all events to a new "Sync History" section in STATE.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision | Choice |
|----------|--------|
| Scope | Fork maintainer tool for this GSD fork repository, NOT for end-users/clients |
| Events logged | Comprehensive - all sync-related operations (fetch, merge, abort, backup, rollback, conflicts) |
| Detail level | Standard - commit hashes, branch names, brief error messages |
| Location | New "Sync History" section in STATE.md (below Session Continuity) |
| Retention | Keep all entries - full audit trail, never auto-delete |

**Event types to log:**
| Event | Trigger |
|-------|---------|
| `fetch` | Upstream fetch completed |
| `merge-start` | Merge operation initiated |
| `merge-complete` | Merge succeeded |
| `merge-failed` | Merge failed (with reason) |
| `abort` | User aborted incomplete sync |
| `upstream-configured` | Initial upstream URL set |
| `upstream-url-changed` | Upstream URL modified |
| `backup-created` | Pre-merge backup branch created |
| `rollback-executed` | Automatic rollback after failure |
| `conflict-detected` | Merge conflicts encountered |

**Log entry format:**
```markdown
### Sync History

| Date | Event | Details |
|------|-------|---------|
| 2026-02-24 14:30 | merge-complete | abc123d..def456g (5 commits) |
| 2026-02-24 14:29 | backup-created | backup/pre-sync-2026-02-24 |
| 2026-02-24 14:29 | fetch | 5 new commits from upstream |
```

### Areas for Research Decision

The following areas were identified but not locked. Research recommends:

**Backup Branch Naming & Lifecycle:**
- Naming: `backup/pre-sync-YYYY-MM-DD-HHMMSS` (timestamp for uniqueness)
- No auto-cleanup - user can prune manually when confident
- Retention: indefinite until user explicitly deletes

**Atomic Merge & Rollback Triggers:**
- Any git error triggers rollback (conservative approach)
- Partial success not allowed - either full merge or full rollback
- Pre-merge state captured via reflog + backup branch

**Abort/Restore User Experience:**
- Clear prompts with state description
- Preserve user's uncommitted work (block merge if dirty)
- Show what will be restored on abort

### Deferred Ideas (OUT OF SCOPE)

None captured.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERGE-01 | User can merge upstream with automatic backup branch creation | `git branch backup/pre-sync-{timestamp}` before `git merge upstream/main` |
| MERGE-02 | System performs atomic merge with rollback on failure | Capture HEAD before merge, `git reset --hard` to pre-merge commit on failure |
| MERGE-03 | User can abort incomplete sync and restore previous state | `git merge --abort` for in-progress merge, restore from backup branch if needed |
| MERGE-04 | System logs sync events to STATE.md | Append to "Sync History" table section with timestamp, event, details |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git merge | Git 2.17+ | Perform upstream merge | Native git, handles all edge cases |
| git branch | Git 2.17+ | Create backup branches | Simple, no-op if exists with `-f` |
| git reset | Git 2.17+ | Rollback to pre-merge state | `--hard` restores exact state |
| git merge --abort | Git 2.17+ | Abort in-progress merge | Safe cleanup of merge state |
| git rev-parse | Git 2.17+ | Capture HEAD commit SHA | For rollback reference |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| git reflog | Backup recovery | If backup branch accidentally deleted |
| git status --porcelain | Check for uncommitted changes | Block merge if dirty |
| git diff --cached --quiet | Check for staged changes | Block merge if staged |
| fs.appendFileSync | STATE.md logging | Append sync history entries |
| fs.readFileSync | STATE.md parsing | Read existing content for section location |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Backup branches | Git stash | Branches are more visible and easier to restore |
| Manual rollback | git revert | Revert adds commits; reset is cleaner for failed merge |
| Marker files for merge state | Git's MERGE_HEAD | Already exists, health.cjs detects it |

**Installation:**
```bash
# No new dependencies - all capabilities use existing GSD infrastructure
```

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/
├── bin/
│   └── lib/
│       └── upstream.cjs        # Extend with merge operations
├── commands/
│   └── gsd/
│       ├── sync-merge.md       # NEW: Merge upstream command
│       └── sync-abort.md       # NEW: Abort sync command
.planning/
└── STATE.md                    # Add Sync History section
```

### Pattern 1: Pre-Merge Safety Checkpoint

**What:** Create backup branch and validate working tree before any merge attempt.
**When to use:** Every merge operation.
**Example:**
```javascript
// Source: Pattern derived from Phase 5 upstream.cjs and worktree.cjs
function cmdUpstreamMerge(cwd, options, output, error, raw) {
  // Step 1: Check working tree is clean
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  if (statusResult.stdout.trim()) {
    error('Working tree has uncommitted changes. Commit or stash before merge.');
    return;
  }

  // Step 2: Capture pre-merge HEAD
  const headResult = execGit(cwd, ['rev-parse', 'HEAD']);
  const preMergeHead = headResult.stdout.trim();

  // Step 3: Create backup branch
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupBranch = `backup/pre-sync-${timestamp}`;
  const branchResult = execGit(cwd, ['branch', backupBranch]);
  if (!branchResult.success) {
    error(`Failed to create backup branch: ${branchResult.stderr}`);
    return;
  }

  // Log backup creation
  appendSyncHistoryEntry(cwd, 'backup-created', backupBranch);

  // Step 4: Attempt merge
  try {
    const mergeResult = execGit(cwd, ['merge', 'upstream/main', '--no-ff',
      '-m', `sync: merge upstream changes from ${upstreamConfig.url}`]);

    if (!mergeResult.success) {
      // Merge failed - rollback
      rollbackMerge(cwd, preMergeHead, backupBranch);
      return;
    }

    // Log success
    appendSyncHistoryEntry(cwd, 'merge-complete',
      `${preMergeHead.slice(0,7)}..${getCurrentHead(cwd).slice(0,7)}`);

  } catch (err) {
    rollbackMerge(cwd, preMergeHead, backupBranch);
  }
}
```

### Pattern 2: Atomic Rollback on Failure

**What:** Reset to pre-merge state on any error, preserving backup branch.
**When to use:** Any merge failure (conflicts, git errors, interruptions).
**Example:**
```javascript
// Source: Safe merge patterns from PITFALLS.md
function rollbackMerge(cwd, preMergeHead, backupBranch) {
  // Abort any in-progress merge
  execGit(cwd, ['merge', '--abort']);

  // Hard reset to pre-merge state
  const resetResult = execGit(cwd, ['reset', '--hard', preMergeHead]);

  if (resetResult.success) {
    appendSyncHistoryEntry(cwd, 'rollback-executed',
      `Restored to ${preMergeHead.slice(0,7)} after merge failure`);
  }

  // Backup branch preserved for manual recovery if needed
}
```

### Pattern 3: STATE.md Sync History Logging

**What:** Append entries to a "Sync History" table section in STATE.md.
**When to use:** All sync events (fetch, merge, abort, backup, rollback, conflicts).
**Example:**
```javascript
// Source: CONTEXT.md decisions for STATE.md logging
const SYNC_HISTORY_HEADER = `### Sync History

| Date | Event | Details |
|------|-------|---------|`;

function appendSyncHistoryEntry(cwd, event, details) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = fs.readFileSync(statePath, 'utf-8');

  const now = new Date();
  const dateStr = now.toISOString().slice(0,16).replace('T', ' ');
  const entry = `| ${dateStr} | ${event} | ${details} |`;

  // Find or create Sync History section
  if (content.includes('### Sync History')) {
    // Insert after the table header row
    const headerEnd = content.indexOf('|---------|') + '|---------|'.length;
    const afterHeader = content.slice(0, headerEnd) + '\n' + entry + content.slice(headerEnd);
    content = afterHeader;
  } else {
    // Add new section before --- at end
    const insertPoint = content.lastIndexOf('---');
    if (insertPoint > 0) {
      content = content.slice(0, insertPoint) + '\n' + SYNC_HISTORY_HEADER + '\n' + entry + '\n\n' + content.slice(insertPoint);
    } else {
      content += '\n\n' + SYNC_HISTORY_HEADER + '\n' + entry + '\n';
    }
  }

  fs.writeFileSync(statePath, content, 'utf-8');
}
```

### Pattern 4: Abort Incomplete Sync

**What:** Clean up merge state and optionally restore from backup branch.
**When to use:** User wants to abandon in-progress or failed sync.
**Example:**
```javascript
// Source: Git merge-abort + backup branch recovery
function cmdUpstreamAbort(cwd, options, output, error, raw) {
  const gitDir = getGitDir(cwd);
  const mergeHeadPath = path.join(gitDir, 'MERGE_HEAD');

  // Check if merge in progress
  if (fs.existsSync(mergeHeadPath)) {
    execGit(cwd, ['merge', '--abort']);
    appendSyncHistoryEntry(cwd, 'abort', 'Aborted in-progress merge');
    output({ aborted: true, reason: 'merge_in_progress' }, raw);
    return;
  }

  // Check for recent backup branches
  const backupBranches = listBackupBranches(cwd);
  if (backupBranches.length === 0) {
    error('No sync in progress and no backup branches found');
    return;
  }

  // Offer to restore from most recent backup
  const latestBackup = backupBranches[0]; // sorted by timestamp
  output({
    aborted: false,
    restore_available: true,
    backup_branch: latestBackup.name,
    created: latestBackup.date,
    suggestion: `To restore: git reset --hard ${latestBackup.name}`,
  }, raw);
}

function listBackupBranches(cwd) {
  const result = execGit(cwd, ['branch', '--list', 'backup/pre-sync-*', '--format=%(refname:short)']);
  if (!result.success) return [];

  return result.stdout.split('\n')
    .filter(Boolean)
    .map(name => ({
      name,
      date: name.replace('backup/pre-sync-', '').replace(/-/g, ':').slice(0, 16),
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
}
```

### Anti-Patterns to Avoid

- **Merge without backup:** Always create backup branch before attempting merge
- **Force push after failed merge:** Never suggest force push; backup branches preserve state
- **Auto-cleanup backup branches:** Let user decide when to remove backups
- **Merge with dirty working tree:** Block operation; user must commit or stash first
- **Silent failures:** Log all events, including failures, to STATE.md for audit trail
- **Reusing worktree merge logic for upstream:** STATE.md upstream sync is different from worktree merge

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merge conflict resolution | Custom conflict resolver | Git's conflict markers + user's editor | Users know their tools |
| Backup/restore | Custom file copies | Git branches + reflog | Git handles all edge cases |
| Merge state detection | Parse .git internals | `test -f .git/MERGE_HEAD` | Standard, health.cjs uses it |
| Transaction log | Custom database | STATE.md markdown table | Follows GSD patterns, human-readable |
| Atomic operations | Lock files | Backup branch + reset pattern | Git's built-in atomicity |

**Key insight:** Git already has atomic operations (merge either succeeds or can be aborted). The work is orchestrating the backup-merge-rollback sequence and logging for human auditability.

## Common Pitfalls

### Pitfall 1: Merge Destroys Custom Enhancements

**What goes wrong:** User runs merge and loses months of custom modifications.
**Why it happens:** Conflicts resolved incorrectly, or user accepts upstream changes without reviewing.
**How to avoid:**
- Always create backup branch before merge
- Show clear diff of what will change
- Log rollback command in case of regret
**Warning signs:** User asks "can I undo the merge?"
**Mitigation:** Backup branches enable `git reset --hard backup/pre-sync-*`

### Pitfall 2: Partial Sync Leaves Corrupted State

**What goes wrong:** Merge starts, conflicts occur, user abandons. Repository in MERGE_HEAD state.
**Why it happens:** Merge is multi-step; user interrupted mid-resolution.
**How to avoid:**
- Detect MERGE_HEAD at sync start
- Provide clear abort command
- health.cjs already detects merge_in_progress
**Warning signs:** `git status` shows "You have unmerged paths"
**Detection:** `test -f .git/MERGE_HEAD`

### Pitfall 3: Rollback Loses User's Work

**What goes wrong:** User had uncommitted changes, merge fails, rollback destroys their work.
**Why it happens:** `git reset --hard` discards working tree changes.
**How to avoid:**
- Block merge if working tree dirty
- Clear error: "Commit or stash changes before merge"
- Check both unstaged and staged changes
**Warning signs:** User reports "my changes disappeared"

### Pitfall 4: Merge Conflicts After Clean Preview

**What goes wrong:** Phase 6 showed "no conflicts," but merge still fails with conflicts.
**Why it happens:** New commits pushed to upstream between preview and merge.
**How to avoid:**
- Re-fetch before merge
- Re-check for conflicts at merge time
- Log exact SHAs in merge message
**Warning signs:** Conflict in file that "shouldn't conflict"

### Pitfall 5: STATE.md Gets Corrupted During Merge

**What goes wrong:** STATE.md has merge conflict markers, becomes unreadable.
**Why it happens:** Both fork and upstream modify STATE.md; merge doesn't resolve cleanly.
**How to avoid:**
- Per PITFALLS.md: Fork's STATE.md should win (local context)
- Sync History section is additive (no conflicts)
- Backup STATE.md separately if needed
**Warning signs:** STATE.md parse errors after merge

### Pitfall 6: Backup Branches Accumulate Forever

**What goes wrong:** After many syncs, dozens of backup branches clutter the repo.
**Why it happens:** CONTEXT.md says "no auto-cleanup."
**How to avoid:**
- Document how to prune: `git branch -D backup/pre-sync-*`
- Show backup branch count in status
- (Future) Add cleanup command
**Warning signs:** `git branch | grep backup` shows many entries

## Code Examples

Verified patterns from git documentation and existing GSD code.

### Pre-Merge Validation Sequence

```bash
# Source: git-merge documentation + PITFALLS.md
# Step 1: Check working tree is clean
git status --porcelain
# Empty = clean, non-empty = dirty (block merge)

# Step 2: Check for staged changes
git diff --cached --quiet
# Exit 0 = no staged, non-zero = staged changes exist (block merge)

# Step 3: Verify upstream remote configured
git remote get-url upstream
# Exit 0 = configured, non-zero = not configured

# Step 4: Verify we have commits to merge
git rev-list --count HEAD..upstream/main
# 0 = already up to date, >0 = commits available
```

### Backup Branch Creation

```bash
# Source: git-branch documentation
# Create timestamped backup branch
TIMESTAMP=$(date -u +"%Y-%m-%d-%H%M%S")
git branch "backup/pre-sync-${TIMESTAMP}"
# No --force, fail if exists (indicates incomplete previous sync)

# List backup branches (most recent first)
git branch --list 'backup/pre-sync-*' --sort=-creatordate
```

### Merge Execution with Rollback

```bash
# Source: git-merge documentation + atomic operation pattern
# Capture pre-merge HEAD
PRE_MERGE=$(git rev-parse HEAD)

# Attempt merge
git merge upstream/main --no-ff -m "sync: merge upstream changes"

# On failure (non-zero exit):
git merge --abort 2>/dev/null || true  # Clean up merge state
git reset --hard "$PRE_MERGE"          # Restore exact state
```

### Abort/Restore Commands

```bash
# Source: git-merge --abort documentation
# Abort in-progress merge
git merge --abort
# Returns exit 0 if merge was in progress and aborted
# Returns non-zero if no merge in progress

# Restore from backup branch (manual step)
git reset --hard backup/pre-sync-2026-02-24-143000

# Verify restoration
git log --oneline -1  # Should match backup commit
```

### STATE.md Event Logging Format

```markdown
### Sync History

| Date | Event | Details |
|------|-------|---------|
| 2026-02-24 14:32 | merge-complete | abc123d..def456g (5 commits) |
| 2026-02-24 14:32 | merge-start | Merging upstream/main |
| 2026-02-24 14:32 | backup-created | backup/pre-sync-2026-02-24-143200 |
| 2026-02-24 14:30 | fetch | 5 new commits from upstream |
| 2026-02-24 14:00 | upstream-configured | https://github.com/gsd-build/get-shit-done |
```

### Error Messages Following GSD Patterns

```
# Clean working tree required
Error: Working tree has uncommitted changes.
Commit or stash your changes before merging:
  git stash         # to stash temporarily
  git commit -am "WIP"  # to commit

# Merge in progress
Error: A merge is already in progress.
To abort: gsd-tools upstream abort
To continue: resolve conflicts and run git merge --continue

# Rollback executed
Warning: Merge failed due to conflicts.
Rolled back to pre-merge state (abc123d).
Backup branch preserved: backup/pre-sync-2026-02-24-143200
To view conflicts that would occur: gsd-tools upstream conflicts

# Successful merge
Merged 5 commits from upstream/main.
Commit range: abc123d..def456g
Backup branch: backup/pre-sync-2026-02-24-143200
Run /gsd:sync-verify to validate your customizations still work.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `git fetch && git merge` | Automated with backup | Phase 7 | Safety net for all merges |
| No rollback on failure | Automatic rollback | Phase 7 | Atomic operations |
| No audit trail | STATE.md Sync History | Phase 7 | Full visibility into sync operations |
| Immediate cleanup | Preserve backup branches | Phase 7 | Recovery always possible |

**Integration with existing GSD patterns:**
- `health.cjs` already detects `merge_in_progress` - Phase 7 adds abort command
- `upstream.cjs` from Phase 5 extended with merge operations
- STATE.md logging follows existing section patterns

## Open Questions

1. **Backup Branch Retention Policy**
   - What we know: CONTEXT.md says "no auto-delete"
   - What's unclear: Should status show backup branch count? Warning after N branches?
   - Recommendation: Show count in status output; document manual cleanup

2. **Conflict During Rollback**
   - What we know: `git reset --hard` should always work
   - What's unclear: Edge case where reset also fails?
   - Recommendation: Log to STATE.md, point user to reflog as last resort

3. **STATE.md Section Ordering**
   - What we know: Goes below Session Continuity
   - What's unclear: Exact insertion point in file
   - Recommendation: Add before final `---` separator, after all existing content

## Sources

### Primary (HIGH confidence)

- Git Documentation
  - [git-merge](https://git-scm.com/docs/git-merge) - Merge command with --abort, --no-ff
  - [git-reset](https://git-scm.com/docs/git-reset) - Reset for rollback (--hard mode)
  - [git-branch](https://git-scm.com/docs/git-branch) - Branch creation for backups
  - [git-rev-parse](https://git-scm.com/docs/git-rev-parse) - Capture HEAD SHA

- GSD Codebase
  - `lib/upstream.cjs` (Phase 5) - Module structure, execGit helper
  - `lib/health.cjs` - merge_in_progress detection pattern
  - `state-merge.cjs` - STATE.md manipulation patterns
  - `PITFALLS.md` - Comprehensive merge pitfall analysis

### Secondary (MEDIUM confidence)

- Project Research
  - `.planning/research/FEATURES-upstream-sync.md` - Feature landscape with rollback support
  - `.planning/research/PITFALLS.md` - Critical pitfall #1 (Sync Destroys Custom Enhancements)
  - `.planning/research/STACK.md` - Git command recommendations

### Tertiary (LOW confidence)

None - all findings verified with official documentation or existing codebase.

## Metadata

**Confidence breakdown:**
- Backup branch pattern: HIGH - Standard git branch commands
- Atomic rollback: HIGH - git reset --hard is reliable
- STATE.md logging: HIGH - Follows existing GSD patterns
- Abort/restore: HIGH - git merge --abort is standard

**Research date:** 2026-02-24
**Valid until:** 30 days (stable git patterns, no fast-moving dependencies)
