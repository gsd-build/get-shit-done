---
phase: 06-alignment-performance
plan: 01
subsystem: api
tags: [drift-detection, occurrence-checks, performance-scoring, renegotiation, archive]

requires:
  - phase: 05-integrity-system
    provides: isCompleted, integrity statuses, verify-milestone pattern
provides:
  - findOrphans convenience function on engine.js
  - FUTURE-ARCHIVE.md parse/write/append support
  - check-drift command with contextual reconnection suggestions
  - check-occurrence command with declaration context for AI assessment
  - compute-performance command with per-declaration and rollup labels
  - renegotiate command with archive flow and orphan detection
affects: [06-alignment-performance]

tech-stack:
  added: []
  patterns: [qualitative-labels-only, archive-append-pattern, orphan-suggestion-pattern]

key-files:
  created:
    - src/commands/check-drift.js
    - src/commands/check-occurrence.js
    - src/commands/compute-performance.js
    - src/commands/renegotiate.js
  modified:
    - src/graph/engine.js
    - src/artifacts/future.js
    - src/declare-tools.js
    - dist/declare-tools.cjs

key-decisions:
  - "findOrphans is a standalone exported function wrapping validate() orphan filtering, matching isCompleted pattern"
  - "Performance uses qualitative labels only (HIGH/MEDIUM/LOW), never numeric scores"
  - "Renegotiation writes FUTURE-ARCHIVE.md and identifies milestones orphaned by single-declaration dependency"
  - "check-occurrence returns raw data for AI assessment, no scoring in CJS layer"

patterns-established:
  - "Archive append pattern: parse existing, push new entry, rewrite (no manual string concat)"
  - "Suggestion pattern: contextual reconnection suggestions limited to 3 per orphan"

requirements-completed: [ALGN-01, ALGN-02, ALGN-03, ALGN-04]

duration: 3min
completed: 2026-02-17
---

# Plan 06-01: CJS Data Layer Summary

**Four alignment/performance commands (check-drift, check-occurrence, compute-performance, renegotiate) with FUTURE-ARCHIVE.md support and findOrphans engine helper**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17
- **Completed:** 2026-02-17
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- findOrphans wraps validate() to return filtered orphan array with full node data
- FUTURE-ARCHIVE.md has complete parse/write/append lifecycle support
- check-drift returns orphaned nodes with up to 3 contextual reconnection suggestions each
- check-occurrence gathers declaration context (milestones, action summaries) for AI assessment
- compute-performance returns per-declaration alignment x integrity as HIGH/MEDIUM/LOW with project rollup
- renegotiate archives declaration, marks RENEGOTIATED, identifies transitively orphaned milestones

## Task Commits

Each task was committed atomically:

1. **Task 1: findOrphans, archive support, check-drift, check-occurrence** - `e1ac5b8` (feat)
2. **Task 2: compute-performance, renegotiate, declare-tools registration, bundle** - `fae6d61` (feat)

## Files Created/Modified
- `src/graph/engine.js` - Added findOrphans convenience function
- `src/artifacts/future.js` - Added parseFutureArchive, writeFutureArchive, appendToArchive
- `src/commands/check-drift.js` - Orphan detection with contextual suggestions
- `src/commands/check-occurrence.js` - Declaration context for AI occurrence assessment
- `src/commands/compute-performance.js` - Per-declaration and rollup performance computation
- `src/commands/renegotiate.js` - Archive + replace declaration flow
- `src/declare-tools.js` - Registered four new subcommands
- `dist/declare-tools.cjs` - Rebuilt bundle

## Decisions Made
- findOrphans is exported standalone (not a class method) matching isCompleted pattern
- Performance labels are qualitative only: HIGH >= 0.8, MEDIUM >= 0.5, LOW < 0.5 for alignment; integrity uses broken/verified ratios
- check-occurrence returns raw data; AI assessment happens in slash command layer
- Renegotiation detects orphans by checking milestones that realize ONLY the archived declaration

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- All four CJS commands return structured JSON for slash command consumption
- Plan 06-02 can wire drift checks into execute.md, occurrence checks at milestone completion, and performance into status.md

---
*Plan: 06-01-alignment-performance*
*Completed: 2026-02-17*
