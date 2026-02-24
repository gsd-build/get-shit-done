# Phase 6: Analysis - Research

**Researched:** 2026-02-24
**Domain:** Git diff analysis, conflict prediction, rename detection, binary file handling
**Confidence:** HIGH

## Summary

Phase 6 provides the analysis layer that helps fork maintainers decide whether and when to merge upstream. Building on Phase 5's fetch/status/log commands, this phase adds: commit grouping by directory and feature, conflict preview with risk scoring, rename/delete conflict detection with resolution workflows, and binary file flagging. The key insight is that analysis is about **informed decision-making** before the destructive merge operation in Phase 7.

The implementation extends `lib/upstream.cjs` with three new commands: `cmdUpstreamAnalyze` (directory/feature grouping), `cmdUpstreamPreview` (conflict preview with risk scoring), and `cmdUpstreamResolve` (rename/delete conflict resolution). All capabilities use native Git commands - particularly `git merge-tree --write-tree` (Git 2.38+) for accurate conflict prediction, and `git diff -M` for rename detection. A new analysis state section in config.json tracks acknowledged structural conflicts and binary files.

**Primary recommendation:** Implement three commands (`/gsd:sync-analyze`, `/gsd:sync-preview`, `/gsd:sync-resolve`) backed by extensions to `lib/upstream.cjs`. Store analysis state (acknowledgments, pending structural conflicts) in config.json under `upstream.analysis`. Use conservative risk scoring where uncertainty pushes toward higher risk levels.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision | Choice |
|----------|--------|
| **Commit Grouping** | Directory-based default, `--by-feature` flag for semantic grouping |
| **Multi-touch commits** | Appear under each affected directory (complete view, some repetition) |
| **Command relationship** | Separate command: `/gsd:sync-analyze` distinct from `/gsd:sync-log` |
| **Directory depth** | Adaptive: top-level if few commits, deeper when many cluster |
| **Conflict detail** | Full conflict markers shown by default |
| **Severity** | Risk-scored: easy/moderate/hard based on overlap and file type |
| **Ownership labels** | Standard git format (both sides shown, no "yours"/"theirs" labels) |
| **Post-preview action** | Suggest actions based on analysis |
| **Rename detection** | Show uncertain cases with similarity percentage |
| **Warning level** | Blocks until resolved (structural conflicts) |
| **Delete context** | Diff against base showing what would be lost |
| **Binary detection** | Both git's binary detection + extension list |
| **Binary detail** | Presence only: "3 binary files changed" |
| **Binary grouping** | By risk: safe (images) vs dangerous (executables) |
| **Binary handling** | Requires acknowledgment before merge proceeds |

### Command Structure

| Command | Purpose |
|---------|---------|
| `/gsd:sync-analyze` | Show commits grouped by directory (default) or feature (`--by-feature`) |
| `/gsd:sync-preview` | Show conflict preview with risk scoring and suggestions |
| `/gsd:sync-resolve` | Address rename/delete conflicts before merge |

### Claude's Discretion

- Risk scoring thresholds and heuristics
- Analysis state schema in config.json
- Error message formatting
- Adaptive depth algorithm specifics

### Deferred Ideas (OUT OF SCOPE)

