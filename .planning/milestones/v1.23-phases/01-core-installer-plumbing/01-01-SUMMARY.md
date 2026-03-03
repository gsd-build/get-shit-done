---
phase: 01-core-installer-plumbing
plan: 01
subsystem: cli
tags: [nodejs, cli, installer, copilot, runtime, multi-runtime]

# Dependency graph
requires: []
provides:
  - "Copilot as 5th selectable runtime in GSD installer CLI"
  - "getDirName('copilot') → .github (local path)"
  - "getGlobalDir('copilot') → ~/.copilot (global path) with COPILOT_CONFIG_DIR override"
  - "getConfigDirFromHome('copilot') for both local and global"
  - "Test exports: getDirName, getGlobalDir, getConfigDirFromHome"
affects: [02-content-conversion, 03-instructions-lifecycle, 04-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [copilot-skip-hooks-like-codex, copilot-different-local-global-paths-like-opencode]

key-files:
  created:
    - tests/copilot-install.test.cjs
  modified:
    - bin/install.js

key-decisions:
  - "Copilot local path is .github/ (getDirName), global path is ~/.copilot/ (getGlobalDir)"
  - "Copilot skips hooks and settings.json — follows Codex pattern"
  - "Copilot early return in install() before hooks/settings configuration"
  - "COPILOT_CONFIG_DIR env var support for global directory override"
  - "Copilot command format uses /gsd-new-project (same as OpenCode)"
  - "Interactive prompt: Copilot is option 5, All renumbered to option 6"

patterns-established:
  - "Copilot skip-hooks pattern: if (!isCodex && !isCopilot) for hooks/settings"
  - "Different local/global paths: getDirName returns .github, getGlobalDir returns ~/.copilot"
  - "GSD_TEST_MODE exports include plumbing functions for testing"

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06]

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 1 Plan 1: Core Installer Plumbing Summary

**Copilot as 5th runtime across ~22 install.js locations with .github local, ~/.copilot global, skip-hooks pattern, and 19 plumbing tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-02T23:25:34Z
- **Completed:** 2026-03-02T23:31:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added Copilot as 5th runtime across all 22 runtime-aware locations in bin/install.js
- Copilot supports both local (.github/) and global (~/.copilot/) installations with COPILOT_CONFIG_DIR env var override
- Copilot skips hooks and settings.json (Codex pattern), returns early from install()
- Interactive prompt updated: Copilot is option 5, All renumbered to option 6
- 19 new unit tests covering directory resolution, config paths, and source code integration
- All 481 tests pass (19 new + 462 existing, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Copilot as 5th runtime across all install.js locations** - `8fa3a73` (feat)
2. **Task 2: Create Copilot plumbing unit tests** - `1975792` (test)

## Files Created/Modified
- `bin/install.js` - Added Copilot as 5th runtime: arg parsing, getDirName, getGlobalDir, getConfigDirFromHome, banner, help text, install(), finishInstall(), uninstall(), promptRuntime(), test exports
- `tests/copilot-install.test.cjs` - 19 unit tests for Copilot plumbing: getDirName, getGlobalDir (5 tests incl env var), getConfigDirFromHome, source code integration checks

## Decisions Made
- Used `/gsd-new-project` command format for Copilot (same as OpenCode) — actual Copilot skill invocation syntax TBD in Phase 2
- Added COPILOT_CONFIG_DIR env var support for consistency with CLAUDE_CONFIG_DIR and CODEX_HOME patterns
- Copilot content in Phase 1 installs in default (Claude) format — Phase 2 adds Copilot-specific conversion
- No Copilot-specific agent conversion in Phase 1 — falls through to default path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Copilot is selectable via `--copilot`, `--all`, and interactive prompt (option 5)
- getDirName, getGlobalDir, getConfigDirFromHome all handle 'copilot' runtime
- install() and finishInstall() handle Copilot with skip-hooks early-return pattern
- Test exports available for Phase 2 testing via GSD_TEST_MODE
- Ready for Phase 1 Plan 2 (content conversion) and Phase 3 (instructions/lifecycle)

---
*Phase: 01-core-installer-plumbing*
*Completed: 2026-03-02*

## Self-Check: PASSED
- All created files exist (bin/install.js, tests/copilot-install.test.cjs, 01-01-SUMMARY.md)
- All commits verified (8fa3a73, 1975792)
- Test file meets minimum line requirement (172 lines > 50 min)
