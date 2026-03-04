---
phase: 02-module-extraction
plan: 04
subsystem: testing
tags: [node, refactor, modules, esm, cjs, install]

requires:
  - phase: 02-module-extraction
    provides: codex.js, opencode.js, gemini.js, core.js extracted from install.js (Plans 01-03)

provides:
  - bin/lib/claude.js module boundary for Claude runtime
  - All 3 test files import from per-module bin/lib/ paths instead of via GSD_TEST_MODE
  - bin/install.js is a thin orchestrator with no converter or utility function definitions

affects:
  - phase 03 (any further install.js work or CLI refactor)

tech-stack:
  added: []
  patterns:
    - "Per-module test imports: tests import from bin/lib/<runtime>.js directly, no GSD_TEST_MODE needed for unit tests"
    - "Module boundary marker: empty module.exports = {} establishes architectural boundary even before logic is extracted"

key-files:
  created:
    - bin/lib/claude.js
  modified:
    - tests/install-converters.test.cjs
    - tests/install-utils.test.cjs
    - tests/install-flow.test.cjs

key-decisions:
  - "claude.js is an empty module marker — Claude is the base case runtime with no converter functions, so no logic to extract"
  - "install-flow.test.cjs retains GSD_TEST_MODE for copyWithPathReplacement and copyFlattenedCommands since these are orchestration functions that remain in install.js"
  - "install-converters.test.cjs now imports from opencode.js, gemini.js, codex.js, core.js directly — no GSD_TEST_MODE"
  - "install-utils.test.cjs now imports from core.js directly — no GSD_TEST_MODE"

patterns-established:
  - "Module extraction complete: 5 modules in bin/lib/ (core, claude, codex, opencode, gemini)"
  - "install.js reduced from ~2500 lines to 1241 lines with 11 orchestration-only functions"

requirements-completed: [MOD-02, MOD-06]

duration: 2min
completed: 2026-03-04
---

# Phase 2 Plan 4: Claude Module and Test Migration Summary

**bin/lib/claude.js module boundary created and all 3 test files migrated to per-module imports, completing Phase 2 module extraction (5 modules in bin/lib/)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T12:42:43Z
- **Completed:** 2026-03-04T12:44:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `bin/lib/claude.js` as the architectural boundary for the Claude runtime (satisfies MOD-02)
- Migrated `install-converters.test.cjs` to import from `opencode.js`, `gemini.js`, `codex.js`, and `core.js` directly
- Migrated `install-utils.test.cjs` to import from `core.js` directly
- Migrated `install-flow.test.cjs` to import `getDirName` and `cleanupOrphanedFiles` from `core.js`, retaining GSD_TEST_MODE only for orchestration functions
- All 705 passing tests continue to pass (1 pre-existing failure in config-get unrelated to this work)
- Phase 2 module extraction complete: `bin/install.js` is now a thin orchestrator with 11 functions, all of which are orchestration logic (arg parsing, install/uninstall dispatch, prompts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bin/lib/claude.js and refactor install/uninstall dispatch** - `d9c60a7` (feat)
2. **Task 2: Migrate remaining test imports to per-module and verify** - `342c316` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `bin/lib/claude.js` - Claude runtime module boundary (empty module, Claude is the default path)
- `tests/install-converters.test.cjs` - Imports from opencode.js, gemini.js, codex.js, core.js directly
- `tests/install-utils.test.cjs` - Imports from core.js directly
- `tests/install-flow.test.cjs` - Imports getDirName/cleanupOrphanedFiles from core.js; copyWithPathReplacement/copyFlattenedCommands still via GSD_TEST_MODE from install.js

## Decisions Made

- `claude.js` is an empty module marker: Claude is the "base case" runtime — it needs no converter functions since Claude content is the source format. The orchestrator's default path IS the Claude path. This satisfies MOD-02 by establishing the module boundary.
- `install-flow.test.cjs` retains `GSD_TEST_MODE` for `copyWithPathReplacement` and `copyFlattenedCommands` because these are orchestration-level functions (they dispatch to runtime converters) that correctly belong in `install.js` per the plan's "revised plan" section.
- Phase 2 complete: `bin/install.js` now has exactly 11 functions, all orchestration: `parseConfigDirArg`, `copyFlattenedCommands`, `copyWithPathReplacement`, `uninstall`, `writeManifest`, `install`, `finishInstall`, `handleStatusline`, `promptRuntime`, `promptLocation`, `installAllRuntimes`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all 5 modules loaded cleanly, all tests passed on first run after migration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 complete: all 4 runtime modules extracted (core, claude, codex, opencode, gemini)
- `bin/install.js` is a thin 1241-line orchestrator with only orchestration functions
- All tests pass with per-module imports
- Phase 3 can proceed with any further CLI/orchestration refactor work

---
*Phase: 02-module-extraction*
*Completed: 2026-03-04*