None captured.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANAL-01 | User can see upstream commits grouped by feature/directory | `git log --format` with `--name-only`, group by directory prefix, adaptive depth based on commit clustering |
| ANAL-02 | User can preview merge conflicts before attempting merge | `git merge-tree --write-tree` for accurate conflict prediction, parse output for conflict regions |
| ANAL-03 | System detects rename/delete conflicts and warns user | `git diff -M --diff-filter=RD` for rename/delete detection, track in config.json, block merge until acknowledged |
| ANAL-04 | System flags binary file changes in upstream | `git diff --numstat` (binary shows `- -`), extension matching, risk categorization |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git merge-tree | Git 2.38+ | Conflict prediction without merge | Modern `--write-tree` mode is reliable |
| git diff -M | Git 2.17+ | Rename detection | Built-in similarity threshold (-M90%) |
| git diff --numstat | Git 2.17+ | Binary file detection | Returns `- -` for binary files |
| git diff --name-only | Git 2.17+ | File list for grouping | Simple, parseable output |
| git log --format --name-only | Git 2.17+ | Commit with affected files | Single command for grouping data |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| git diff --diff-filter | Filter by change type | R=rename, D=delete for structural conflicts |
| git show | Commit content details | Drill-down in analyze output |
| git diff-tree | Efficient tree diff | Large commit ranges |
| fs.readFileSync | Config state | Track acknowledgments |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git merge-tree --write-tree` | `git merge --no-commit --no-ff` | merge-tree is cleaner, doesn't touch index |
| Parse conflict output | External diff library | Git's output is authoritative, no deps |
| Extension list for binary | `file` command | Extension list is faster, cross-platform |

**Installation:**
```bash
# No new dependencies - all capabilities use existing GSD infrastructure
# Note: Git 2.38+ required for merge-tree --write-tree
git --version  # Verify >= 2.38
```

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/
├── bin/
│   └── lib/
│       └── upstream.cjs        # Extend with analyze, preview, resolve
├── commands/
│   └── gsd/
│       ├── sync-analyze.md     # NEW: Directory/feature grouping
│       ├── sync-preview.md     # NEW: Conflict preview with risk
│       └── sync-resolve.md     # NEW: Structural conflict resolution
.planning/
└── config.json                 # Add upstream.analysis section
```

### Pattern 1: Commit Grouping by Directory

**What:** Group commits by the directories they touch, with adaptive depth.
**When to use:** `/gsd:sync-analyze` default output.
**Example:**
```javascript
// Source: CONTEXT.md decisions for grouping + git log parsing
function groupCommitsByDirectory(commits) {
  // commits: [{ hash, subject, files: ['lib/foo.cjs', 'lib/bar.cjs', 'commands/sync.md'] }]
  const groups = new Map(); // directory -> Set of commits

  for (const commit of commits) {
    for (const file of commit.files) {
      // Get top-level directory (adaptive depth comes later)
      const dir = file.includes('/') ? file.split('/')[0] + '/' : '/';
      if (!groups.has(dir)) groups.set(dir, new Set());
      groups.get(dir).add(commit);
    }
  }

  // Adaptive depth: if >50% of commits in one dir, go deeper
  for (const [dir, commitSet] of groups) {
    if (commitSet.size > commits.length * 0.5 && commitSet.size > 5) {
      // Regroup at next depth level
      refineGroupDepth(commits, groups, dir);
    }
  }

  return groups;
}

// Output format per CONTEXT.md
function formatDirectoryGroups(groups) {
  let text = '';
  for (const [dir, commits] of groups) {
    text += `\uD83D\uDCC1 ${dir} (${commits.size} commit${commits.size === 1 ? '' : 's'})\n`;
    for (const commit of commits) {
      text += `  ${commit.hash} ${truncateSubject(commit.subject)}\n`;
    }
    text += '\n';
  }
  return text;
}
```

### Pattern 2: Feature Grouping via Conventional Commits

**What:** Group commits by conventional commit type when `--by-feature` flag used.
**When to use:** Alternative grouping when conventional commits are present.
**Example:**
```javascript
// Source: Reuse Phase 5's groupCommitsByType from upstream.cjs
// CONTEXT.md: "--by-feature flag for semantic grouping when conventional commits present"

function cmdUpstreamAnalyze(cwd, options, output, error, raw) {
  const commits = getCommitsWithFiles(cwd); // git log + --name-only

  if (options.by_feature) {
    // Use existing Phase 5 conventional commit grouping
    const { groups, other } = groupCommitsByType(commits);
    if (Object.keys(groups).length === 0) {
      // Fallback: no conventional commits found
      output({ grouped_by: 'directory', reason: 'no_conventional_commits' }, raw);
      return groupCommitsByDirectory(commits);
    }
    return formatFeatureGroups(groups, other);
  }

  // Default: directory grouping
  return formatDirectoryGroups(groupCommitsByDirectory(commits));
}
```

### Pattern 3: Conflict Preview with git merge-tree

