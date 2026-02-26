# Phase 6 Context: Analysis

**Created:** 2026-02-24
**Phase Goal:** Provide visibility into upstream changes with grouping and conflict prediction

## Scope Clarification

This phase builds analysis commands that help fork maintainers decide whether/when to merge upstream. The analysis informs the decision; the actual merge happens in Phase 7.

**Requirements covered:**
- ANAL-01: Commits grouped by feature/directory
- ANAL-02: Conflict preview before merge
- ANAL-03: Rename/delete conflict detection and warnings
- ANAL-04: Binary file change flagging

## Commit Grouping (ANAL-01)

**Decision: Directory-based by default, feature detection as flag**

| Aspect | Decision |
|--------|----------|
| Primary grouping | Directory affected (lib/, commands/, etc.) |
| Alternative mode | `--by-feature` flag for semantic grouping when conventional commits present |
| Multi-touch commits | Appears under each affected directory (complete view, some repetition) |
| Command relationship | Separate command: `/gsd:sync-analyze` distinct from `/gsd:sync-log` |
| Directory depth | Adaptive: top-level if few commits, deeper when many cluster in one area |

**Example output:**
```
📁 lib/ (4 commits)
  a1b2c3d refactor: extract sync utilities
  d4e5f6g feat: add conflict detection
  h7i8j9k fix: handle edge case in fetch
  l0m1n2o feat: add conflict detection  ← also appears under commands/

📁 commands/ (2 commits)
  l0m1n2o feat: add conflict detection  ← cross-cutting commit
  p3q4r5s feat: new sync command

📁 templates/ (1 commit)
  q6r7s8t docs: update template examples
```

## Conflict Preview (ANAL-02)

**Decision: Full conflict markers with risk scoring and action suggestions**

| Aspect | Decision |
|--------|----------|
| Detail level | Full conflict markers (`<<<<<<<` sections) shown by default |
| Severity communication | Risk-scored: easy/moderate/hard based on overlap and file type |
| Ownership labeling | Standard git format (both sides shown, no "yours"/"theirs" labels) |
| Post-preview action | Suggest actions based on analysis ("Consider refactoring X first" or "Safe to merge") |

**Risk scoring criteria:**
- **Easy:** Few conflicts, small overlap, familiar file types
- **Moderate:** Multiple conflicts or significant overlap
- **Hard:** Many conflicts, structural changes, or unfamiliar patterns

**Example output:**
```
🔍 Conflict Preview (Merge Risk: MODERATE)

lib/upstream.cjs — 2 conflict regions
<<<<<<< HEAD (fork)
  const TIMEOUT = 5000;
  const RETRY_COUNT = 3;
=======
  const TIMEOUT = 10000;
>>>>>>> upstream

commands/sync.cjs — 1 conflict region
<<<<<<< HEAD (fork)
  // Custom validation added
  if (!validateConfig(config)) return;
=======
>>>>>>> upstream

💡 Suggestion: The lib/upstream.cjs conflict is straightforward (timeout values).
   Consider keeping your RETRY_COUNT addition when resolving.
```

## Rename/Delete Warnings (ANAL-03)

**Decision: Show uncertain cases, block until resolved, full context**

| Aspect | Decision |
|--------|----------|
| Rename detection | Show uncertain cases: "possible rename: A → B (85% similar)" |
| Warning level | **Blocks until resolved** — refuses to merge until addressed |
| Presentation format | With diff summary: shows rename relationship plus content changes |
| Delete context | Diff against base: shows what file looked like and what changes would be lost |

**Resolution workflow:**
1. List all rename/delete conflicts
2. For each, show what's affected and potential loss
3. User must explicitly acknowledge each before merge can proceed
4. Acknowledgment can be batch ("acknowledge all") or individual

**Example output:**
```
⚠️  STRUCTURAL CONFLICTS — Must resolve before merge

1. POSSIBLE RENAME (92% similar)
   lib/helpers.cjs → lib/utils/helpers.cjs
   Your changes: +15 lines (validation logic)
   Status: Your additions would need to move to new location

2. DELETE CONFLICT
   Upstream deleted: lib/legacy-sync.cjs
   Your version has modifications:

   + // Custom timeout handling
   + function handleTimeout() { ... }

   Action required: Acknowledge loss or extract changes first

Run /gsd:sync-resolve to address each conflict.
```

## Binary File Flagging (ANAL-04)

**Decision: Comprehensive detection, minimal detail, risk-categorized, requires acknowledgment**

| Aspect | Decision |
|--------|----------|
| Detection method | Both: git's binary detection + extension list for common types |
| Info level | Presence only: "3 binary files changed" (minimal detail) |
| Grouping | By risk: separate "safe" binaries (images) from "dangerous" (executables) |
| Warning level | **Requires acknowledgment** before merge proceeds |

**Risk categories:**
- **Safe:** Images (.png, .jpg, .gif, .svg), fonts (.woff, .woff2, .ttf), documents (.pdf)
- **Review:** Data files (.json, .yaml if binary), archives (.zip, .tar)
- **Dangerous:** Executables, scripts with shebang, compiled binaries

**Example output:**
```
📦 Binary Changes (3 files)

Safe (2):
  assets/logo.png
  fonts/Inter.woff2

⚠️  Review recommended (1):
  data/fixtures.json.gz

Acknowledge binary changes to proceed? (y/n)
```

## Command Structure

Based on decisions above, Phase 6 adds:

| Command | Purpose |
|---------|---------|
| `/gsd:sync-analyze` | Show commits grouped by directory (default) or feature (--by-feature) |
| `/gsd:sync-preview` | Show conflict preview with risk scoring and suggestions |
| `/gsd:sync-resolve` | Address rename/delete conflicts before merge |

Note: Binary flagging integrated into `/gsd:sync-preview` output.

## Deferred Ideas

Captured during discussion but out of scope for Phase 6:

- None captured

---
*Context created: 2026-02-24*
