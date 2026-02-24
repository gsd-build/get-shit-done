# Phase 8: Interactive & Integration - Research

**Researched:** 2026-02-24
**Domain:** Interactive CLI exploration, semantic conflict analysis, test discovery, AI integration
**Confidence:** MEDIUM-HIGH

## Summary

Phase 8 implements the interactive layer on top of the upstream sync infrastructure (Phases 5-7). The core challenges are: (1) mapping changed files to their test coverage for post-merge verification, (2) detecting semantic similarities that indicate indirect conflicts, (3) analyzing worktree divergence for impact assessment, and (4) integrating Claude-powered questioning into the CLI exploration flow.

The implementation builds on existing GSD infrastructure: `upstream.cjs` provides git operations and conflict detection, `health.cjs` provides worktree health checks, and `worktree.cjs` manages the registry. The interactive exploration mode uses Node.js readline for prompts, with an "escape hatch" to Claude for complex analysis questions. Test discovery uses a pragmatic three-tier approach: naming conventions first, then import analysis, with coverage data as optional enhancement.

**Primary recommendation:** Build interactive mode with readline-based REPL; use git-native commands for divergence detection; implement test discovery via naming conventions and static import parsing; integrate Claude questioning via structured prompt templates with diff context.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interactive entry point | From sync status output | User runs `sync status`, then `sync explore <commit-hash>` to drill into specific commit |
| Question modes | Structured + AI escape hatch | Offer predefined queries (affected files, conflicts, related commits) with "ask anything" for complex questions |
| Navigation | Linear chronological | Simple next/previous through commit list; no grouping needed in exploration mode |
| Diff view | Smart preview | Summary (files + stats) for changes >50 lines; full diff for smaller changes |
| Suggestion type | Proposed changes | Show actual code/file changes, not just warnings |
| Suggestion timing | Automatic in status | Include suggestions in `sync status` output whenever conflicts are predicted |
| Analysis aggressiveness | Thorough | Analyze semantic similarities; flag even indirect conflicts (may be noisy but thorough) |
| Suggestion application | One-click apply | Each suggestion has individual apply action; user applies one at a time |
| Test detection method | Diff-based | Identify files differing from upstream, run tests covering those files |
| Failure handling | Prompt user | On failure, ask "Rollback merge or keep and fix manually?" |
| Verification trigger | Always automatic | Every successful merge runs verification; no opt-out |
| Verification output | Progressive | Show spinner with test count; expand full output only on failure |
| "Active" worktree definition | In-progress plans | Only warn if worktrees have plans in `in_progress` state (check registry.json) |
| Warning severity | Hard block | Refuse sync until resolved; must use `--force` to override |
| Warning content | Impact analysis | Show worktree names + explain which might be affected by upstream changes |
| Post-merge guidance | Auto-detect conflicts | After merge, check each worktree and report which need attention |

### Claude's Discretion

- Test discovery implementation details (naming conventions, import parsing, coverage data)
- Semantic analysis approach (pattern matching vs AST vs git blame)
- Interactive prompt styling and UX details
- AI question prompt templates

### Deferred Ideas (OUT OF SCOPE)

None captured.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTER-01 | User can explore commits in deep dive mode (ask questions, see diffs) | readline-based REPL with `sync explore <hash>` command; structured queries + Claude escape hatch |
| INTER-02 | System suggests refactoring before merge to minimize conflicts | Semantic analysis via git rename detection, function signature matching, import graph analysis |
| INTER-03 | System runs verification tests after merge to confirm custom features work | Test discovery via naming conventions + import analysis; coverage data optional |
| INTEG-01 | System warns when syncing with active worktrees | Check registry.json for `status: "in_progress"` entries; `git merge-tree` for impact |
| INTEG-02 | Health check detects stalled/incomplete syncs | Extend `health.cjs` with sync state checks; detect orphaned analysis state |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| readline | Node.js built-in | Interactive prompt input | Built-in, no dependencies, supports line editing |
| git merge-tree | Git 2.38+ | Conflict detection without merge | Already used in upstream.cjs |
| git diff | Git 2.17+ | File change detection | Standard git, multiple output formats |
| git blame -M -C | Git 2.17+ | Detect moved/copied code | Handles renames and code movement |
| git rev-list | Git 2.17+ | Commit range operations | Count divergence, find merge-base |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| git log --follow | Track file history across renames | Detecting fork modifications to renamed files |
| git merge-base | Find common ancestor | Calculate worktree divergence |
| fs.existsSync | File presence checks | Test file discovery |
| path.parse | Path manipulation | Extract file names for test matching |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| readline | inquirer.js | inquirer adds dependency; readline sufficient for simple prompts |
| Manual import parsing | jscodeshift/AST | AST parsing heavy; regex sufficient for import statements |
| Custom test runner | Direct node:test | Node test runner already used by GSD; no additional tooling |
| Claude SDK | execSync to claude CLI | GSD runs in Claude Code context; can use subagent pattern |