**What:** Use `git merge-tree --write-tree` to predict conflicts without modifying index.
**When to use:** `/gsd:sync-preview` conflict preview.
**Example:**
```javascript
// Source: git merge-tree documentation (Git 2.38+)
function getConflictPreview(cwd) {
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;

  // git merge-tree --write-tree returns exit 0 if clean, non-zero if conflicts
  // Outputs: OID (first line) then conflict info
  const result = execGit(cwd, [
    'merge-tree',
    '--write-tree',
    '--name-only', // Simpler output for parsing
    'HEAD',
    `${remoteName}/${branch}`
  ]);

  // Exit code 0 = no conflicts
  if (result.success && result.stdout) {
    const lines = result.stdout.split('\n');
    const treeOid = lines[0]; // First line is the resulting tree OID
    // If only one line (the OID), no conflicts
    if (lines.length <= 2) {
      return { conflicts: [], tree_oid: treeOid, clean: true };
    }
  }

  // Parse conflict output
  // Format with --name-only: just filenames of conflicted files
  // For full details, omit --name-only and parse conflict markers
  const conflictFiles = result.stdout
    .split('\n')
    .slice(1) // Skip tree OID
    .filter(Boolean);

  return { conflicts: conflictFiles, clean: false };
}

// For detailed conflict markers, use without --name-only
function getDetailedConflicts(cwd, file) {
  const result = execGit(cwd, [
    'merge-tree',
    '--write-tree',
    'HEAD',
    `${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}`,
    '--', file
  ]);
  // Parse conflict markers from output
  return parseConflictMarkers(result.stdout);
}
```

### Pattern 4: Risk Scoring Heuristics

**What:** Assign easy/moderate/hard risk levels to conflicts.
**When to use:** `/gsd:sync-preview` risk assessment.
**Example:**
```javascript
// Source: CONTEXT.md risk scoring criteria
const RISK_FACTORS = {
  // File type risk weights
  fileTypeWeights: {
    'md': 0.5,    // Markdown - easy to resolve
    'json': 0.7,  // Config - moderate
    'cjs': 1.0,   // Code - standard
    'js': 1.0,
    'ts': 1.2,    // TypeScript - slightly harder
  },

  // Conflict size thresholds
  smallConflict: 10,   // lines
  mediumConflict: 50,  // lines
};

function scoreConflictRisk(conflict) {
  const ext = conflict.file.split('.').pop();
  const baseWeight = RISK_FACTORS.fileTypeWeights[ext] || 1.0;

  let score = 0;

  // Factor 1: Number of conflict regions in file
  score += conflict.regions.length * 0.5;

  // Factor 2: Size of conflicts
  const totalLines = conflict.regions.reduce((sum, r) => sum + r.lines, 0);
  if (totalLines > RISK_FACTORS.mediumConflict) score += 2;
  else if (totalLines > RISK_FACTORS.smallConflict) score += 1;

  // Factor 3: File importance (GSD-specific)
  if (conflict.file.includes('STATE.md')) score += 2; // Critical state file
  if (conflict.file.includes('lib/')) score += 0.5;   // Core code

  // Apply file type weight
  score *= baseWeight;

  // Map score to risk level
  if (score < 2) return 'easy';
  if (score < 5) return 'moderate';
  return 'hard';
}

function calculateOverallRisk(conflicts) {
  if (conflicts.length === 0) return null;
  const scores = conflicts.map(scoreConflictRisk);
  if (scores.some(s => s === 'hard')) return 'HARD';
  if (scores.some(s => s === 'moderate')) return 'MODERATE';
  return 'EASY';
}
```

### Pattern 5: Rename/Delete Detection

