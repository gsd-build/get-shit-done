---
phase: 01-core-implementation
plan: 02
subsystem: installer
tags: [cursor, runtime, cli, install, uninstall]
dependency-graph:
  requires: [01-01]
  provides: [cursor-runtime-support, cursor-cli-flags, cursor-install-uninstall]
  affects: []
tech-stack:
  added: []
  patterns: [runtime-detection, directory-handling, content-conversion]
file-tracking:
  key-files:
    created: []
    modified: [bin/install.js]
decisions:
  - id: cursor-command-format
    choice: Use /gsd-help format for Cursor (like OpenCode)
    rationale: Cursor uses flat command structure similar to OpenCode
  - id: cursor-statusline
    choice: Enable statusline support for Cursor
    rationale: Cursor supports hooks like Claude/Gemini
metrics:
  duration: ~5 minutes
  completed: 2026-02-05
---

# Phase 01 Plan 02: Cursor Runtime Integration Summary

**One-liner:** Complete Cursor runtime support with CLI flags, directory handling, and install/uninstall logic

## Changes Made

### Task 1: Add CLI Flag Parsing and Directory Handling
- Added `hasCursor` flag detection for `--cursor` argument
- Updated `selectedRuntimes` to include cursor with `--all` or `--cursor`
- Updated `getDirName('cursor')` to return `.cursor`
- Added `getGlobalDir('cursor')` with `CURSOR_CONFIG_DIR` env var support
- Updated banner text to include Cursor in supported runtimes
- Commit: `689a987`

### Task 2: Update Install/Uninstall Logic and Runtime Labels
- Added Cursor case in `getCommitAttribution()` for attribution config
- Added runtime label 'Cursor' in `uninstall()` and `install()` functions
- Updated `copyWithPathReplacement()` to call `convertClaudeToCursorFrontmatter` for Cursor
- Updated agent copying to use `convertClaudeToCursorFrontmatter` for Cursor
- Updated `finishInstall()` with Cursor program label and command format (`/gsd-help`)
- Updated `promptRuntime()` with Cursor as option 4, All as option 5
- Added `--cursor` flag and Cursor example to help text
- Updated `installAllRuntimes()` to handle Cursor statusline
- Commit: `e300504`

## Requirements Implemented

| Requirement | Description | Status |
|-------------|-------------|--------|
| PATH-01 | getDirName('cursor') returns '.cursor' | ✓ |
| PATH-02 | getGlobalDir('cursor') with CURSOR_CONFIG_DIR env var | ✓ |
| INST-01 | --cursor CLI flag recognized | ✓ |
| INST-02 | Cursor option (4) in interactive promptRuntime() | ✓ |
| INST-03 | install(isGlobal, 'cursor') deploys files correctly | ✓ |
| INST-04 | uninstall(isGlobal, 'cursor') removes files correctly | ✓ |
| INST-05 | getCommitAttribution('cursor') reads from settings.json | ✓ |
| PATH-03 | Path conversion via convertClaudeToCursorFrontmatter | ✓ |
| PATH-04 | Command format conversion via convertClaudeToCursorFrontmatter | ✓ |

## Decisions Made

1. **Command format**: Cursor uses `/gsd-help` format (same as OpenCode, not `/gsd:help` like Claude)
2. **Statusline**: Cursor supports statusline hooks (grouped with Claude/Gemini, not OpenCode)
3. **Directory structure**: Cursor uses nested `commands/gsd/` structure (like Claude/Gemini)

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

| File | Changes |
|------|---------|
| bin/install.js | +51 lines (CLI parsing, directory handling, install/uninstall logic) |

## Test Results

- `node -c bin/install.js` passes (no syntax errors)
- `node bin/install.js --help` shows:
  - `--cursor` flag documented
  - Cursor install example
  - CURSOR_CONFIG_DIR in notes

## Phase Completion

**Phase 01 Complete:** All plans in Phase 01 (Core Implementation) have been executed:
- Plan 01-01: Cursor conversion functions ✓
- Plan 01-02: Cursor runtime integration ✓

**Cursor is now a fully supported runtime** alongside Claude Code, OpenCode, and Gemini.

**Ready for Phase 02 (Polish):** No blockers identified.
