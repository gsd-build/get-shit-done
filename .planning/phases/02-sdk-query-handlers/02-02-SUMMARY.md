---
phase: 02-sdk-query-handlers
plan: 02
subsystem: sdk-query-registry
tags: [typescript, sdk, sme, query-handlers, registry, golden-policy]

requires:
  - phase: 02-sdk-query-handlers
    plan: 01
    provides: "smeList, smeDetectProcesses, smeContextBlock handler functions in sdk/src/query/sme.ts"

provides:
  - "sme.list / sme list dispatch in QueryRegistry"
  - "sme.detect-processes / sme detect-processes dispatch in QueryRegistry"
  - "sme.context-block / sme context-block dispatch in QueryRegistry"
  - "NO_CJS_SUBPROCESS_REASON entries for all three SME canonicals in golden-policy.ts"
  - "golden-policy.test.ts compliance (0 failures)"

affects:
  - "All callers using gsd-sdk query sme.list / sme.detect-processes / sme.context-block"
  - "golden-policy CI enforcement — three new canonicals now accounted for"

tech-stack:
  added: []
  patterns:
    - "Paired dotted + space-delimited alias registration pattern for resolveQueryArgv compatibility"
    - "NO_CJS_SUBPROCESS_REASON entry pattern: canonical dotted key, rationale string referencing test file"

key-files:
  created: []
  modified:
    - sdk/src/query/index.ts
    - sdk/src/golden/golden-policy.ts

key-decisions:
  - "Registration placed after check.ship-ready block and before Phase lifecycle handlers comment — follows established SDK-only handler placement convention"
  - "NO_CJS_SUBPROCESS_REASON uses canonical (dotted) keys only — verifyGoldenPolicyComplete deduplicates dotted vs space aliases internally"

requirements-completed: [SDK-01, SDK-02, SDK-03]

duration: 5min
completed: 2026-04-29
---

# Phase 02 Plan 02: SME Handler Registration and Golden Policy Summary

**Import and 6-call registration of smeList/smeDetectProcesses/smeContextBlock in query registry plus 3 NO_CJS_SUBPROCESS_REASON entries to satisfy golden policy CI**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T18:44:12Z
- **Completed:** 2026-04-29T18:49:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Wired `smeList`, `smeDetectProcesses`, `smeContextBlock` into `createRegistry()` with both dotted and space-delimited aliases (6 register calls total)
- Added import line `import { smeList, smeDetectProcesses, smeContextBlock } from './sme.js'` to index.ts
- Added three `NO_CJS_SUBPROCESS_REASON` entries for `sme.list`, `sme.detect-processes`, `sme.context-block` in golden-policy.ts
- `golden-policy.test.ts` passes (1/1)
- `sme.test.ts` passes (19/19)
- No regressions introduced by this plan's changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Register SME handlers in query registry** — `b5fb2fd8` (feat)
2. **Task 2: Add golden policy exception entries** — `cf9d14dc` (feat)

## Files Created/Modified

- `sdk/src/query/index.ts` — Added import from `./sme.js` and 6 `registry.register(...)` calls
- `sdk/src/golden/golden-policy.ts` — Added 3 entries to `NO_CJS_SUBPROCESS_REASON` object

## Decisions Made

- Registration block placed immediately after `check.ship-ready` lines and before `// Phase lifecycle handlers` comment — consistent with the existing SDK-only handler grouping convention seen in the decision-routing block above it
- Three `NO_CJS_SUBPROCESS_REASON` entries use canonical (dotted) keys only — `verifyGoldenPolicyComplete()` internally deduplicates dotted vs space-delimited aliases, so one entry per canonical is correct

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

The full unit suite shows 5 pre-existing failures unrelated to this plan's changes:

| Test | File | Nature |
|------|------|--------|
| `agentSkills > returns valid QueryResult` | decomposed-handlers.test.ts | Unrelated to SME registration |
| `dispatch calls registered handler` | registry.test.ts | Handler signature mismatch (3rd arg) |
| `stateBeginPhase > bug-2420` (3 tests) | state-mutation.test.ts | Flag parser behavior |

These failures pre-date this plan and are not caused by any file modified here. Deferred per scope boundary rule.

## Threat Coverage

T-02-05 (Spoofing — handler registration): accepted — registration is compile-time wiring in trusted code; no runtime user input reaches the registration path.

## Next Phase Readiness

- All three SME query handlers are now reachable via `gsd-sdk query sme.list`, `gsd-sdk query sme.detect-processes`, and `gsd-sdk query sme.context-block`
- Golden policy CI is satisfied — no unaccounted canonicals
- Phase 02 complete — handlers implemented (02-01) and registered (02-02)
- Ready for Phase 03+ SME gate integration, discuss-phase injection, and workflow wiring

---
*Phase: 02-sdk-query-handlers*
*Completed: 2026-04-29*