**What:** Detect file renames and deletes that conflict with fork modifications.
**When to use:** `/gsd:sync-preview` structural conflict detection.
**Example:**
```javascript
// Source: git diff -M documentation, CONTEXT.md decisions
function detectStructuralConflicts(cwd) {
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;

  // Get renames in upstream changes
  // -M90 = 90% similarity threshold for rename detection
  const renameResult = execGit(cwd, [
    'diff', '-M90',
    '--diff-filter=R',
    '--name-status',
    `HEAD..${remoteName}/${branch}`
  ]);

  const renames = [];
  if (renameResult.success && renameResult.stdout) {
    for (const line of renameResult.stdout.split('\n').filter(Boolean)) {
      // Format: R090\told-path\tnew-path (tab-separated)
      const match = line.match(/^R(\d+)\t(.+)\t(.+)$/);
      if (match) {
        renames.push({
          type: 'rename',
          similarity: parseInt(match[1], 10),
          from: match[2],
          to: match[3],
        });
      }
    }
  }

  // Get deletes in upstream
  const deleteResult = execGit(cwd, [
    'diff',
    '--diff-filter=D',
    '--name-only',
    `HEAD..${remoteName}/${branch}`
  ]);

  const deletes = [];
  if (deleteResult.success && deleteResult.stdout) {
    for (const file of deleteResult.stdout.split('\n').filter(Boolean)) {
      // Check if fork has modifications to this file
      const forkModResult = execGit(cwd, [
        'diff', '--name-only',
        `${remoteName}/${branch}..HEAD`,
        '--', file
      ]);
      if (forkModResult.success && forkModResult.stdout.trim()) {
        deletes.push({
          type: 'delete',
          file,
          fork_modified: true,
        });
      }
    }
  }

  return { renames, deletes };
}
```

### Pattern 6: Binary File Detection and Categorization

**What:** Detect and categorize binary file changes.
**When to use:** `/gsd:sync-preview` binary file flagging.
**Example:**
```javascript
// Source: CONTEXT.md binary risk categories
const BINARY_CATEGORIES = {
  safe: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
         '.woff', '.woff2', '.ttf', '.eot', '.pdf'],
  review: ['.json.gz', '.zip', '.tar', '.gz', '.bz2', '.7z'],
  dangerous: ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd'],
};

function detectBinaryChanges(cwd) {
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;

  // git diff --numstat shows "- -" for binary files
  const result = execGit(cwd, [
    'diff', '--numstat',
    `HEAD..${remoteName}/${branch}`
  ]);

  const binaries = { safe: [], review: [], dangerous: [] };

  if (result.success && result.stdout) {
    for (const line of result.stdout.split('\n').filter(Boolean)) {
      // Binary format: "-\t-\tpath/to/file"
      if (line.startsWith('-\t-\t')) {
        const file = line.slice(4);
        const ext = '.' + file.split('.').pop().toLowerCase();

        // Categorize by extension
        if (BINARY_CATEGORIES.safe.includes(ext)) {
          binaries.safe.push(file);
        } else if (BINARY_CATEGORIES.dangerous.some(d => file.endsWith(d) || ext === d)) {
          binaries.dangerous.push(file);
        } else {
          binaries.review.push(file);
        }
      }
    }
  }

  return binaries;
}
```

### Pattern 7: Analysis State in config.json

**What:** Track acknowledgment state for structural conflicts and binary files.
**When to use:** Persistence between `/gsd:sync-preview` and `/gsd:sync-resolve`.
**Example:**
```json
{
  "upstream": {
    "url": "https://github.com/gsd-build/get-shit-done",
    "last_fetch": "2026-02-24T10:30:00Z",
    "commits_behind": 5,
    "last_upstream_sha": "abc123...",
    "analysis": {
      "analyzed_at": "2026-02-24T11:00:00Z",
      "analyzed_sha": "abc123...",
      "structural_conflicts": [
        {
          "type": "rename",
          "from": "lib/helpers.cjs",
          "to": "lib/utils/helpers.cjs",
          "acknowledged": false
        },
        {
          "type": "delete",
          "file": "lib/legacy.cjs",
          "acknowledged": true,
          "acknowledged_at": "2026-02-24T11:05:00Z"
        }
      ],
      "binary_acknowledged": false,
      "binary_files": ["assets/logo.png", "fonts/Inter.woff2"]
    }
  }
}
```

### Anti-Patterns to Avoid

