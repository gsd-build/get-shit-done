---
phase: 01-auto-mode-foundation
plan: 08
subsystem: routing
tags: auto-mode, model-selection, quota-aware, routing, gsd-tools

# Dependency graph
requires:
  - phase: 01-07
    provides: selectModelFromRules() with complexity scoring (computeComplexityScore)
  - phase: 01-03
    provides: loadQuotaState() and quota tracking infrastructure
provides:
  - selectModelFromRulesWithQuota() function applying quota pressure downgrade ladder
  - routing match-with-quota CLI subcommand in both gsd-tools.js copies
affects: [auto-mode, gsd-phase-coordinator, sub-coordinator, execute-plan]

# Tech tracking
tech-stack:
  added: []
  patterns: [quota-aware-routing, downgrade-ladder, quota-pressure-passthrough]

key-files:
  created: []
  modified:
    - ~/.claude/get-shit-done/bin/gsd-tools.js
    - /Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js

key-decisions:
  - "quota-aware routing wraps selectModelFromRules() without modifying it — clean separation of concerns"
  - "Downgrade ladder: >80% quota downgrades opus to sonnet; >95% downgrades opus/sonnet to haiku"
  - "quota_adjusted field differentiates adjusted from non-adjusted selections for observability"
  - "No quota state or zero limit passes through unchanged — safe default for missing quota data"

patterns-established:
  - "selectModelFromRulesWithQuota returns quota_adjusted bool + quota_percent for coordinator observability"
  - "Thin wrapper pattern: new capability wraps existing function without modifying its signature"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 1 Plan 8: Quota-Aware Model Selection Summary

**selectModelFromRulesWithQuota() wraps plan 07's complexity scoring with quota pressure downgrade ladder — opus to sonnet at >80%, all to haiku at >95%**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T08:26:23Z
- **Completed:** 2026-02-18T08:28:38Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `selectModelFromRulesWithQuota()` function implemented — reads quota state and applies downgrade ladder on top of complexity score
- `cmdRoutingMatchWithQuota()` function implemented — loads quota state from disk and calls quota-aware selection
- `routing match-with-quota` subcommand registered in both gsd-tools.js copies
- Original `selectModelFromRules()` and `routing match` completely unchanged — no regression
- `quota_adjusted: true/false` and `quota_percent` fields included in all responses for coordinator observability

## Task Commits

Each task was committed atomically:

1. **Task 1: Add selectModelFromRulesWithQuota() and routing match-with-quota** - `ed90295` (feat)

## Files Created/Modified

**Modified (project copy + installed copy):**
- `/Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js` - Added `selectModelFromRulesWithQuota()`, `cmdRoutingMatchWithQuota()`, `match-with-quota` subcommand
- `~/.claude/get-shit-done/bin/gsd-tools.js` - Mirror of above (identical code)

**Key additions per file:**
- `selectModelFromRulesWithQuota(taskDesc, rules, quotaState)` — returns base selection with quota adjustment applied
- `cmdRoutingMatchWithQuota(cwd, taskDesc, raw)` — CLI handler reading quota state from disk
- `match-with-quota` case in routing subcommand switch
- Updated error message listing `match-with-quota` as available subcommand

## Decisions Made

1. **Thin wrapper pattern:** `selectModelFromRulesWithQuota` calls `selectModelFromRules` first, then applies quota adjustment. This avoids duplicating complexity scoring logic and means quota logic can be added/changed independently of routing rule logic.

2. **quota_adjusted flag:** Added to all responses (true when downgraded, false when below thresholds). Coordinators can detect quota adjustments without parsing the reason string.

3. **Zero-limit passthrough:** When `tokens_limit === 0` (quota tracking not yet seeded), function returns base selection unchanged. Prevents breaking routing when quota data is missing at session start.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing dotenv dependency missing from installed copy (`~/.claude/get-shit-done/bin/gsd-tools.js`) prevents direct execution via `node`. This is a pre-existing environment issue documented in 01-07-SUMMARY.md. Verification was performed against the project copy which has identical code. Code correctness confirmed by: (1) grep verification that all 4 expected references exist in the installed copy, and (2) successful execution of the project copy.

## Next Phase Readiness

AUTO-09 requirement satisfied: quota state is read and applied to model selection.

- `selectModelFromRulesWithQuota()` available for coordinators to call (e.g., gsd-phase-coordinator, sub-coordinator)
- Both gsd-tools.js copies identical and ready
- Downgrade ladder covers both warning (>80%) and critical (>95%) quota thresholds
- No changes to existing routing interface — existing callers unaffected

---
*Phase: 01-auto-mode-foundation*
*Completed: 2026-02-18*

## Self-Check: PASSED

**Files verified:**
- `/Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js` - FOUND
- `/Users/ollorin/.claude/get-shit-done/bin/gsd-tools.js` - FOUND
- `.planning/phases/01-auto-mode-foundation/01-08-SUMMARY.md` - FOUND

**Commits verified:**
- ed90295: feat(01-08): add selectModelFromRulesWithQuota() and routing match-with-quota - FOUND

**Commands verified:**
- `routing match-with-quota "fix typo"` → model: haiku, quota_adjusted: false, quota_percent: 0.26% ✓
- `routing match-with-quota "design distributed caching"` → model: sonnet, quota_adjusted: false ✓
- `routing match "implement authentication"` → original response without quota fields (no regression) ✓
- `selectModelFromRulesWithQuota` count in project copy: 2 ✓
- `selectModelFromRulesWithQuota` count in installed copy: 2 ✓
- `match-with-quota` subcommand registered in both files ✓
