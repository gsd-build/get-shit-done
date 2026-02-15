---
phase: 02-polish
plan: 01
subsystem: installer
tags: [cursor, hooks, conversion, polish]
dependency-graph:
  requires: [01-02]
  provides: [cursor-hook-skip, clear-replacement]
  affects: []
tech-stack:
  added: []
  patterns: [runtime-conditional, text-replacement]
file-tracking:
  key-files:
    created: []
    modified: [bin/install.js]
decisions:
  - id: skip-cursor-hooks
    choice: Skip all hook deployment and configuration for Cursor
    rationale: Research showed Cursor has no statusline and no notification API
  - id: clear-replacement
    choice: Replace /clear with "Click '+' (new chat)" instruction
    rationale: Cursor has no /clear command
metrics:
  duration: ~2 minutes
  completed: 2026-02-05
---

# Phase 02 Plan 01: Polish Cursor Installation Summary

**One-liner:** Skip hooks for Cursor and add /clear text replacement in conversion

## Changes Made

### Task 1: Skip Hooks for Cursor Installation

1. **Hook file deployment** - Wrapped in `if (!isCursor)` check
   - Cursor installations no longer deploy `hooks/` directory
   - Commit: `ed6d3c0`

2. **SessionStart hook configuration** - Added `&& !isCursor` to condition
   - Changed from `if (!isOpencode)` to `if (!isOpencode && !isCursor)`
   - Cursor's settings.json won't have SessionStart hooks

3. **Statusline prompt** - Updated `installAllRuntimes()` logic
   - Statusline prompt only shown for Claude/Gemini
   - Cursor and OpenCode always get `shouldInstallStatusline = false`

### Task 2: Enhance Cursor Frontmatter Conversion

1. **`/clear` replacement** - Added to `convertClaudeToCursorFrontmatter()`
   - Pattern: `` `/clear` first → fresh context window`` → `Click "+" (new chat) → fresh context window`
   - Pattern: `<sub>/clear</sub>` → `<sub>Click "+" (new chat)</sub>`

2. **`name:` field removal** - Already implemented in Phase 1 (verified working)

## Requirements Addressed

| Requirement | Status | Notes |
|-------------|--------|-------|
| HOOK-01 | Skipped | No hooks for Cursor (by design) |
| HOOK-02 | Skipped | No hooks for Cursor (by design) |
| HOOK-03 | Skipped | No statusline in Cursor |
| UI-01 | Done | Phase 1 |
| UI-02 | Done | Phase 1 |
| UI-03 | Done | Phase 1 |

## Decisions Made

1. **Skip hooks entirely** - Research confirmed Cursor has no statusline and no notification API
2. **Use "+" button instruction** - Cursor's way to start new chat (equivalent to `/clear`)

## Deviations from Plan

None - plan executed as written.

## Files Modified

| File | Changes |
|------|---------|
| bin/install.js | +44/-30 lines (hook skipping, /clear replacement) |

## Test Results

- `node -c bin/install.js` passes (no syntax errors)
- Hook deployment wrapped in `!isCursor` check
- SessionStart configuration uses `!isOpencode && !isCursor`
- Statusline logic excludes Cursor from prompt

## Commits

| Hash | Message |
|------|---------|
| ed6d3c0 | feat(02-01): skip hooks for Cursor and enhance frontmatter conversion |

## Phase Completion

**Phase 02 Complete:** All plans in Phase 02 (Polish) have been executed.

**Ready for Phase 03 (Verification & Cleanup):** No blockers identified.