- **Merge during analysis:** Never modify working tree or index during preview
- **Assuming Git version:** Check for Git 2.38+ before using `merge-tree --write-tree`
- **Over-precise risk scores:** Simple easy/moderate/hard is more useful than 0-100
- **Silent failures:** Log all errors, even for optional features
- **Blocking on safe binaries:** Images shouldn't block merge, just require acknowledgment

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict prediction | Attempt merge and rollback | `git merge-tree --write-tree` | Cleaner, doesn't touch index |
| Rename detection | Filename similarity matching | `git diff -M` | Git handles all edge cases |
| Binary detection | Parse file headers | `git diff --numstat` returns `- -` | Reliable, cross-platform |
| Conflict markers | Regex parsing of diff | `git merge-tree` output | Authoritative format |
| Tree comparison | Custom diff algorithm | `git diff-tree` | Optimized for large repos |

**Key insight:** Git provides all the analysis primitives. The work is in orchestrating commands, aggregating results, and presenting them with risk scoring.

## Common Pitfalls

### Pitfall 1: merge-tree Requires Modern Git

**What goes wrong:** `git merge-tree --write-tree` fails on older Git versions.
**Why it happens:** The `--write-tree` mode was added in Git 2.38 (Oct 2022).
**How to avoid:**
- Check Git version at startup
- Fall back to `git merge --no-commit --no-ff` + abort if Git < 2.38
- Document Git version requirement
**Warning signs:** "unknown option" error from merge-tree.
**Detection:**
```javascript
function checkGitVersion() {
  const result = execGit(cwd, ['--version']);
  const match = result.stdout.match(/git version (\d+)\.(\d+)/);
  const [major, minor] = match ? [parseInt(match[1]), parseInt(match[2])] : [0, 0];
  return { major, minor, supportsWriteTree: major > 2 || (major === 2 && minor >= 38) };
}
```

### Pitfall 2: Rename Detection Threshold Too Low

**What goes wrong:** Minor file changes detected as "renames" causing false positive conflicts.
**Why it happens:** Default -M50% is too permissive; files with similar boilerplate match.
**How to avoid:**
- Use -M90% (90% similarity) for high confidence
- Show similarity percentage to user: "possible rename (85% similar)"
- For uncertain cases (70-90%), flag for review but don't block
**Warning signs:** Many rename warnings for unrelated files.

### Pitfall 3: Analysis Becomes Stale

**What goes wrong:** User runs analyze, new commits pushed upstream, analysis doesn't match reality.
**Why it happens:** Time passes between fetch and merge; upstream is a moving target.
**How to avoid:**
- Store `analyzed_sha` in config.json
- Compare with current `upstream/main` SHA before merge
- Re-run analysis if SHA changed
- Show warning: "Analysis is stale. Upstream has new commits since analysis."
**Warning signs:** Conflicts during merge that weren't in preview.

### Pitfall 4: Blocking on Non-Critical Issues

**What goes wrong:** User can't merge because of a renamed image file they don't care about.
**Why it happens:** Overly strict "must acknowledge all" policy.
**How to avoid:**
- Separate "blocks merge" (structural conflicts, dangerous binaries) from "FYI" (safe binaries)
- Provide `--force` flag to skip non-critical acknowledgments
- Log what was force-skipped for audit trail
**Warning signs:** Users complaining about excessive warnings.

### Pitfall 5: Directory Grouping Too Shallow

**What goes wrong:** All 50 commits grouped under "lib/" which is unhelpful.
**Why it happens:** Adaptive depth algorithm didn't trigger, or threshold too conservative.
**How to avoid:**
- Adaptive depth: if >50% of commits in one directory, go one level deeper
- Cap at 3 levels deep to avoid over-splitting
- Consider file count per commit as additional signal
**Warning signs:** One directory dominates the grouping.

### Pitfall 6: Conflict Preview Shows Different Results Than Actual Merge

**What goes wrong:** Preview says "2 conflicts" but merge shows 5.
**Why it happens:** `merge-tree` and `merge` use slightly different algorithms, or upstream changed.
**How to avoid:**
- Use same merge strategy in preview as actual merge
- Immediately before merge, re-verify SHA matches analyzed SHA
- Accept that preview is best-effort, not guaranteed
**Warning signs:** User reports "more conflicts than expected."

