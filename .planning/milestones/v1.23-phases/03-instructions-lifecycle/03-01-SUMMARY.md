---
phase: 03-instructions-lifecycle
plan: 01
subsystem: installer
tags: [copilot, instructions, merge, uninstall, manifest, patches]

# Dependency graph
requires:
  - phase: 02-content-conversion-engine
    provides: Copilot skill/agent conversion and copyCommandsAsCopilotSkills
provides:
  - mergeCopilotInstructions() — 3-case marker-based merge for copilot-instructions.md
  - stripGsdFromCopilotInstructions() — marker-based strip with delete-if-empty signal
  - Copilot uninstall branch — skills removal + instructions cleanup
  - writeManifest Copilot skills hashing
  - reportLocalPatches Copilot command format fix
affects: [03-02 testing plan, future Copilot lifecycle work]

# Tech tracking
tech-stack:
  added: []
  patterns: [paired HTML comment markers for markdown section management, null-return signal for file deletion]

key-files:
  created:
    - get-shit-done/templates/copilot-instructions.md
  modified:
    - bin/install.js

key-decisions:
  - "Copilot instructions use paired markers (open + close) unlike Codex single-marker-to-EOF pattern"
  - "Added !isCopilot to commands/gsd/ hashing exclusion in writeManifest for correctness"

patterns-established:
  - "Paired marker pattern: <!-- GSD Configuration — managed by get-shit-done installer --> / <!-- /GSD Configuration --> for markdown sections"
  - "Null-return signal from strip function indicates file should be deleted (matching Codex pattern)"

requirements-completed: [INST-01, INST-02, LIFE-01, LIFE-02, LIFE-03]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 3 Plan 1: Instructions Lifecycle Summary

**Copilot instructions merge/strip with marker-based content management, uninstall skills cleanup, manifest hashing fix, and patch reporting fix**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T13:30:43Z
- **Completed:** 2026-03-03T13:36:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `copilot-instructions.md` template with 5 GSD instruction bullets
- Implemented `mergeCopilotInstructions()` with 3-case merge (create, replace, append) using paired HTML comment markers
- Implemented `stripGsdFromCopilotInstructions()` with null-return for GSD-only content (delete signal)
- Wired instructions generation into `install()` before Copilot early return
- Fixed uninstall: added `isCopilot` branch to properly remove `skills/gsd-*/` and clean `copilot-instructions.md`
- Fixed `writeManifest()` to hash Copilot skills with `(isCodex || isCopilot)` condition
- Fixed `writeManifest()` to exclude `commands/gsd/` hashing for Copilot with `!isCopilot`
- Fixed `reportLocalPatches()` to show `/gsd-reapply-patches` for Copilot (not Claude's `/gsd:reapply-patches`)
- All 527 existing tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create template + add merge/strip functions with marker constants** - `5de9d4f` (feat)
2. **Task 2: Wire install, fix uninstall, fix manifest, fix patches, update exports** - `7cbf1a5` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `get-shit-done/templates/copilot-instructions.md` - GSD instructions template (5 bullets, no markers)
- `bin/install.js` - Added marker constants, mergeCopilotInstructions(), stripGsdFromCopilotInstructions(), wired install/uninstall/manifest/patches fixes, updated exports

## Decisions Made
- Used paired HTML comment markers (`<!-- GSD Configuration — managed by get-shit-done installer -->` / `<!-- /GSD Configuration -->`) instead of Codex single-marker-to-EOF pattern — cleaner for markdown where content can exist after the GSD section
- Added `!isCopilot` to `commands/gsd/` hashing exclusion in `writeManifest()` — not strictly required (fs.existsSync guard handles it) but improves correctness/clarity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added !isCopilot to commands/gsd/ hashing exclusion in writeManifest**
- **Found during:** Task 2 (writeManifest fix)
- **Issue:** The `commands/gsd/` hashing at line 2009 excluded OpenCode and Codex but not Copilot. While `fs.existsSync` prevents incorrect hashing, the condition should explicitly exclude Copilot for clarity.
- **Fix:** Changed `!isOpencode && !isCodex` to `!isOpencode && !isCodex && !isCopilot`
- **Files modified:** bin/install.js
- **Verification:** Syntax check + full test suite pass
- **Committed in:** 7cbf1a5

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor correctness improvement, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All merge/strip functions exported via GSD_TEST_MODE for test coverage in Plan 2
- Instructions lifecycle is complete: generate on install, clean on uninstall, track in manifest, report patches
- Ready for Plan 2: comprehensive test suite for all Phase 3 functionality

---
*Phase: 03-instructions-lifecycle*
*Completed: 2026-03-03*

## Self-Check: PASSED

All files exist, all commits verified, all functions present in bin/install.js.
