---
phase: 06-foundation
plan: 02
subsystem: infra
tags: [cli-integration, gsd-tools, coplanner, kill-switch, adapter-pattern]

# Dependency graph
requires:
  - "06-01: CLI adapter modules (codex, gemini, opencode) with detect/invoke contract"
provides:
  - "coplanner command group in gsd-tools.cjs (detect, invoke, enabled subcommands)"
  - "Kill switch with env > config > default precedence chain"
  - "Adapter directory installation verified for all runtimes"
affects: [co-planners-workflows, plan-phase-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [command-group-pattern, kill-switch-precedence, adapter-loading]

key-files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - .planning/config.json

key-decisions:
  - "Used existing --raw convention instead of introducing new --json flag -- consistent with all other gsd-tools.cjs commands"
  - "Kill switch defaults to false (disabled) -- co-planners are opt-in until workflows explicitly enable them"
  - "No install.js changes needed -- existing recursive copyWithPathReplacement already handles adapters/ subdirectory"

patterns-established:
  - "Command group pattern: coplanner case with subcommand switch (detect, invoke, enabled)"
  - "Kill switch precedence: GSD_CO_PLANNERS env var > config.json co_planners.enabled > default false"
  - "loadAdapter pattern: require() from adapters/ directory with null return on missing file"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 6 Plan 02: CLI Integration Summary

**Coplanner command group (detect, invoke, enabled) wired into gsd-tools.cjs with kill switch precedence chain and verified adapter installation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T23:04:16Z
- **Completed:** 2026-02-16T23:07:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `coplanner` command group to gsd-tools.cjs with three subcommands: `detect`, `invoke`, `enabled`
- Implemented kill switch with full precedence chain: `GSD_CO_PLANNERS` env var > `config.json co_planners.enabled` > default `false`
- Detection outputs both JSON (default) and human-readable table (`--raw`) consistent with existing gsd-tools.cjs convention
- Verified install.js correctly copies adapters/ directory -- all three .cjs files present in installed location
- Verified end-to-end: installed gsd-tools.cjs -> loadAdapter() -> adapter files -> detect/invoke working

## Task Commits

Each task was committed atomically:

1. **Task 1: Add coplanner command group to gsd-tools.cjs** - `494b29d` (feat)
2. **Task 2: Verify install.js handles adapters/ directory** - No commit (verification-only task, no code changes needed)

## Files Created/Modified
- `get-shit-done/bin/gsd-tools.cjs` - Added SUPPORTED_CLIS, loadAdapter(), checkKillSwitch() helpers; cmdCoplannerDetect, cmdCoplannerInvoke, cmdCoplannerEnabled commands; coplanner case in CLI router; updated usage header
- `.planning/config.json` - Added co_planners section with enabled: false and timeout_ms: 120000

## Decisions Made
- Used existing `--raw` convention instead of introducing new `--json` flag -- consistent with all other gsd-tools.cjs commands (JSON is default, `--raw` gives human-readable text)
- Kill switch defaults to `false` (disabled) -- co-planners are opt-in, users/workflows must explicitly enable
- No install.js changes needed -- existing `copyWithPathReplacement` recursion already handles the `adapters/` subdirectory within `get-shit-done/bin/`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 6 foundation infrastructure complete: adapter modules (Plan 01) + CLI integration (Plan 02)
- Three requirements satisfied: INFRA-01 (adapter modules), INFRA-02 (config kill switch), CORE-03 (CLI detection)
- Ready for workflow integration: co-planners can be invoked via `gsd-tools.cjs coplanner invoke <cli> --prompt "..."` from any workflow/agent
- Kill switch provides safe opt-in: workflows can check `gsd-tools.cjs coplanner enabled` before attempting invocation

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 06-foundation*
*Completed: 2026-02-16*