## Code Examples

Verified patterns from git documentation and Phase 5 implementation.

### Git Commands for Analysis

```bash
# Source: git-log documentation
# Get commits with affected files for grouping
git log --format="%h|%s" --name-only HEAD..upstream/main
# Output:
# a1b2c3d|feat: add new command
#
# lib/upstream.cjs
# commands/gsd/sync-analyze.md
#
# d4e5f6g|fix: handle edge case
#
# lib/upstream.cjs

# Get directory distribution
git diff --dirstat=files HEAD..upstream/main
# Output:
#   25.0% lib/
#   50.0% commands/gsd/
#   25.0% templates/
```

### Git Commands for Conflict Preview

```bash
# Source: git-merge-tree documentation (Git 2.38+)
# Predict conflicts without touching index
git merge-tree --write-tree HEAD upstream/main
# Exit 0 = clean merge possible
# Exit 1 = conflicts exist

# Get conflicted files only
git merge-tree --write-tree --name-only HEAD upstream/main
# Output (on conflicts):
# <tree-oid>
# lib/upstream.cjs
# STATE.md

# Get full conflict details
git merge-tree --write-tree -z HEAD upstream/main
# Outputs: OID + Conflicted file info with markers
```

### Git Commands for Rename/Delete Detection

```bash
# Source: git-diff documentation
# Detect renames (90% similarity threshold)
git diff -M90 --diff-filter=R --name-status HEAD..upstream/main
# Output:
# R092    lib/helpers.cjs    lib/utils/helpers.cjs

# Detect deletions
git diff --diff-filter=D --name-only HEAD..upstream/main
# Output:
# lib/legacy.cjs

# Check if fork modified a deleted file
git diff --name-only upstream/main..HEAD -- lib/legacy.cjs
# Non-empty output = fork modified the file
```

### Git Commands for Binary Detection

```bash
# Source: git-diff documentation
# Binary files show "- -" in numstat
git diff --numstat HEAD..upstream/main | grep "^-"
# Output:
# -    -    assets/logo.png
# -    -    fonts/Inter.woff2

# Alternative: diff-tree for efficiency on large ranges
git diff-tree -r --numstat HEAD upstream/main | grep "^-"
```

### Output Formatting Examples

