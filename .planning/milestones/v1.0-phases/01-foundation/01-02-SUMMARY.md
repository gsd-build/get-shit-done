---
phase: 01-foundation
plan: 02
subsystem: artifact-persistence
tags: [markdown-parser, markdown-writer, cli, git-commit, round-trip, cjs]

# Dependency graph
requires:
  - phase: 01-01
    provides: "DeclareDag class with addNode, addEdge, validate, toJSON/fromJSON, stats"
provides:
  - "parseFutureFile and writeFutureFile for FUTURE.md section-card format"
  - "parseMilestonesFile and writeMilestonesFile for MILESTONES.md table format"
  - "parseMarkdownTable generic helper"
  - "commitPlanningDocs for atomic git commits with config awareness"
  - "declare-tools.js CLI entry point with subcommand dispatch"
  - "Templates for FUTURE.md and MILESTONES.md"
affects: [01-03, 02-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permissive parse, strict write: accept variations on input, always produce canonical output"
    - "execFileSync for git operations (proper argument handling vs string concatenation)"
    - "JSON output on stdout for machine consumption by slash commands"
    - "Subcommand dispatch pattern: switch on argv[2] with stub registration"

key-files:
  created:
    - "src/artifacts/future.js"
    - "src/artifacts/milestones.js"
    - "src/artifacts/artifacts.test.js"
    - "src/git/commit.js"
    - "src/declare-tools.js"
    - "templates/future.md"
    - "templates/milestones.md"
  modified: []

key-decisions:
  - "Used execFileSync instead of execSync for git operations to properly handle arguments with spaces"
  - "commitPlanningDocs detects both 'nothing to commit' and 'nothing added to commit' git messages"
  - "parseMarkdownTable exported from milestones.js as a reusable helper"
  - "Multi-value fields parsed with split-on-comma supporting both 'M-01, M-02' and 'M-01,M-02'"

patterns-established:
  - "Permissive parse, strict write: extractField uses case-insensitive regex with whitespace trimming; writers produce exact canonical format"
  - "CLI JSON output: all declare-tools.js commands print JSON to stdout for machine parsing"
  - "Stub registration: commands registered in dispatch switch before implementation, returning structured 'not_implemented' response"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 1 Plan 02: Artifact Persistence Layer Summary

**FUTURE.md and MILESTONES.md parsers/writers with permissive-input/strict-output round-trip, declare-tools.js CLI entry point, and atomic git commit utility**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T11:06:09Z
- **Completed:** 2026-02-16T11:09:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Artifact parsers for FUTURE.md (section-card format) and MILESTONES.md (table format) with permissive input handling
- Round-trip persistence: parse from hand-edited markdown, write back to canonical format, full data preserved
- declare-tools.js CLI with subcommand dispatch (commit active, init/status/help stubs for Plan 03)
- Git commit utility with config awareness, gitignore detection, and edge case handling
- 15 test cases covering canonical, hand-edited, empty, round-trip, multi-value, and full integration scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Artifact parsers, writers, and templates** - `004585b` (feat)
2. **Task 2: declare-tools.js entry point and git commit utility** - `ed0fdfe` (feat)

## Files Created/Modified

- `src/artifacts/future.js` - parseFutureFile and writeFutureFile for FUTURE.md section-card format (87 lines)
- `src/artifacts/milestones.js` - parseMilestonesFile, writeMilestonesFile, and parseMarkdownTable helper (172 lines)
- `src/artifacts/artifacts.test.js` - 15 test cases across 8 describe blocks (414 lines)
- `src/git/commit.js` - commitPlanningDocs with execFileSync, config loading, gitignore detection (118 lines)
- `src/declare-tools.js` - CLI entry point with subcommand dispatch and --files flag parsing (90 lines)
- `templates/future.md` - Empty FUTURE.md template with comment guidance
- `templates/milestones.md` - Empty MILESTONES.md template with table headers

## Decisions Made

- Used `execFileSync` instead of `execSync` for git operations -- `execSync` with string concatenation splits arguments on spaces, breaking commit messages. `execFileSync` passes args as an array, avoiding shell interpretation.
- Exported `parseMarkdownTable` from milestones.js as a reusable helper -- generic enough for future use (e.g., parsing other markdown tables in status output).
- Multi-value field parsing supports both comma-with-space and comma-without-space formats for maximum permissiveness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extractField not trimming leading whitespace on indented lines**
- **Found during:** Task 1
- **Issue:** Hand-edited FUTURE.md files may indent field lines (e.g., `  **Statement:**`). The regex matched but the full line including leading whitespace was returned as the value.
- **Fix:** Added `.trim()` before the replace call in extractField
- **Files modified:** src/artifacts/future.js
- **Committed in:** 004585b (part of Task 1 commit)

**2. [Rule 1 - Bug] Fixed execSync splitting commit messages on spaces**
- **Found during:** Task 2
- **Issue:** `execSync('git commit -m message with spaces')` treats each word as a separate argument. Commit messages with spaces fail.
- **Fix:** Switched from `execSync` with string concatenation to `execFileSync` with argument array
- **Files modified:** src/git/commit.js
- **Committed in:** ed0fdfe (part of Task 2 commit)

**3. [Rule 1 - Bug] Fixed nothing-to-commit detection for 'nothing added to commit' variant**
- **Found during:** Task 2
- **Issue:** Git outputs "nothing added to commit but untracked files present" instead of "nothing to commit" when only untracked files exist
- **Fix:** Added detection for both message variants
- **Files modified:** src/git/commit.js
- **Committed in:** ed0fdfe (part of Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed bugs above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Artifact persistence layer complete: FUTURE.md and MILESTONES.md can be loaded from and saved to disk
- declare-tools.js entry point ready for Plan 03 to implement init/status/help commands
- esbuild.config.js (from Plan 01) ready to bundle declare-tools.js into dist/declare-tools.cjs
- Templates ready for `/declare:init` to copy into new projects

## Self-Check: PASSED

All files exist, all commits found (004585b, ed0fdfe).

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
