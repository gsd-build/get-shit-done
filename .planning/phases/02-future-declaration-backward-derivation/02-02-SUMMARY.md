---
phase: 02-future-declaration-backward-derivation
plan: 02
subsystem: cli
tags: [slash-commands, prompt-engineering, socratic-correction, nsr-validation, backward-derivation, language-detection]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Slash command pattern (init.md, status.md), declare-tools.cjs CLI dispatch"
  - phase: 02-future-declaration-backward-derivation
    plan: 01
    provides: "add-declaration, add-milestone, add-action, load-graph subcommands"
provides:
  - "/declare:future slash command for guided declaration capture"
  - "/declare:derive slash command for backward derivation to milestones and actions"
  - "Declaration capture workflow with language detection and Socratic reframing"
  - "Backward derivation workflow with 'what must be true?' questioning and milestone merge detection"
affects: [03-execution-tracking, declare-status, user-facing-commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [meta-prompt workflow pattern (command .md references workflow .md), language detection via embedded classification guide, NSR validation framework]

key-files:
  created:
    - commands/declare/future.md
    - commands/declare/derive.md
    - workflows/future.md
    - workflows/derive.md
  modified: []

key-decisions:
  - "Workflow files separated from command files: commands handle tool orchestration, workflows contain conversation logic"
  - "Language detection embedded as classification guide in workflow rather than code-based NLP"
  - "Reframing limited to 2-3 attempts then accept user phrasing (per locked decision)"

patterns-established:
  - "Command-workflow separation: command .md handles tool calls and state, workflow .md handles conversation logic"
  - "Language classification via embedded guide: declared future (accept), past-derived (reframe), goal language (reframe)"
  - "NSR validation: Necessary (no overlap), Sufficient (checked across set at 3+), Relevant (project scope)"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 2 Plan 2: Declaration Capture and Backward Derivation Commands Summary

**Two slash commands (/declare:future, /declare:derive) with guided conversation workflows for Socratic declaration capture with language detection/NSR validation and backward derivation with milestone merge detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T15:12:10Z
- **Completed:** 2026-02-16T15:15:06Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- /declare:future command with full declaration capture workflow: varied guided prompts, language detection (past-derived + goal language), Socratic reframing with 2-3 attempt limit, NSR validation, independence checking
- /declare:derive command with full backward derivation workflow: per-declaration "what must be true?" questioning, per-milestone "what must be done?" with atomicity checking, recursive depth for sub-milestones, milestone merge detection across declarations
- Both commands installed to user-level ~/.claude/commands/declare/ alongside existing init, status, and help commands
- Full tooling chain verified end-to-end: init -> add-declaration -> add-milestone -> add-action -> load-graph

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /declare:future command and declaration capture workflow** - `2838fa5` (feat)
2. **Task 2: Create /declare:derive command and backward derivation workflow** - `f50425a` (feat)
3. **Task 3: Install commands to user-level paths and verify end-to-end** - no commit (install-only, source files committed in Tasks 1-2)

## Files Created/Modified
- `commands/declare/future.md` - Slash command entry point for /declare:future with load-graph and add-declaration tool calls
- `commands/declare/derive.md` - Slash command entry point for /declare:derive with load-graph, add-milestone, and add-action tool calls
- `workflows/future.md` - Full guided conversation workflow: opening, per-declaration loop, language detection guide, reframing protocol, NSR validation, independence check, closing
- `workflows/derive.md` - Full backward derivation workflow: opening, per-declaration milestone derivation, per-milestone action derivation, atomicity checking, recursive depth, milestone merge detection, closing

## Decisions Made
- Separated workflow logic from command files: commands handle tool orchestration (load-graph, add-declaration, etc.), workflows contain the conversation logic and Claude instructions. This keeps commands clean and workflows reusable.
- Language detection embedded as a classification guide in the workflow markdown rather than implemented as code-based NLP. Claude IS the NLP engine (per research).
- Reframing capped at 2-3 attempts then accepting user phrasing, per locked decision from context gathering.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 declare slash commands are now installed and functional: init, status, help, future, derive
- The complete declaration-to-action flow is ready: /declare:init -> /declare:future -> /declare:derive -> /declare:status
- Phase 2 is complete. Ready for Phase 3 (execution tracking).

## Self-Check: PASSED

All 4 created files verified on disk. All 2 task commit hashes found in git log. All 5 user-level commands verified installed.

---
*Phase: 02-future-declaration-backward-derivation*
*Completed: 2026-02-16*
