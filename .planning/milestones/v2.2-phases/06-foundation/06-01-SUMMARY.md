---
phase: 06-foundation
plan: 01
subsystem: infra
tags: [child_process, execSync, cli-adapters, codex, gemini, opencode]

# Dependency graph
requires: []
provides:
  - "CLI adapter modules (codex, gemini, opencode) with common detect/invoke contract"
  - "Config template co_planners section with kill switch and timeout defaults"
affects: [06-02, co-planners-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [adapter-pattern, never-throw-contract, classifyError-mapping, structured-error-returns]

key-files:
  created:
    - get-shit-done/bin/adapters/codex.cjs
    - get-shit-done/bin/adapters/gemini.cjs
    - get-shit-done/bin/adapters/opencode.cjs
  modified:
    - get-shit-done/templates/config.json

key-decisions:
  - "Each adapter embeds classifyError inline rather than sharing a module -- keeps adapters self-contained with zero cross-dependencies"
  - "Default timeout 120000ms matches config template co_planners.timeout_ms -- single source of truth in config, adapters receive via parameter"
  - "Zero new npm dependencies -- uses only child_process, fs, path, os from Node.js stdlib"

patterns-established:
  - "Adapter contract: { detect, invoke, CLI_NAME } exports with never-throw guarantee"
  - "Error classification: SIGTERM->TIMEOUT, ENOENT/127->NOT_FOUND, 126->PERMISSION, else->EXIT_ERROR"
  - "Structured error returns: { text, cli, duration, exitCode, error, errorType }"
  - "Temp file pattern: write prompt to os.tmpdir(), pipe via cat, cleanup in finally block"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 6 Plan 01: CLI Adapters Summary

**Three CLI adapter modules (codex, gemini, opencode) with common detect/invoke contract and config template co_planners kill switch**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T23:00:01Z
- **Completed:** 2026-02-16T23:02:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created three CLI adapter modules in `get-shit-done/bin/adapters/` each exporting `detect()`, `invoke(prompt, options)`, and `CLI_NAME`
- Implemented common classifyError mapping (SIGTERM->TIMEOUT, ENOENT/127->NOT_FOUND, 126->PERMISSION, else->EXIT_ERROR) across all adapters
- Added Gemini-specific `sanitizeEnv` (removes DEBUG env var) and OpenCode-specific `extractOpenCodeResponse` (defensive JSON parsing) helpers
- Added `co_planners` section to config template with `enabled: false` kill switch and `timeout_ms: 120000` default

## Task Commits

Each task was committed atomically:

1. **Task 1: Create adapter modules with shared classifyError helper** - `51bff88` (feat)
2. **Task 2: Add co_planners section to config template** - `45dd97e` (feat)

## Files Created/Modified
- `get-shit-done/bin/adapters/codex.cjs` - Codex CLI adapter with detect, invoke, piped stdin via cat
- `get-shit-done/bin/adapters/gemini.cjs` - Gemini CLI adapter with detect, invoke, sanitizeEnv, JSON response parsing
- `get-shit-done/bin/adapters/opencode.cjs` - OpenCode adapter with detect, invoke, extractOpenCodeResponse, stderr-tolerant
- `get-shit-done/templates/config.json` - Added co_planners section between adversary and gates

## Decisions Made
- Each adapter embeds classifyError inline rather than sharing a module -- keeps adapters self-contained with zero cross-dependencies
- Default timeout 120000ms matches config template co_planners.timeout_ms -- single source of truth in config, adapters receive via parameter
- Zero new npm dependencies -- uses only child_process, fs, path, os from Node.js stdlib

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three adapter modules ready for Plan 02 integration via `require('./adapters/{cli}.cjs')`
- Config template has co_planners section for Plan 02 to read `config.co_planners.timeout_ms` and `config.co_planners.enabled`
- Integration contract established: each adapter exports `{ detect, invoke, CLI_NAME }` with never-throw guarantee

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 06-foundation*
*Completed: 2026-02-16*