**Installation:**
```bash
# No new dependencies - uses existing Node.js built-ins and git commands
```

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/
├── bin/
│   └── lib/
│       ├── upstream.cjs       # Existing - add explore functions
│       ├── health.cjs         # Existing - add sync health checks
│       └── interactive.cjs    # NEW: Interactive exploration REPL
│       └── test-discovery.cjs # NEW: Test file mapping
├── commands/
│   └── gsd/
│       ├── sync-explore.md    # NEW: Interactive exploration command
│       └── sync-verify.md     # NEW: Post-merge verification command
```

### Pattern 1: readline-based Interactive REPL

**What:** Use Node.js readline for interactive commit exploration with structured commands.
**When to use:** `sync explore <commit-hash>` command.
**Example:**
```javascript
// Source: Node.js readline documentation
const readline = require('readline');

function createExploreSession(cwd, commitHash) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `explore ${commitHash.slice(0, 7)}> `,
    removeHistoryDuplicates: true,
  });

  // Load commit context once
  const commit = loadCommitDetails(cwd, commitHash);

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();

    switch (input) {
      case 'files':
        showAffectedFiles(commit);
        break;
      case 'diff':
        showSmartDiff(cwd, commit);
        break;
      case 'conflicts':
        showPredictedConflicts(cwd, commit);
        break;
      case 'related':
        showRelatedCommits(cwd, commit);
        break;
      case 'next':
        // Navigate to next commit
        break;
      case 'prev':
        // Navigate to previous commit
        break;
      case 'quit':
      case 'q':
        rl.close();
        return;
      default:
        if (input.startsWith('ask ')) {
          // AI escape hatch - send to Claude
          askClaude(cwd, commit, input.slice(4));
        } else if (input.startsWith('diff ')) {
          // Specific file diff
          showFileDiff(cwd, commit, input.slice(5));
        } else {
          console.log('Commands: files, diff, conflicts, related, next, prev, ask <question>, quit');
        }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('Exploration ended.');
  });
}
```

### Pattern 2: Smart Diff Preview (>50 lines threshold)

**What:** Show summary for large diffs, full content for small diffs.
**When to use:** Displaying commit changes in exploration mode.
**Example:**
```javascript
// Source: CONTEXT.md decision on diff view
const DIFF_PREVIEW_THRESHOLD = 50;

function showSmartDiff(cwd, commit) {
  // Get full diff
  const diffResult = execGit(cwd, ['show', '--stat', '--format=', commit.hash]);

  // Count total lines changed
  const numstatResult = execGit(cwd, ['show', '--numstat', '--format=', commit.hash]);
  const totalLines = numstatResult.stdout.split('\n')
    .filter(Boolean)
    .reduce((sum, line) => {
      const [added, removed] = line.split('\t');
      return sum + parseInt(added || 0) + parseInt(removed || 0);
    }, 0);

  if (totalLines > DIFF_PREVIEW_THRESHOLD) {
    // Summary mode
    console.log(`Changes too large (${totalLines} lines). Showing summary:\n`);
    console.log(diffResult.stdout);
    console.log(`\nUse 'diff <filename>' to see specific file changes.`);
  } else {
    // Full diff mode
    const fullDiff = execGit(cwd, ['show', '--format=', commit.hash]);
    console.log(fullDiff.stdout);
  }
}
```

### Pattern 3: Test Discovery via Naming Conventions

**What:** Map source files to test files using standard naming patterns.
**When to use:** Identifying tests to run for post-merge verification.
**Example:**
```javascript
// Source: Jest documentation on test file discovery
const TEST_PATTERNS = [
  // Pattern: source.js -> source.test.js
  (srcPath) => srcPath.replace(/\.([cm]?js)$/, '.test.$1'),
  // Pattern: source.js -> source.spec.js
  (srcPath) => srcPath.replace(/\.([cm]?js)$/, '.spec.$1'),
  // Pattern: src/file.js -> __tests__/file.test.js
  (srcPath) => {
    const parsed = path.parse(srcPath);
    return path.join(parsed.dir, '__tests__', `${parsed.name}.test${parsed.ext}`);
  },
  // Pattern: lib/module.cjs -> module.test.cjs (GSD pattern)
  (srcPath) => {
    const parsed = path.parse(srcPath);
    // Remove lib/ prefix, add to bin/ with .test
    if (srcPath.includes('/lib/')) {
      const name = parsed.name;
      return srcPath.replace(/\/lib\/[^/]+$/, `/${name}.test${parsed.ext}`);
    }
    return null;
  },
];

