# Phase 5: Core Infrastructure - Research

**Researched:** 2026-02-24
**Domain:** Git upstream remote management, commit analysis, session notifications
**Confidence:** HIGH

## Summary

Phase 5 establishes the foundation for upstream sync tooling: configuring the upstream remote, fetching changes without modifying local branches, displaying sync status with commit counts and file summaries, presenting grouped commit logs, and showing notifications when starting a GSD session. The implementation follows existing GSD patterns exactly: a new `lib/upstream.cjs` module (following `worktree.cjs` / `health.cjs` patterns), new gsd-tools subcommands (`upstream configure`, `upstream fetch`, `upstream status`, `upstream log`), and integration with the session banner for notifications.

All capabilities use native Git commands (Git 2.17+ already required by GSD). No new dependencies are needed. The key insight is that upstream sync is about **informed decision-making** - users need to understand what changed before taking action. The notification system uses a 24-hour cache with background (non-blocking) checks to avoid impacting session startup performance.

**Primary recommendation:** Implement four commands (`/gsd:sync-configure`, `/gsd:sync-fetch`, `/gsd:sync-status`, `/gsd:sync-log`) backed by a `lib/upstream.cjs` module. Store upstream config in `.planning/config.json` under an `upstream` section. Integrate notifications into the session banner with silent network error handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision | Choice |
|----------|--------|
| Scope | Fork maintainer tool for this GSD fork repository, NOT for end-users/clients |
| Upstream URL | `https://github.com/gsd-build/get-shit-done` |
| Status format | Count + file summary: "5 commits behind (latest: Feb 21), 12 files in lib/, commands/, templates/" |
| File detail level | Full list if <=10 files, else "N files across M directories" |
| Freshness indicator | Show date of latest upstream commit |
| Local state warnings | Warn about uncommitted/unpushed local changes |
| Zero state | "Up to date with upstream (last synced: Feb 20)" |
| Commit log grouping | By conventional commit type with emoji headers |
| Fallback grouping | Flat chronological list if no conventional commits |
| Group headers | Emoji + label: "Features (3 commits)" |
| Default commit count | All pending commits since last sync |
| Per-line format | Hash + title only, truncated at ~60 chars |
| Notification location | In session banner (alongside version) |
| Notification content | Count + hint: "5 upstream commits available. Run /gsd:sync-status" |
| Notification timing | Background (non-blocking) - session starts immediately |
| Cache duration | 24 hours - daily check is sufficient |
| Network errors | Silent skip - don't block or warn on failures |
| Quiet mode | Config toggle: `upstream_notifications: false` in config.json |
| Zero notification state | "Fork is up to date with upstream" (positive confirmation) |
| Configuration approach | Auto-detect from git remotes, present list if multiple |
| Config storage | Both config.json (primary) and git config (mirrored) |
| URL validation | Test fetch immediately - fail fast on bad URL |
| Unreachable handling | Cache last-known state, warn that fetch failed |

### Command Structure

| Command | Purpose |
|---------|---------|
| `/gsd:sync-configure` | Set up upstream remote (auto-detect + validate) |
| `/gsd:sync-fetch` | Fetch upstream changes (update cache, no merge) |
| `/gsd:sync-status` | Show commits behind with file summary |
| `/gsd:sync-log` | Show grouped commit log |

### Claude's Discretion

- **Module structure details:** Follow `worktree.cjs` and `health.cjs` patterns
- **Error message formatting:** Follow GSD conventions (clear, actionable)
- **Git command specifics:** Use appropriate plumbing vs porcelain commands

### Deferred Ideas (OUT OF SCOPE)

None captured.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | User can configure upstream remote for their GSD fork | `git remote add/set-url upstream <url>` with validation via `git ls-remote` |
| SYNC-02 | User can fetch upstream changes without modifying local branch | `git fetch upstream` - updates tracking refs only, no local changes |
| SYNC-03 | User can view sync status showing commits behind upstream | `git rev-list --count HEAD..upstream/main` + `git diff --stat` |
| SYNC-04 | User can view upstream commit log with summaries | `git log --format` with conventional commit parsing and grouping |
| NOTIF-01 | System checks for upstream updates on session start | Background async check with 24-hour cache in config.json |
| NOTIF-02 | User is notified when upstream has new commits (non-blocking) | Session banner integration, silent on network errors |
| NOTIF-03 | User can see count and summary of pending upstream updates | Cached `commits_behind` count from last fetch |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git remote | Git 2.17+ | Configure upstream remote | Built-in, standard fork workflow |
| git fetch | Git 2.17+ | Download upstream commits | Does not modify working tree |
| git rev-list | Git 2.17+ | Count commits behind/ahead | Efficient commit range operations |
| git log | Git 2.17+ | Commit details with custom format | Flexible output formatting |
| git diff | Git 2.17+ | File change statistics | `--stat` and `--dirstat` for summaries |
| git ls-remote | Git 2.17+ | Validate remote URL | Test reachability without full fetch |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| git config | Config storage | Mirror upstream URL to git config |
| git for-each-ref | Metadata queries | Get last fetch timestamp |
| git status --porcelain | Working tree state | Detect uncommitted changes |
| execSync | Command execution | Existing GSD pattern for git commands |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Parsed git output | simple-git npm | simple-git adds runtime dependency (rejected per GSD constraints) |
| Manual conventional commit parsing | conventional-commits-parser | External dependency; simple regex sufficient |
| New notification system | Existing banner system | Reuse existing infrastructure, no new patterns |

