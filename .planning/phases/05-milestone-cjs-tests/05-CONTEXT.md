# Phase 5: milestone.cjs Tests - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend milestone.cjs test coverage to validate `milestone complete` archiving behavior and `requirements mark-complete` across all requirement ID formats. Tests only — no production code changes.

</domain>

<decisions>
## Implementation Decisions

### Archiving test scope
- Test both with and without `--archivePhases` option — verify phase directories move to `milestones/v1.0-phases/`
- Verify archived REQUIREMENTS.md content includes archive header ("Requirements Archive: v1.0", "SHIPPED" status, archived date)
- Verify STATE.md gets updated during milestone complete (status field, activity date, description)
- Test milestone complete with missing ROADMAP.md and empty phases directory — verify defensive code paths work

### ID format coverage
- One test with mixed prefixes: TEST-XX, REG-XX, INFRA-XX together — proves regex isn't prefix-specific
- Include bare IDs (non-standard prefix formats) to verify the regex handles any ID pattern
- Verify both checkbox update (`- [ ]` → `- [x]`) and traceability table update (`Pending` → `Complete`)
- Input format tests: comma-separated, space-separated, bracket-wrapped `[REQ-01, REQ-02]`

### Error & edge cases
- Missing REQUIREMENTS.md returns `{updated: false, reason: 'REQUIREMENTS.md not found'}`
- Mixed valid/invalid IDs — some update, others go to `not_found` list
- Idempotency — re-marking already-complete requirement doesn't corrupt file
- Missing ROADMAP.md or empty phases dir during milestone complete

### Test organization
- Add archiving tests to existing `describe('milestone complete command')` block
- Create new `describe('requirements mark-complete command')` block
- CLI integration style via `runGsdTools()` — matches project convention
- Fresh temp directory per test (beforeEach/afterEach pattern)
- Coverage-driven — cover all code paths, not targeting a specific test count

### Claude's Discretion
- Whether to test audit file archiving (v1.0-MILESTONE-AUDIT.md) — low-complexity code path
- Input format structure (separate tests per style vs combined) for comma/space/bracket formats
- Exact number of tests — driven by code path coverage

</decisions>

<specifics>
## Specific Ideas

- "Going for coverage of code paths, not a specific test count"
- CLI integration approach mirrors existing tests — call through `runGsdTools('milestone complete ...')` and `runGsdTools('requirements mark-complete ...')`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-milestone-cjs-tests*
*Context gathered: 2026-02-25*