function findTestsForFile(cwd, srcPath) {
  const tests = [];

  for (const pattern of TEST_PATTERNS) {
    const testPath = pattern(srcPath);
    if (testPath && fs.existsSync(path.join(cwd, testPath))) {
      tests.push(testPath);
    }
  }

  return tests;
}

function findTestsForChangedFiles(cwd, changedFiles) {
  const testFiles = new Set();

  for (const file of changedFiles) {
    const tests = findTestsForFile(cwd, file);
    tests.forEach(t => testFiles.add(t));
  }

  return Array.from(testFiles);
}
```

### Pattern 4: Semantic Similarity Detection for Refactoring Suggestions

**What:** Detect indirect conflicts via renames, function signatures, and import relationships.
**When to use:** Generating refactoring suggestions in status output.
**Example:**
```javascript
// Source: git blame -M -C documentation, research findings
function detectSemanticSimilarities(cwd) {
  const suggestions = [];

  // 1. Detect renames where fork has modifications
  const renames = detectRenames(cwd); // Already in upstream.cjs
  for (const rename of renames) {
    if (rename.fork_modified) {
      suggestions.push({
        type: 'rename_conflict',
        severity: 'high',
        file: rename.from,
        upstream_action: `renamed to ${rename.to}`,
        fork_action: `modified (${rename.modifications.added_lines}+ ${rename.modifications.removed_lines}-)`,
        suggestion: `Apply fork changes to ${rename.to} before merge`,
        apply_command: `sync apply-rename ${rename.from} ${rename.to}`,
      });
    }
  }

  // 2. Detect function signature changes via pattern matching
  const forkModifiedFiles = getForkModifiedFiles(cwd);
  const upstreamModifiedFiles = getUpstreamModifiedFiles(cwd);

  for (const file of forkModifiedFiles) {
    if (upstreamModifiedFiles.includes(file)) {
      // Both modified same file - check for function signature changes
      const signatureConflicts = detectFunctionSignatureConflicts(cwd, file);
      for (const conflict of signatureConflicts) {
        suggestions.push({
          type: 'signature_conflict',
          severity: 'medium',
          file,
          location: `line ${conflict.line}`,
          fork_signature: conflict.fork,
          upstream_signature: conflict.upstream,
          suggestion: conflict.suggestion,
        });
      }
    }
  }

  // 3. Detect import relationship changes
  const importConflicts = detectImportConflicts(cwd, forkModifiedFiles);
  suggestions.push(...importConflicts);

  return suggestions;
}