**Installation:**
```bash
# No new dependencies - all capabilities use existing GSD infrastructure
```

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/
├── bin/
│   ├── gsd-tools.cjs           # Add ~50 lines for upstream command routing
│   └── lib/
│       ├── worktree.cjs        # Reference pattern
│       ├── health.cjs          # Reference pattern
│       └── upstream.cjs        # NEW: Core upstream operations
├── commands/
│   └── gsd/
│       ├── sync-configure.md   # NEW: Configure upstream command
│       ├── sync-fetch.md       # NEW: Fetch upstream command
│       ├── sync-status.md      # NEW: Status command
│       └── sync-log.md         # NEW: Log command
.planning/
└── config.json                 # Add upstream section
```

### Pattern 1: Module Following worktree.cjs Structure

**What:** Create `lib/upstream.cjs` with exported functions for each operation.
**When to use:** All upstream sync operations.
**Example:**
```javascript
// Source: Pattern from lib/worktree.cjs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REMOTE_NAME = 'upstream';
const DEFAULT_BRANCH = 'main';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

function execGit(cwd, args) {
  try {
    const result = execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stdout: result.trim() };
  } catch (err) {
    return { success: false, stderr: err.stderr?.trim() || err.message };
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdUpstreamConfigure(cwd, url, output, error, raw) {
  // Implementation: Configure upstream remote with validation
}

function cmdUpstreamFetch(cwd, output, error, raw) {
  // Implementation: Fetch upstream, update cache
}

function cmdUpstreamStatus(cwd, output, error, raw) {
  // Implementation: Show commits behind with file summary
}

function cmdUpstreamLog(cwd, options, output, error, raw) {
  // Implementation: Show grouped commit log
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULT_REMOTE_NAME,
  DEFAULT_BRANCH,
  CACHE_DURATION_MS,
  execGit,
  cmdUpstreamConfigure,
  cmdUpstreamFetch,
  cmdUpstreamStatus,
  cmdUpstreamLog,
};
```

### Pattern 2: Config.json Upstream Section

**What:** Store upstream configuration in existing config.json structure.
**When to use:** Persist upstream URL, cache state, notification preferences.
**Example:**
```json
{
  "mode": "yolo",
  "commit_docs": true,
  "upstream": {
    "url": "https://github.com/gsd-build/get-shit-done",
    "last_fetch": "2026-02-24T10:30:00Z",
    "commits_behind": 5,
    "last_upstream_sha": "8638ea87d016caa9688faec4c370c13052cb7c4a"
  },
  "upstream_notifications": true
}
```

### Pattern 3: Conventional Commit Parsing with Emoji Headers

**What:** Parse commit messages for type prefix and group accordingly.
**When to use:** Displaying grouped commit log.
**Example:**
```javascript
// Source: Conventional Commits specification + CONTEXT.md decisions
const COMMIT_TYPES = {
  feat:     { emoji: '✨', label: 'Features' },
  fix:      { emoji: '🐛', label: 'Fixes' },
  refactor: { emoji: '♻️', label: 'Refactors' },
  docs:     { emoji: '📚', label: 'Documentation' },
  test:     { emoji: '✅', label: 'Tests' },
  chore:    { emoji: '🔧', label: 'Chores' },
  style:    { emoji: '💄', label: 'Styles' },
  perf:     { emoji: '⚡', label: 'Performance' },
  ci:       { emoji: '👷', label: 'CI' },
  build:    { emoji: '🏗️', label: 'Build' },
};

const CONVENTIONAL_PATTERN = /^(\w+)(?:\([^)]+\))?!?:\s*(.+)/;

function parseConventionalCommit(subject) {
  const match = subject.match(CONVENTIONAL_PATTERN);
  if (match) {
    const [, type, description] = match;
    return { type: type.toLowerCase(), description };
  }
  return null;
}

