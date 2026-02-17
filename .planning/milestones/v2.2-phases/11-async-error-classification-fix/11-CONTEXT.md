# Phase 11: Async Error Classification Fix - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix `classifyError` to correctly identify NOT_FOUND/PERMISSION errors in the async invocation path (`invokeAsync`). Exit codes 127 and 126 are misclassified as `EXIT_ERROR` in all three CLI adapters. The sync path already works correctly. This is a targeted bug fix with unit tests — no new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Fix approach
- Use `err.status || 1` for exit code extraction in async path (matching sync path exactly)
- Change both the `exitCode` field and the input to `classifyError` — full parity with sync
- Identical fix across all 3 adapters (codex.cjs, gemini.cjs, opencode.cjs) — same bug, same fix
- Node.js `exec` callback stores exit codes in `err.status`, not `err.code` — this is the root cause

### Testing scope
- Code fix accompanied by unit tests for `classifyError`
- Tests verify: NOT_FOUND for exit 127, PERMISSION for exit 126, TIMEOUT for SIGTERM, EXIT_ERROR for others
- Tests live in existing test file (follow project patterns, no new test files)

### Consistency enforcement
- Export `classifyError` from each adapter's `module.exports` for direct testability
- Unit tests on `classifyError` enforce sync/async consistency implicitly (same function, same input after fix)
- Keep `classifyError` duplicated per adapter — self-contained with zero cross-dependencies (Phase 6 pattern)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-async-error-classification-fix*
*Context gathered: 2026-02-17*
