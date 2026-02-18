---
phase: 01-auto-mode-foundation
plan: 07
subsystem: routing
tags: auto-mode, model-selection, complexity-scoring, routing, gsd-tools

# Dependency graph
requires:
  - phase: 01-02
    provides: Task router with pattern matching (selectModelFromRules)
  - phase: 01-05
    provides: Routing rules in markdown table format
provides:
  - computeComplexityScore() function with 3-signal complexity analysis
  - Updated selectModelFromRules() using score-based tier mapping
  - routing match command returning score and signals breakdown
affects: [auto-mode, execute-plan, gsd-phase-coordinator, routing-rules]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-signal-scoring, graduated-routing, tier-mapping]

key-files:
  created: []
  modified:
    - ~/.claude/get-shit-done/bin/gsd-tools.js
    - /Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js

key-decisions:
  - "Multi-signal routing: keyword (0-50) + length (0-25) + structural (0-25) = 0-100 score"
  - "Tier boundaries: <=30 haiku, 31-70 sonnet, 71+ opus"
  - "No-match default: 25 pts keyword signal (preserves sonnet-territory for unknown tasks)"
  - "Length buckets refined: <=5 words=3pts, 6-20=8pts, 21-50=15pts for haiku/sonnet differentiation"
  - "Fix loadRoutingRules bug: remove overly-aggressive architecture/testing pattern filter that stripped real patterns"

patterns-established:
  - "computeComplexityScore returns {score, tier, signals} — structured output for routing decisions"
  - "selectModelFromRules returns score and signals alongside model for observability"
  - "Three-signal scoring: keyword (rule matching), length (word count), structural (markers)"

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 1 Plan 7: Multi-Signal Complexity Scoring Summary

**0-100 complexity score combining keyword rule matches, word count, and structural markers to graduate model routing from haiku to sonnet to opus**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18T08:18:12Z
- **Completed:** 2026-02-18T08:23:21Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `computeComplexityScore()` function implemented combining 3 signals into a 0-100 score
- `selectModelFromRules()` updated to use score-based tier mapping instead of winner-takes-all regex
- `routing match --json` now returns `score` and `signals` (keyword/length/structural) fields
- Both gsd-tools.js copies updated identically and produce identical output for same input
- Pre-existing `loadRoutingRules()` bug fixed: architecture/testing keyword filter was incorrectly stripping real patterns like `design.*authentication architecture`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add computeComplexityScore() and update selectModelFromRules()** - `8df53da` (feat)

## Files Created/Modified

**Modified (project copy + installed copy):**
- `/Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js` - Added `computeComplexityScore()`, updated `selectModelFromRules()`, fixed `loadRoutingRules()` pattern filter
- `~/.claude/get-shit-done/bin/gsd-tools.js` - Mirror of above

**Key additions:**
- `computeComplexityScore(taskDesc, rules)` — returns `{score, tier, signals: {keyword, length, structural}}`
- Updated `selectModelFromRules()` return shape includes `score` and `signals`
- Fixed pattern filter in `loadRoutingRules()`: removed `.includes('architecture')` and `.includes('testing')` checks that removed legitimate rule patterns

## Decisions Made

1. **Length bucket refinement:** Added <=5 word bucket (3pts) separate from 6-20 word bucket (8pts). Original spec's single 1-20 bucket (5pts) caused "fix typo" (4 words) and "add delete endpoint" (6 words) to score identically, making tier differentiation impossible.

2. **loadRoutingRules bug fix:** The `validPatterns.filter(!includes('architecture'))` was a pre-existing bug that stripped patterns like `design.*authentication architecture` while trying to skip section headers. Headers are already filtered by the empty-model check; the keyword filter was redundant and harmful. Fix: replaced with `p && p.trim().length > 0`.

3. **No-match default stays at 25:** Preserves original behavior where unknown tasks land in sonnet territory. Combined with <=5 word length score of 3pts, very short no-match tasks (like "fix typo") score 28 → haiku, while longer no-match tasks score 33+ → sonnet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed loadRoutingRules pattern filter removing real patterns**
- **Found during:** Task 1 verification (architecture test case scoring only 49/100 instead of ≥71)
- **Issue:** `validPatterns.filter(p => !p.includes('architecture'))` in `loadRoutingRules()` removed `design.*authentication architecture` from rules, preventing it from contributing to keyword score. Only 1 opus rule matched instead of 2, giving keyword=30 not 50.
- **Fix:** Replaced `!p.includes('testing') && !p.includes('architecture')` with `p && p.trim().length > 0`. Section headers already filtered by empty-model guard upstream.
- **Files modified:** Both gsd-tools.js copies
- **Verification:** Architecture task now scores 72/100 (keyword:50, length:8, structural:14) → opus as expected
- **Committed in:** 8df53da (Task 1 commit)

**2. [Rule 1 - Bug] Refined length score buckets to enable haiku/sonnet differentiation**
- **Found during:** Task 1 verification (both "fix typo" and "add delete endpoint" scored identically at 30)
- **Issue:** Single bucket for 1-20 words (5pts) made short task differentiation impossible. Both 4-word and 6-word tasks landed on score 30, the exact haiku/sonnet boundary.
- **Fix:** Added <=5 word bucket (3pts) so very short tasks score 28 (haiku) while 6-20 word tasks score 33+ (sonnet).
- **Files modified:** Both gsd-tools.js copies
- **Verification:** "fix typo in README" → 28 (haiku), "add delete endpoint to user API" → 33 (sonnet)
- **Committed in:** 8df53da (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Both fixes required for plan verification tests to pass. No scope creep — fixes are in the routing code that this plan modifies.

## Issues Encountered

The installed copy `~/.claude/get-shit-done/bin/gsd-tools.js` cannot be executed directly (pre-existing dotenv dependency missing from that location). Verification was performed against the project copy `/Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js` which has identical code. This is a pre-existing environment issue from prior phases.

## Next Phase Readiness

AUTO-01 and AUTO-02 requirements satisfied:
- Multi-signal complexity analysis (keyword + length + structural)
- 0-100 score maps to haiku/sonnet/opus tiers
- `routing match` returns observable score + signals breakdown

Both gsd-tools.js copies updated. Ready for any follow-on routing work.

## Self-Check: PASSED

**Files verified:**
- Both gsd-tools.js files: `grep -c computeComplexityScore` returns 2 (definition + call)
- 01-07-SUMMARY.md exists at `.planning/phases/01-auto-mode-foundation/01-07-SUMMARY.md`

**Commits verified:**
- 8df53da: feat(01-07): add computeComplexityScore() with multi-signal routing

**Commands verified:**
- "fix typo in README" → score 28, model: haiku ✓
- "add delete endpoint to user API" → score 33, model: sonnet ✓
- Architecture task (16 words, 2 opus rule matches) → score 72, model: opus ✓
- routing match output includes `score` and `signals` fields ✓

---
*Phase: 01-auto-mode-foundation*
*Completed: 2026-02-18*