function groupCommitsByType(commits) {
  const groups = {};
  const other = [];

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.subject);
    if (parsed && COMMIT_TYPES[parsed.type]) {
      const type = parsed.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(commit);
    } else {
      other.push(commit);
    }
  }

  return { groups, other };
}
```

### Pattern 4: Background Notification Check with Caching

**What:** Non-blocking upstream check at session start with 24-hour cache.
**When to use:** Session banner integration for notifications.
**Example:**
```javascript
// Source: CONTEXT.md decisions for notification UX
async function checkUpstreamAsync(cwd, config) {
  const now = Date.now();
  const lastFetch = new Date(config.upstream?.last_fetch || 0).getTime();
  const cacheValid = (now - lastFetch) < CACHE_DURATION_MS;

  if (cacheValid && config.upstream?.commits_behind !== undefined) {
    // Use cached value
    return {
      cached: true,
      commits_behind: config.upstream.commits_behind,
    };
  }

  // Background fetch (fire and forget pattern)
  try {
    execGit(cwd, ['fetch', 'upstream', '--quiet']);
    const countResult = execGit(cwd, ['rev-list', '--count', 'HEAD..upstream/main']);
    if (countResult.success) {
      const commits_behind = parseInt(countResult.stdout, 10);
      // Update cache (async, don't block)
      updateUpstreamCache(cwd, { commits_behind, last_fetch: new Date().toISOString() });
      return { cached: false, commits_behind };
    }
  } catch {
    // Silent fail per CONTEXT.md decision
  }

  // Return cached value on failure, or null if no cache
  return {
    cached: true,
    commits_behind: config.upstream?.commits_behind ?? null,
    fetch_failed: true,
  };
}
```

### Anti-Patterns to Avoid

- **Direct git commands in workflows:** Always route through gsd-tools commands
- **Blocking network calls at session start:** Use background async with caching
- **Storing secrets in config.json:** URLs only, no tokens (git handles auth)
- **Parsing git output with fragile regex:** Use `--format` and porcelain options
- **Ignoring uncommitted changes:** Always check working tree state before operations

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Remote configuration | Custom config system | `git remote add/set-url` | Git handles all edge cases |
| URL validation | HTTP client to test URL | `git ls-remote --exit-code` | Handles auth, redirects, protocols |
| Commit range counting | Parse log and count | `git rev-list --count` | Optimized, handles merge commits |
| File change summary | Parse full diff | `git diff --stat`, `--dirstat` | Built-in formatting |
| Conventional commit parsing | Full parser library | Simple regex + COMMIT_TYPES map | Sufficient for display grouping |

**Key insight:** Git provides plumbing commands optimized for each operation. The work is in orchestrating commands and formatting output, not reimplementing git functionality.

## Common Pitfalls

### Pitfall 1: Fetch Doesn't Show Changes

**What goes wrong:** User runs fetch, expects to see changes, but `git diff` shows nothing.
**Why it happens:** `fetch` only updates remote tracking branches, not local branches.
**How to avoid:** Clear messaging after fetch: "Fetched 5 new commits. Run /gsd:sync-status for details."
**Warning signs:** User reports "fetch doesn't work" or "nothing changed after fetch."

### Pitfall 2: Network Timeout Blocks Session Start

**What goes wrong:** Slow network or unreachable upstream causes long delay at session start.
**Why it happens:** Synchronous fetch call with no timeout.
**How to avoid:** Use background async check, display cached value immediately, update in background.
**Warning signs:** Session startup takes >5 seconds when offline.

### Pitfall 3: Stale Cache After Manual Git Operations

**What goes wrong:** User runs `git fetch upstream` manually, but GSD shows old cached value.
**Why it happens:** Cache not updated unless GSD commands used.
**How to avoid:** Check if `upstream/main` SHA changed since last cached SHA; invalidate cache if so.
**Warning signs:** Status shows "0 commits behind" but user knows there are changes.

### Pitfall 4: Conventional Commit Parsing Misses Scoped Types

**What goes wrong:** Commits like `feat(parser): add new syntax` not recognized.
**Why it happens:** Regex doesn't handle optional scope in parentheses.
**How to avoid:** Use regex: `/^(\w+)(?:\([^)]+\))?!?:\s*(.+)/`
**Warning signs:** Many commits fall into "other" category.

### Pitfall 5: Uncommitted Changes Warning Not Shown

**What goes wrong:** User has local changes that could conflict with sync operations later.
**Why it happens:** Status command doesn't check working tree state.
**How to avoid:** Always run `git status --porcelain` and warn if output non-empty.
**Warning signs:** User surprised by conflicts during later merge phase.

## Code Examples

Verified patterns from git documentation and existing GSD code.

### Git Commands for Configure

```bash
# Source: git-remote documentation
# Add new upstream remote
git remote add upstream "https://github.com/gsd-build/get-shit-done"

# Or update existing upstream URL
git remote set-url upstream "https://github.com/gsd-build/get-shit-done"