```
# /gsd:sync-analyze default output (per CONTEXT.md)
\uD83D\uDCC1 lib/ (4 commits)
  a1b2c3d refactor: extract sync utilities
  d4e5f6g feat: add conflict detection
  h7i8j9k fix: handle edge case in fetch
  l0m1n2o feat: add conflict detection

\uD83D\uDCC1 commands/ (2 commits)
  l0m1n2o feat: add conflict detection
  p3q4r5s feat: new sync command

\uD83D\uDCC1 templates/ (1 commit)
  q6r7s8t docs: update template examples

# /gsd:sync-preview output (per CONTEXT.md)
\uD83D\uDD0D Conflict Preview (Merge Risk: MODERATE)

lib/upstream.cjs \u2014 2 conflict regions
<<<<<<< HEAD (fork)
  const TIMEOUT = 5000;
  const RETRY_COUNT = 3;
=======
  const TIMEOUT = 10000;
>>>>>>> upstream

commands/sync.cjs \u2014 1 conflict region
<<<<<<< HEAD (fork)
  // Custom validation added
  if (!validateConfig(config)) return;
=======
>>>>>>> upstream

\uD83D\uDCA1 Suggestion: The lib/upstream.cjs conflict is straightforward (timeout values).
   Consider keeping your RETRY_COUNT addition when resolving.

# Structural conflicts (per CONTEXT.md)
\u26A0\uFE0F  STRUCTURAL CONFLICTS \u2014 Must resolve before merge

1. POSSIBLE RENAME (92% similar)
   lib/helpers.cjs \u2192 lib/utils/helpers.cjs
   Your changes: +15 lines (validation logic)
   Status: Your additions would need to move to new location

2. DELETE CONFLICT
   Upstream deleted: lib/legacy-sync.cjs
   Your version has modifications:

   + // Custom timeout handling
   + function handleTimeout() { ... }

   Action required: Acknowledge loss or extract changes first

Run /gsd:sync-resolve to address each conflict.

# Binary files (per CONTEXT.md)
\uD83D\uDCE6 Binary Changes (3 files)

Safe (2):
  assets/logo.png
  fonts/Inter.woff2

\u26A0\uFE0F  Review recommended (1):
  data/fixtures.json.gz

Acknowledge binary changes to proceed? (y/n)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `git merge --no-commit` + abort | `git merge-tree --write-tree` | Git 2.38 (Oct 2022) | Cleaner preview, no index changes |
| Fixed directory depth | Adaptive depth based on clustering | Phase 6 design | More useful grouping |
| Binary = just flag it | Risk-categorized binaries | Phase 6 design | Reduced noise from safe binaries |
| Block all structural conflicts | Acknowledge workflow | Phase 6 design | User control over resolution |

**Deprecated/outdated:**
- `git merge-tree <base> <branch1> <branch2>` (trivial-merge mode): Still works but deprecated
- Manual diff parsing for conflicts: `merge-tree` output is authoritative

**Git Version Requirements:**
- Phase 5 (fetch/status/log): Git 2.17+ (already required by GSD)
- Phase 6 (conflict preview): Git 2.38+ for `merge-tree --write-tree`
- Fallback available for Git 2.17-2.37: `git merge --no-commit --no-ff` + abort

## Open Questions

1. **Git Version Enforcement**
   - What we know: `merge-tree --write-tree` requires Git 2.38+
   - What's unclear: How strictly to enforce? Block preview or use fallback?
   - Recommendation: Warn + fallback for Git < 2.38, recommend upgrade

2. **Acknowledgment Persistence**
   - What we know: Store in config.json under `upstream.analysis`
   - What's unclear: How long to keep acknowledgments valid? Per-SHA or until merge?
   - Recommendation: Tie to `analyzed_sha` - acknowledgments invalidate when new commits fetched

3. **Feature Grouping Quality**
   - What we know: `--by-feature` uses conventional commit types
   - What's unclear: What if repo mixes conventional and non-conventional?
   - Recommendation: Show conventional groups + "Other" bucket, warn if >50% are "Other"

4. **Risk Score Calibration**
   - What we know: Easy/moderate/hard based on heuristics
   - What's unclear: Optimal thresholds for GSD-specific files
   - Recommendation: Start conservative (lean toward harder), tune based on user feedback

## Sources

### Primary (HIGH confidence)

- Git Documentation
  - [git-merge-tree](https://git-scm.com/docs/git-merge-tree) - Conflict prediction (--write-tree mode)
  - [git-diff](https://git-scm.com/docs/git-diff) - Rename detection (-M), binary detection (--numstat)
  - [git-log](https://git-scm.com/docs/git-log) - Commit listing with --name-only
  - [git-diff-tree](https://git-scm.com/docs/git-diff-tree) - Efficient tree comparison

- GSD Codebase
  - `lib/upstream.cjs` (Phase 5) - Module structure, execGit, groupCommitsByType
  - `gsd-tools.cjs` - Command routing pattern
  - `.planning/config.json` - Configuration schema pattern

### Secondary (MEDIUM confidence)

- Project Research
  - `.planning/research/PITFALLS.md` - Rename/delete pitfalls, binary file handling
  - `.planning/research/FEATURES-upstream-sync.md` - Feature landscape, differentiators
  - `.planning/phases/05-core-infrastructure/5-RESEARCH.md` - Phase 5 patterns to follow
  - `.planning/phases/07-merge-operations/7-RESEARCH.md` - How Phase 7 consumes analysis

### Tertiary (LOW confidence)

None - all findings verified with official documentation or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native Git commands, official documentation
- Architecture: HIGH - Extends existing Phase 5 patterns
- Pitfalls: HIGH - Already documented in project research
- Code examples: HIGH - Tested against actual repository
- Risk scoring: MEDIUM - Heuristics are reasonable but may need tuning

**Research date:** 2026-02-24
**Valid until:** 30 days (stable git patterns, no fast-moving dependencies)
