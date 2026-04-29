---
phase: 02-sdk-query-handlers
plan: 01
subsystem: testing
tags: [vitest, typescript, sdk, sme, query-handlers]

requires:
  - phase: 01-schema-config
    provides: "workflow.use_sme_agents config flag, loadConfig, SME document template with frontmatter shape"

provides:
  - "smeList QueryHandler: lists all SME documents from .planning/smes/ with frontmatter metadata"
  - "smeDetectProcesses QueryHandler: matches SME processes against file paths and goal keywords"
  - "smeContextBlock QueryHandler: produces XML context block from SME document for agent prompt injection"
  - "Comprehensive unit test suite (19 tests) covering SDK-01, SDK-02, SDK-03 behaviors"

affects:
  - "phases that inject SME context into agent prompts"
  - "plan-phase gate integration (future phases 5-9)"
  - "discuss-phase SME question injection"

tech-stack:
  added: []
  patterns:
    - "TDD with tmp-dir fixture isolation: unique dirs per test via Date.now() + Math.random() for parallelism safety"
    - "Config guard pattern: loadConfig in try/catch, return disabled result on throw or when flag is off"
    - "Null-coalesce all frontmatter fields to prevent throw on malformed/incomplete SME documents"
    - "finding_counts coercion: extractFrontmatter returns nested values as strings; Number() coercion at handler boundary"
    - "Case-insensitive file matching: both sides of comparison lowercased including suffix constant"

key-files:
  created:
    - sdk/src/query/sme.ts
    - sdk/src/query/sme.test.ts
  modified: []

key-decisions:
  - "finding_counts values coerced to Number() at the smeList handler boundary because extractFrontmatter returns all YAML values as strings"
  - "smeContextBlock uses full file content (frontmatter + body) in XML block — downstream agents parse what they need (T-02-02: no escaping needed, SME docs are author-created)"
  - "Case-insensitive suffix matching in smeContextBlock: both f.toLowerCase() and suffix constant lowercased to handle mixed-case filenames"
  - "smeDetectProcesses match_source: 'both' when file path AND keyword both match, deduplicated to one entry per process"

patterns-established:
  - "QueryHandler config guard: loadConfig in try/catch at handler start, return {enabled:false} on any config error"
  - "SME_SUFFIX constant for *-SME.md — filter applied before sort for consistent behavior"
  - "parseDetectArgs private function for --file-paths / --goal arg parsing with inner while-loop for multi-value collection"

requirements-completed: [SDK-01, SDK-02, SDK-03]

duration: 10min
completed: 2026-04-29
---

# Phase 02 Plan 01: SME Query Handlers Summary

**Three TypeScript QueryHandler functions (smeList, smeDetectProcesses, smeContextBlock) implementing the SME data access layer with 19 unit tests covering all SDK-01/02/03 behaviors**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-29T18:30:00Z
- **Completed:** 2026-04-29T18:40:18Z
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 2

## Accomplishments

- Implemented `smeList` (SDK-01): reads `*-SME.md` files from `.planning/smes/`, extracts frontmatter, sorts alphabetically, respects `use_sme_agents` feature flag
- Implemented `smeDetectProcesses` (SDK-02): case-insensitive process name matching against file paths and goal keywords with `match_source: 'file-path' | 'keyword' | 'both'` deduplication
- Implemented `smeContextBlock` (SDK-03): produces `<sme_context process="..." block_mode="...">` XML block wrapping full document content for agent prompt injection
- 19 unit tests with tmp-dir isolation passing GREEN on all three handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for all three SME query handlers** - `d8f108fe` (test)
2. **Task 2: Implement all three SME query handlers to pass tests** - `772d0fb4` (feat)

## Files Created/Modified

- `sdk/src/query/sme.ts` - Three QueryHandler exports: smeList, smeDetectProcesses, smeContextBlock with arg parsing helper
- `sdk/src/query/sme.test.ts` - 19 unit tests across three describe blocks covering all SDK-01/02/03 behaviors

## Decisions Made

- `finding_counts` coerced to `Number()` at handler boundary — `extractFrontmatter` returns all YAML values as strings including nested numeric fields; coercion ensures consistent numeric API output
- Both sides of case-insensitive file match lowercased: `f.toLowerCase() === processName.toLowerCase() + suffix.toLowerCase()` — the suffix constant `-SME.md` contains uppercase letters that broke naive one-sided lowercasing
- Full file content (frontmatter + body) included in XML context block — downstream agents extract what they need; no escaping applied (T-02-02: SME docs are author-created project files at same trust level as PLAN.md)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed case-insensitive suffix comparison in smeContextBlock**
- **Found during:** Task 2 (GREEN phase, test debugging)
- **Issue:** `files.find(f => f.toLowerCase() === processName.toLowerCase() + SME_SUFFIX)` — `SME_SUFFIX = '-SME.md'` was not lowercased, so `'payments-sme.md' !== 'payments-SME.md'`; file was never found
- **Fix:** Computed `targetSuffix = SME_SUFFIX.toLowerCase()` before the comparison
- **Files modified:** sdk/src/query/sme.ts
- **Verification:** All 19 tests pass; smeContextBlock returns `found: true` for existing SME files
- **Committed in:** 772d0fb4 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed finding_counts returning strings instead of numbers**
- **Found during:** Task 2 (GREEN phase, first test run)
- **Issue:** `extractFrontmatter` returns nested YAML values as strings; test expected `blocker: 1` (number) but got `'1'` (string)
- **Fix:** Added `Number()` coercion for `blocker`, `warning`, `watch` fields in smeList handler
- **Files modified:** sdk/src/query/sme.ts
- **Verification:** smeList finding_counts fields are numbers; existing tests in other query handlers unaffected
- **Committed in:** 772d0fb4 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed test fixture for 'both' match_source case**
- **Found during:** Task 2 (GREEN phase, first test run)
- **Issue:** Test used goal `'update payment processing'` — `'payments'` (with s) is not a substring of `'payment'`; keyword match returned false making `match_source = 'file-path'` not `'both'`
- **Fix:** Changed test fixture goal to `'update payments processing'` (with s) so both file path and keyword match the process name
- **Files modified:** sdk/src/query/sme.test.ts
- **Verification:** Deduplication test passes with `match_source: 'both'`
- **Committed in:** 772d0fb4 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** All fixes were implementation bugs discovered during GREEN phase. No scope creep, no architectural changes.

## Issues Encountered

- Vitest module resolution requires `.js` extension on imports from TypeScript files even though the source files are `.ts` — this is the existing pattern in the codebase and was followed correctly.

## Threat Coverage

T-02-01 (path traversal): mitigated — `smesDir` constructed from `planningPaths().planning` + filenames from `readdir()` only; no user-supplied path segments used in `join()`.
T-02-03 (malformed frontmatter): mitigated — all frontmatter field accesses use `??` null-coalescing; no throws on missing or malformed optional fields.

## Next Phase Readiness

- All three SME QueryHandlers are ready for registration in the query registry (next plan 02-02)
- smeList, smeDetectProcesses, smeContextBlock provide the data access layer that downstream SME gate, detect, and discuss integrations (Phases 5-9) will depend on
- No blockers

---
*Phase: 02-sdk-query-handlers*
*Completed: 2026-04-29*