# Validate URL is reachable
git ls-remote --exit-code "https://github.com/gsd-build/get-shit-done" HEAD
# Exit 0 = reachable, non-zero = unreachable or auth required
```

### Git Commands for Status

```bash
# Source: git-rev-list documentation
# Count commits behind upstream
git rev-list --count HEAD..upstream/main
# Output: 16

# Get latest upstream commit date
git log -1 --format="%as" upstream/main
# Output: 2026-02-23

# Get file change summary
git diff --stat main..upstream/main | tail -1
# Output: 103 files changed, 8513 insertions(+), 23722 deletions(-)

# Get directory distribution
git diff --dirstat=files main..upstream/main
# Output:
#    6.7% .planning/codebase/
#   12.6% get-shit-done/bin/lib/
#    7.7% tests/
```

### Git Commands for Log

```bash
# Source: git-log documentation
# Get commits with parseable format
git log --format="%h|%an|%as|%s" main..upstream/main
# Output:
# 8638ea8|Lex Christopherson|2026-02-23|1.20.6
# 6eaf560|Lex Christopherson|2026-02-23|docs: update changelog

# Check for uncommitted changes
git status --porcelain
# Empty = clean, non-empty = changes present

# Check for unpushed commits
git rev-list origin/main..HEAD --count
# Output: 4 (commits not pushed to origin)
```

### Output Formatting Examples

```
# Status output (per CONTEXT.md)
5 commits behind upstream (latest: Feb 21)
12 files changed in lib/, commands/, templates/

⚠ Local has uncommitted changes — commit before sync

# Log output (per CONTEXT.md)
✨ Features (3 commits)
  a1b2c3d feat: add sync status command
  d4e5f6g feat: implement upstream fetch
  h7i8j9k feat: add notification system

🐛 Fixes (2 commits)
  l0m1n2o fix: handle network timeout gracefully
  p3q4r5s fix: correct path resolution in worktrees

# Notification banner (per CONTEXT.md)
GSD v1.1.0 | Fork: mauricevdm/get-shit-done
↳ 5 upstream commits available. Run /gsd:sync-status for details

# Zero state
Fork is up to date with upstream (last synced: Feb 24)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse `git worktree list` | JSON registry | v1.0 | Explicit state beats fragile parsing |
| External notification daemons | Session-based with cache | GSD design | No persistent processes |
| Full re-fetch on each check | 24-hour cache with invalidation | Phase 5 decision | Performance + offline support |

**Deprecated/outdated:**
- `git merge-tree` legacy syntax (pre-2.38): Still works, but `--write-tree` preferred
- Synchronous network calls at startup: Replace with background async

## Open Questions

1. **Cache Invalidation on Manual Operations**
   - What we know: Cache stores `last_upstream_sha` to detect changes
   - What's unclear: Should we check SHA on every status call, or only when cache expires?
   - Recommendation: Check SHA when status called; only check on notification if cache expired

2. **Notification Banner Integration Point**
   - What we know: Notification should appear "in session banner"
   - What's unclear: Exact integration point in existing session startup code
   - Recommendation: Research session startup code during planning; may need workflow hooks

3. **Multiple Remotes Scenario**
   - What we know: Auto-detect from remotes, present list if multiple
   - What's unclear: How to present selection UI in CLI context
   - Recommendation: List numbered options, prompt for selection; fallback to named "upstream" if exists

## Sources

### Primary (HIGH confidence)

- Git Documentation
  - [git-remote](https://git-scm.com/docs/git-remote) - Remote management commands
  - [git-fetch](https://git-scm.com/docs/git-fetch) - Fetch behavior and options
  - [git-rev-list](https://git-scm.com/docs/git-rev-list) - Commit range operations
  - [git-log](https://git-scm.com/docs/git-log) - Log formatting options
  - [git-diff](https://git-scm.com/docs/git-diff) - Diff statistics output
  - [git-ls-remote](https://git-scm.com/docs/git-ls-remote) - Remote validation

- GSD Codebase
  - `lib/worktree.cjs` - Module structure pattern
  - `lib/health.cjs` - Complex module with multiple operations
  - `gsd-tools.cjs` - Command routing, `execGit` helper pattern
  - `.planning/config.json` - Configuration storage pattern

### Secondary (MEDIUM confidence)

- Project Research (already completed)
  - `.planning/research/SUMMARY.md` - Overall v1.1 research synthesis
  - `.planning/research/STACK.md` - Technology stack decisions
  - `.planning/research/PITFALLS.md` - Comprehensive pitfall analysis
  - `.planning/research/FEATURES-upstream-sync.md` - Feature landscape

### Tertiary (LOW confidence)

None - all findings verified with official documentation or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native Git commands, official documentation
- Architecture: HIGH - Follows existing GSD patterns exactly
- Pitfalls: HIGH - Already documented in project research
- Code examples: HIGH - Tested against actual repository

**Research date:** 2026-02-24
**Valid until:** 30 days (stable git patterns, no fast-moving dependencies)