function detectFunctionSignatureConflicts(cwd, file) {
  // Use git diff to find modified function definitions
  const forkDiff = execGit(cwd, ['diff', 'upstream/main...HEAD', '--', file, '-U0']);
  const upstreamDiff = execGit(cwd, ['diff', 'HEAD..upstream/main', '--', file, '-U0']);

  // Pattern for function definitions
  const funcPattern = /^[+-]\s*(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm;

  const conflicts = [];
  // Parse both diffs, find overlapping function modifications
  // ... implementation details

  return conflicts;
}
```

### Pattern 5: Worktree Divergence Detection

**What:** Calculate how far each worktree has diverged from main.
**When to use:** Impact analysis before sync, post-merge conflict detection.
**Example:**
```javascript
// Source: git merge-base and rev-list documentation
function analyzeWorktreeDivergence(cwd, registry) {
  const analysis = [];

  for (const [key, entry] of Object.entries(registry.worktrees)) {
    if (entry.status !== 'active') continue;

    // Find merge-base between worktree branch and main
    const mergeBaseResult = execGit(cwd, [
      'merge-base',
      'main',
      entry.branch,
    ]);

    if (!mergeBaseResult.success) continue;

    const mergeBase = mergeBaseResult.stdout.trim();

    // Count commits in each direction
    const behindResult = execGit(cwd, [
      'rev-list',
      '--count',
      `${entry.branch}..main`,
    ]);

    const aheadResult = execGit(cwd, [
      'rev-list',
      '--count',
      `main..${entry.branch}`,
    ]);

    const commitsBehind = parseInt(behindResult.stdout || '0');
    const commitsAhead = parseInt(aheadResult.stdout || '0');

    // Get files that would conflict
    const conflictPreview = execGit(cwd, [
      'merge-tree',
      '--write-tree',
      entry.branch,
      'upstream/main',
    ]);

    const hasConflicts = !conflictPreview.success ||
      conflictPreview.stdout.includes('CONFLICT');

    analysis.push({
      key,
      branch: entry.branch,
      path: entry.path,
      merge_base: mergeBase.slice(0, 7),
      commits_behind_main: commitsBehind,
      commits_ahead_main: commitsAhead,
      divergence_severity: calculateDivergenceSeverity(commitsBehind, commitsAhead),
      would_conflict_with_upstream: hasConflicts,
      recommendation: generateWorktreeRecommendation(commitsBehind, commitsAhead, hasConflicts),
    });
  }

  return analysis;
}

function calculateDivergenceSeverity(behind, ahead) {
  const total = behind + ahead;
  if (total === 0) return 'none';
  if (total <= 5) return 'low';
  if (total <= 20) return 'medium';
  return 'high';
}

function generateWorktreeRecommendation(behind, ahead, wouldConflict) {
  if (behind === 0 && ahead === 0) {
    return 'Worktree is synchronized with main';
  }
  if (behind > 0 && wouldConflict) {
    return `Rebase worktree branch before sync (${behind} commits behind, conflicts expected)`;
  }
  if (behind > 0) {
    return `Consider rebasing worktree branch (${behind} commits behind main)`;
  }
  return 'Worktree has uncommitted work - sync will affect';
}
```

### Pattern 6: AI Escape Hatch via Claude Integration

**What:** Send diff context and user question to Claude for complex analysis.
**When to use:** `ask <question>` command in exploration mode.
**Example:**
```javascript
// Source: Claude Code documentation, GSD patterns
function askClaude(cwd, commit, question) {
  // Get diff context for the commit
  const diffResult = execGit(cwd, ['show', '--format=', commit.hash]);
  const commitInfo = execGit(cwd, ['log', '-1', '--format=%s%n%b', commit.hash]);

  // Build prompt with context
  const prompt = `You are analyzing a git commit for potential merge conflicts.

## Commit
Hash: ${commit.hash}
Subject: ${commitInfo.stdout.split('\n')[0]}

## Changes
\`\`\`diff
${diffResult.stdout.slice(0, 10000)} ${diffResult.stdout.length > 10000 ? '\n... (truncated)' : ''}
\`\`\`

## User Question
${question}

Provide a concise, actionable answer focused on merge implications.`;

  // In GSD context, we're already in a Claude session
  // Use subagent pattern or echo prompt for user to paste
  console.log('\n--- AI Analysis Request ---');
  console.log('To get AI analysis, run this in a new Claude session:\n');
  console.log(prompt.slice(0, 2000) + (prompt.length > 2000 ? '\n... (context truncated for display)' : ''));
  console.log('\n--- End Request ---');

  // Alternative: If implementing outside Claude Code context,
  // could spawn claude CLI or use API directly
}
```

### Anti-Patterns to Avoid

- **Blocking on every test discovery call:** Cache test mappings; only regenerate on file changes
- **Full AST parsing for simple import detection:** Regex sufficient for `require()` and `import` statements
- **Spawning Claude for every question:** Batch context, let user decide when to escalate
- **Ignoring worktree state:** Always check registry before sync operations
- **Running all tests on every merge:** Only run tests for affected files

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive prompts | Custom stdin handling | `readline.createInterface()` | Handles line editing, history, signals |
| Branch divergence | Manual commit walking | `git rev-list --left-right --count` | Optimized, handles complex histories |
| Merge conflict preview | Parse diff markers | `git merge-tree --write-tree` | Already used in upstream.cjs |
| Rename detection | File content hashing | `git blame -M -C -C` | Handles complex rename chains |
| Test running | Custom runner | `node --test` | GSD already uses node:test |

**Key insight:** Git provides specialized commands for divergence analysis. The work is in orchestrating the right commands and presenting results clearly.

## Common Pitfalls

### Pitfall 1: readline Keeps Process Alive

**What goes wrong:** Interactive session doesn't exit after `quit` command.
**Why it happens:** readline keeps stdin open until explicitly closed.
**How to avoid:** Always call `rl.close()` on quit; ensure no other handlers keep process alive.
**Warning signs:** Process hangs after exploration ends.

### Pitfall 2: Test Discovery Misses Nested Tests

**What goes wrong:** Tests in `__tests__/` subdirectories not found.
**Why it happens:** Pattern only checks immediate `__tests__/` directory.
**How to avoid:** Use glob pattern or recursive directory search.
**Warning signs:** Verification reports "0 tests found" when tests exist.

### Pitfall 3: AI Context Too Large

**What goes wrong:** Diff context exceeds Claude context window.
**Why it happens:** Large commits with many files.
**How to avoid:** Truncate diff intelligently; focus on conflicting regions only.
**Warning signs:** AI responses cut off or fail.

### Pitfall 4: Worktree Branch Detection Fails

**What goes wrong:** Can't find merge-base for worktree.
**Why it happens:** Worktree branch has no common ancestor (orphan branch).
**How to avoid:** Check for detached HEAD and orphan branches; handle gracefully.
**Warning signs:** "fatal: No common ancestor" errors.

### Pitfall 5: Test Runner Times Out

**What goes wrong:** Verification hangs on slow or broken tests.
**Why it happens:** No timeout on test execution.
**How to avoid:** Set reasonable timeout (30s); show progress; allow user to skip.
**Warning signs:** Verification step takes >1 minute.

### Pitfall 6: Stale Analysis State After Aborted Sync

**What goes wrong:** `config.json` has outdated analysis data from failed sync.
**Why it happens:** Analysis state not cleared on abort.
**How to avoid:** Clear analysis state in `clearAnalysisState()`; add health check for orphaned state.
**Warning signs:** Status shows old suggestions for already-merged changes.

## Code Examples

Verified patterns from official documentation and existing GSD code.

### Test Discovery Implementation

```javascript
// Source: Jest conventions + GSD codebase patterns
const fs = require('fs');
const path = require('path');

/**
 * Discover tests for a set of changed files.
 * Uses three-tier approach:
 * 1. Naming conventions (fast)
 * 2. Import analysis (medium)
 * 3. Coverage data (optional, slow)
 */
function discoverTestsForFiles(cwd, changedFiles) {
  const testFiles = new Set();
  const unmapped = [];

  for (const file of changedFiles) {
    // Skip non-JS files
    if (!/\.[cm]?js$/.test(file)) continue;

    // Tier 1: Naming conventions
    const conventionTests = findByNamingConvention(cwd, file);
    if (conventionTests.length > 0) {
      conventionTests.forEach(t => testFiles.add(t));
      continue;
    }

    // Tier 2: Import analysis - find tests that import this file
    const importTests = findByImportAnalysis(cwd, file);
    if (importTests.length > 0) {
      importTests.forEach(t => testFiles.add(t));
      continue;
    }

    // File has no discoverable tests
    unmapped.push(file);
  }

  return {
    tests: Array.from(testFiles),
    unmapped,
    coverage: {
      mapped: changedFiles.length - unmapped.length,
      total: changedFiles.length,
    },
  };
}

function findByNamingConvention(cwd, srcFile) {
  const tests = [];
  const parsed = path.parse(srcFile);
  const baseName = parsed.name;

  // Try common patterns
  const patterns = [
    // Same directory: foo.cjs -> foo.test.cjs
    path.join(parsed.dir, `${baseName}.test${parsed.ext}`),
    path.join(parsed.dir, `${baseName}.spec${parsed.ext}`),
    // __tests__ directory
    path.join(parsed.dir, '__tests__', `${baseName}.test${parsed.ext}`),
    // GSD pattern: bin/lib/foo.cjs -> bin/foo.test.cjs
    srcFile.replace(/\/lib\/([^/]+)$/, '/$1').replace(parsed.ext, `.test${parsed.ext}`),
  ];

  for (const pattern of patterns) {
    const fullPath = path.join(cwd, pattern);
    if (fs.existsSync(fullPath)) {
      tests.push(pattern);
    }
  }

  return tests;
}

function findByImportAnalysis(cwd, srcFile) {
  const tests = [];

  // Find all test files
  const testFilePattern = /\.(test|spec)\.[cm]?js$/;
  const testFiles = findFilesRecursive(cwd, testFilePattern);

  // Check which test files import the source file
  const srcBasename = path.basename(srcFile);
  const srcRelative = srcFile.replace(/^\.?\//, '');

  for (const testFile of testFiles) {
    const content = fs.readFileSync(path.join(cwd, testFile), 'utf-8');

    // Check for require/import of this file
    const requirePattern = new RegExp(
      `require\\s*\\(['"](.*${escapeRegex(srcBasename)}|.*${escapeRegex(srcRelative)})['"]\\)`,
      'g'
    );
    const importPattern = new RegExp(
      `import\\s+.*\\s+from\\s+['"](.*${escapeRegex(srcBasename)}|.*${escapeRegex(srcRelative)})['"]`,
      'g'
    );

    if (requirePattern.test(content) || importPattern.test(content)) {
      tests.push(testFile);
    }
  }

  return tests;
}
```

### Interactive Exploration Commands

```javascript
// Source: CONTEXT.md implementation notes
const EXPLORE_COMMANDS = {
  files: {
    description: 'Show files affected by this commit',
    handler: (ctx) => {
      const result = execGit(ctx.cwd, ['show', '--name-status', '--format=', ctx.hash]);
      console.log('\nAffected files:');
      console.log(result.stdout);
    },
  },

  conflicts: {
    description: 'Show predicted conflicts with this commit',
    handler: (ctx) => {
      // Preview conflicts if we merged just this commit
      const preview = getConflictPreview(ctx.cwd);
      if (preview.clean) {
        console.log('\nNo conflicts predicted for this commit.');
      } else {
        console.log(`\n${preview.conflicts.length} potential conflicts:`);
        for (const c of preview.conflicts) {
          console.log(`  ${c.file} (${c.risk})`);
        }
      }
    },
  },

  related: {
    description: 'Show commits that touch the same files',
    handler: (ctx) => {
      const filesResult = execGit(ctx.cwd, ['show', '--name-only', '--format=', ctx.hash]);
      const files = filesResult.stdout.split('\n').filter(Boolean);

      console.log('\nCommits touching the same files:');
      for (const file of files.slice(0, 3)) {
        const logResult = execGit(ctx.cwd, [
          'log', '--oneline', '-5',
          `HEAD..upstream/main`,
          '--', file,
        ]);
        if (logResult.stdout) {
          console.log(`\n${file}:`);
          console.log(logResult.stdout);
        }
      }
    },
  },

  diff: {
    description: 'Show diff (smart preview for large changes)',
    handler: (ctx, args) => {
      if (args) {
        // Specific file diff
        const result = execGit(ctx.cwd, ['show', '--format=', ctx.hash, '--', args]);
        console.log(result.stdout);
      } else {
        // Smart preview
        showSmartDiff(ctx.cwd, ctx);
      }
    },
  },
};
```

### Health Check Extension for Sync State

```javascript
// Source: Extending health.cjs pattern
function checkSyncHealth(cwd) {
  const issues = [];
  const config = loadUpstreamConfig(cwd);

  // Check for orphaned analysis state
  if (config.analysis) {
    const analysisAge = Date.now() - new Date(config.analysis.analyzed_at).getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (analysisAge > ONE_DAY) {
      issues.push({
        type: 'stale_analysis',
        message: 'Sync analysis state is stale (>24 hours old)',
        suggested_action: 'Run sync status to refresh or clear with sync clear-state',
        repairable: true,
      });
    }

    // Check if analyzed SHA still matches upstream
    const currentSha = execGit(cwd, ['rev-parse', 'upstream/main']);
    if (currentSha.success && currentSha.stdout !== config.analysis.analyzed_sha) {
      issues.push({
        type: 'analysis_outdated',
        message: 'Analysis was for different upstream commit',
        suggested_action: 'Re-run sync status to analyze current upstream',
        repairable: true,
      });
    }
  }

  // Check for incomplete merge
  const mergeHead = path.join(cwd, '.git', 'MERGE_HEAD');
  if (fs.existsSync(mergeHead)) {
    issues.push({
      type: 'merge_in_progress',
      message: 'Upstream merge is in progress but not completed',
      suggested_action: 'Complete with git merge --continue or abort with git merge --abort',
      repairable: false,
    });
  }

  return issues;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex-based test discovery | AST + naming conventions hybrid | ~2023 | More accurate, but naming still sufficient for most |
| Manual conflict resolution | AI-assisted analysis | ~2024 | Claude can explain conflicts, suggest resolutions |
| Blocking interactive prompts | Async readline with streaming | Node 18+ | Better UX, non-blocking operations |
| Global test runs | Affected-file-only testing | Standard practice | Much faster verification cycles |

**Deprecated/outdated:**
- `readline-sync` package: Use async readline for better UX
- Full coverage data requirement: Naming conventions sufficient for most projects
- Spawning external AI processes: In-context Claude integration preferred

## Open Questions

1. **Coverage Data Integration**
   - What we know: Istanbul/nyc/v8 coverage provides accurate file-to-test mapping
   - What's unclear: Whether GSD has coverage data available; performance impact of generating it
   - Recommendation: Make coverage data optional tier 3; naming + imports sufficient for now

2. **AI Context Management**
   - What we know: Large diffs exceed context; need intelligent truncation
   - What's unclear: Best strategy for context selection (conflict regions only? all changes?)
   - Recommendation: Start with conflict regions + 10 lines context; expand if user asks

3. **Worktree Branch Rebasing**
   - What we know: Significantly diverged worktrees need rebasing before sync
   - What's unclear: Should tool offer to rebase automatically, or just advise?
   - Recommendation: Advise only - auto-rebase too risky for uncommitted work

4. **Test Timeout Strategy**
   - What we know: Tests can hang or be slow
   - What's unclear: Appropriate timeout values; should timeout be configurable?
   - Recommendation: 30s default; show progress; allow skip via Ctrl+C

## Sources

### Primary (HIGH confidence)

- [Node.js readline documentation](https://nodejs.org/api/readline.html) - Interactive prompt API
- [Git merge-tree documentation](https://git-scm.com/docs/git-merge-tree) - Conflict detection
- [Git blame documentation](https://git-scm.com/docs/git-blame) - Rename and move detection
- [Jest configuration](https://jestjs.io/docs/configuration) - Test file discovery patterns
- GSD Codebase
  - `lib/upstream.cjs` - Existing conflict preview, rename detection
  - `lib/health.cjs` - Health check patterns
  - `lib/worktree.cjs` - Registry management
  - `gsd-tools.test.cjs` - Test naming convention (`.test.cjs`)

### Secondary (MEDIUM confidence)

- [jscodeshift documentation](https://jscodeshift.com/overview/introduction) - AST-based refactoring (alternative approach)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) - AI integration patterns
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - Alternative prompt library
- [Git merge-base documentation](https://git-scm.com/docs/git-merge-base) - Divergence calculation

### Tertiary (LOW confidence)

- Web search results on semantic code analysis - General patterns, needs validation

## Metadata

**Confidence breakdown:**
- Test discovery: HIGH - Well-documented patterns, GSD already uses conventions
- Interactive mode: HIGH - Node.js readline well-understood, simple patterns
- Semantic analysis: MEDIUM - Git provides primitives, integration complexity uncertain
- AI integration: MEDIUM - Pattern clear, but context management needs experimentation
- Worktree divergence: HIGH - Git commands well-documented

**Research date:** 2026-02-24
**Valid until:** 30 days (stable patterns, no fast-moving dependencies)
