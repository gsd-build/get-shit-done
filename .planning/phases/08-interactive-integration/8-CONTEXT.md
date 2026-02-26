# Phase 8 Context: Interactive & Integration

## Overview

This document captures implementation decisions for Phase 8, gathered through user discussion. Researchers and planners should treat these as locked decisions.

**Phase Goal:** Provide interactive exploration and integrate with existing GSD features

**Requirements:** INTER-01, INTER-02, INTER-03, INTEG-01, INTEG-02

## Decisions

### 1. Interactive Commit Exploration UX

**Requirement:** INTER-01 — User can explore specific upstream commits interactively (view diffs, ask questions)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry point | From sync status output | User runs `sync status`, then `sync explore <commit-hash>` to drill into specific commit |
| Question modes | Structured + AI escape hatch | Offer predefined queries (affected files, conflicts, related commits) with "ask anything" for complex questions |
| Navigation | Linear chronological | Simple next/previous through commit list; no grouping needed in exploration mode |
| Diff view | Smart preview | Summary (files + stats) for changes >50 lines; full diff for smaller changes |

**Implementation notes:**
- `sync explore` command takes commit hash from status output
- Structured queries: `files`, `conflicts`, `related`, `diff <file>`
- AI mode: `ask <question>` sends diff to Claude for analysis
- Navigation: `next`, `prev`, `quit` commands in explore mode

### 2. Refactoring Suggestions Depth

**Requirement:** INTER-02 — User receives refactoring suggestions before merge to minimize conflicts

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Suggestion type | Proposed changes | Show actual code/file changes, not just warnings |
| Timing | Automatic in status | Include suggestions in `sync status` output whenever conflicts are predicted |
| Aggressiveness | Thorough | Analyze semantic similarities; flag even indirect conflicts (may be noisy but thorough) |
| Application | One-click apply | Each suggestion has individual apply action; user applies one at a time |

**Implementation notes:**
- Status output includes "Suggestions" section when conflicts detected
- Each suggestion shows: what/why/proposed fix
- Apply via `sync apply-suggestion <id>` or numbered shortcut
- Semantic analysis looks for: renames, moves, similar function signatures, related imports

### 3. Post-merge Verification Scope

**Requirement:** INTER-03 — Post-merge verification tests run automatically to confirm custom features work

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Detection method | Diff-based | Identify files differing from upstream, run tests covering those files |
| Failure handling | Prompt user | On failure, ask "Rollback merge or keep and fix manually?" |
| Trigger | Always automatic | Every successful merge runs verification; no opt-out |
| Output style | Progressive | Show spinner with test count; expand full output only on failure |

**Implementation notes:**
- Use git diff to find fork-specific files (vs upstream branch)
- Map files to tests via: test file naming conventions, import analysis, or coverage data
- Verification runs AFTER merge commits but BEFORE declaring success
- Rollback uses backup branch created during merge (from Phase 7)

### 4. Worktree Conflict Behavior

**Requirements:** INTEG-01 — Warning when sync with active worktrees; INTEG-02 — Health check reports sync issues

| Decision | Choice | Rationale |
|----------|--------|-----------|
| "Active" definition | In-progress plans | Only warn if worktrees have plans in `in_progress` state (check registry.json) |
| Warning severity | Hard block | Refuse sync until resolved; must use `--force` to override |
| Warning content | Impact analysis | Show worktree names + explain which might be affected by upstream changes |
| Post-merge guidance | Auto-detect conflicts | After merge, check each worktree and report which need attention |

**Implementation notes:**
- Check worktree registry for `status: "in_progress"` entries
- Impact analysis: diff upstream changes against worktree branches
- `--force` flag bypasses block with confirmation
- Post-merge: run `git merge-tree` for each worktree branch vs new main

## Out of Scope

These items were mentioned but are outside Phase 8 boundaries:
- (none captured during discussion)

## Open Questions for Research

1. How to efficiently map files to their test coverage for diff-based verification?
2. What semantic analysis approach works best for detecting indirect conflicts?
3. How to handle worktrees that are significantly diverged from main?

---
*Context captured: 2026-02-24*
*Discussion with: User*
