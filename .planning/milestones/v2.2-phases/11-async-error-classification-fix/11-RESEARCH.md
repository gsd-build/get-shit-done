# Phase 11: Async Error Classification Fix - Research

**Researched:** 2026-02-17
**Domain:** Node.js child_process error handling (exec vs execSync error object shapes)
**Confidence:** HIGH

## Summary

The `classifyError` function in all three CLI adapters (codex.cjs, gemini.cjs, opencode.cjs) fails to correctly classify exit codes 127 (NOT_FOUND) and 126 (PERMISSION) when called from the async `invokeAsync` path. The root cause is a divergence in how Node.js `exec` (async, callback-based) and `execSync` (synchronous) represent exit codes on their error objects.

Empirical testing on Node.js v22 confirms: `execSync` errors store the exit code in `err.status` (number), while `exec` callback errors store it in `err.code` (number). The current `classifyError` only checks `err.status` for numeric exit codes and `err.code` against the string `'ENOENT'`, so async errors with numeric `err.code` values (127, 126) fall through to the default `EXIT_ERROR` return.

**Primary recommendation:** Update `classifyError` in all three adapters to extract exit codes from both `err.status` and numeric `err.code`, then export the function for direct unit testing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `err.status || 1` for exit code extraction in async path (matching sync path exactly) — **NOTE: CONTEXT.md has root cause backwards; see "Root Cause Correction" below**
- Change both the `exitCode` field and the input to `classifyError` — full parity with sync
- Identical fix across all 3 adapters (codex.cjs, gemini.cjs, opencode.cjs) — same bug, same fix
- Node.js `exec` callback stores exit codes in `err.status`, not `err.code` — **CORRECTION: empirical evidence shows the opposite; exec stores in `err.code`, execSync stores in `err.status`**
- Code fix accompanied by unit tests for `classifyError`
- Tests verify: NOT_FOUND for exit 127, PERMISSION for exit 126, TIMEOUT for SIGTERM, EXIT_ERROR for others
- Tests live in existing test file (follow project patterns, no new test files)
- Export `classifyError` from each adapter's `module.exports` for direct testability
- Unit tests on `classifyError` enforce sync/async consistency implicitly (same function, same input after fix)
- Keep `classifyError` duplicated per adapter — self-contained with zero cross-dependencies (Phase 6 pattern)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Root Cause Correction

**CRITICAL FINDING:** The CONTEXT.md states "Node.js `exec` callback stores exit codes in `err.status`, not `err.code` — this is the root cause." Empirical testing proves this is **backwards**:

| API | Exit code property | Exit code type | `err.code` type | `err.status` type |
|-----|-------------------|----------------|-----------------|-------------------|
| `exec` (async) | `err.code` | number | number (exit code) | undefined |
| `execSync` (sync) | `err.status` | number | string (`'ENOENT'`) or undefined | number (exit code) |

**Evidence (tested on Node.js v22.21.1):**

```
exec('nonexistent_command'):       err.code = 127 (number), err.status = undefined
execSync('nonexistent_command'):   err.code = undefined,    err.status = 127 (number)

exec(non-executable file):         err.code = 126 (number), err.status = undefined
execSync(non-executable file):     err.code = undefined,    err.status = 126 (number)

exec('exit 42'):                   err.code = 42 (number),  err.status = undefined
execSync('exit 42'):               err.code = undefined,    err.status = 42 (number)

exec with timeout (SIGTERM):       err.code = null,         err.signal = 'SIGTERM'
```

**Impact on fix approach:** The CONTEXT.md decision to "use `err.status || 1` for exit code extraction in async path" would NOT fix the bug — `err.status` is `undefined` in async errors, so `err.status || 1` would always evaluate to `1`. The fix must go in `classifyError` itself, not in the exit code extraction line. The `exitCode: err.code || 1` line in `invokeAsync` is already correct for reporting the numeric exit code.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | v22.x | Process execution (exec, execSync) | Built-in, zero dependencies — project principle |
| Node.js `node:test` | v22.x | Test runner for unit tests | Already used by existing test file |
| Node.js `node:assert` | v22.x | Assertion library | Already used by existing test file |

### Supporting
No additional libraries needed. This is a zero-dependency fix.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixing `classifyError` | Normalizing error before passing | More code churn, fragile — fix at source is cleaner |
| Duplicated `classifyError` per adapter | Shared utility module | Violates Phase 6 zero-cross-dependency pattern |

## Architecture Patterns

### Current Error Flow (Buggy)

```
invokeAsync error path:
  exec callback → err = { code: 127, status: undefined, signal: null }
  → exitCode: err.code || 1  →  exitCode = 127  (CORRECT)
  → classifyError(err)
    → err.signal === 'SIGTERM'?  NO
    → err.code === 'ENOENT'?     NO (127 !== 'ENOENT')
    → err.status === 127?         NO (undefined !== 127)
    → return 'EXIT_ERROR'         WRONG — should be 'NOT_FOUND'
```

### Fixed Error Flow

```
invokeAsync error path:
  exec callback → err = { code: 127, status: undefined, signal: null }
  → exitCode: err.code || 1  →  exitCode = 127  (CORRECT, no change)
  → classifyError(err)
    → err.signal === 'SIGTERM'?  NO
    → exitCode = err.status || (typeof err.code === 'number' ? err.code : undefined)
    → err.code === 'ENOENT'?     NO
    → exitCode === 127?           YES
    → return 'NOT_FOUND'          CORRECT
```

### Pattern: Unified Exit Code Extraction in classifyError

**What:** Extract exit code from whichever property holds it (`err.status` for sync, `err.code` as number for async), then use the unified value for classification.

**When to use:** Whenever `classifyError` is called with errors from either `exec` or `execSync`.

**Implementation:**
```javascript
function classifyError(err) {
  if (err.signal === 'SIGTERM') return 'TIMEOUT';
  const exitCode = err.status || (typeof err.code === 'number' ? err.code : undefined);
  if (err.code === 'ENOENT' || exitCode === 127) return 'NOT_FOUND';
  if (exitCode === 126) return 'PERMISSION';
  return 'EXIT_ERROR';
}
```

**Why this works:**
- `err.status` is checked first (sync path — number or undefined)
- `typeof err.code === 'number'` distinguishes numeric exit codes (async path: 127, 126, etc.) from string error codes (sync spawn failure: `'ENOENT'`)
- The `err.code === 'ENOENT'` check still works because it's a separate string comparison
- SIGTERM check is first (unchanged) — `err.signal` works the same in both paths

### Anti-Patterns to Avoid
- **Normalizing the error object before classifyError:** Creates a synthetic object that masks the real error shape. Fix the classification logic, not the input.
- **Changing `invokeAsync` exitCode to `err.status || 1`:** Would break exitCode reporting since `err.status` is undefined in async errors. The current `err.code || 1` is correct.
- **Shared classifyError module:** Violates the Phase 6 self-contained adapter pattern. Each adapter is intentionally independent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exit code extraction | Custom error normalization layer | `typeof` check in classifyError | Simple, no new abstraction needed |
| Test framework | Custom test harness | `node:test` + `node:assert` | Already used in project |

**Key insight:** The fix is 2 lines of code per adapter. No abstraction or infrastructure needed.

## Common Pitfalls

### Pitfall 1: Confusing err.code Semantics
**What goes wrong:** `err.code` means different things in different contexts — it's a string (`'ENOENT'`) for spawn failures, but a number (127, 126) for exec callback exit codes.
**Why it happens:** Node.js reuses the `code` property name with different semantics across sync/async APIs.
**How to avoid:** Use `typeof err.code === 'number'` to distinguish numeric exit codes from string error codes.
**Warning signs:** Tests pass for sync but fail for async, or vice versa.

### Pitfall 2: Testing classifyError with Wrong Error Shape
**What goes wrong:** Tests construct error objects with `{ status: 127 }` but the async path sends `{ code: 127 }`.
**Why it happens:** Not understanding the divergent error shapes between exec and execSync.
**How to avoid:** Test with BOTH error shapes: `{ status: 127 }` (sync) AND `{ code: 127 }` (async). The fixed classifyError must handle both.
**Warning signs:** All tests pass but async invocation still misclassifies.

### Pitfall 3: ENOENT Check Ordering
**What goes wrong:** If `exitCode` extraction happens before the ENOENT check, and `err.code` is `'ENOENT'`, then `typeof err.code === 'number'` returns false, exitCode is undefined, and the check `err.code === 'ENOENT'` still catches it. But if the logic is restructured poorly, ENOENT could be missed.
**Why it happens:** Over-refactoring the classification logic.
**How to avoid:** Keep the `err.code === 'ENOENT'` string check as a fallback alongside the numeric exitCode check.
**Warning signs:** ENOENT errors start returning EXIT_ERROR.

### Pitfall 4: err.code Can Be null (SIGTERM Case)
**What goes wrong:** For timeout/signal kills, `err.code` is `null` (not undefined, not a number). `typeof null === 'object'`, so the `typeof err.code === 'number'` check correctly excludes it.
**Why it happens:** Node.js sets `err.code = null` when the process is killed by signal.
**How to avoid:** The SIGTERM check (`err.signal === 'SIGTERM'`) must remain FIRST in the classification chain, before any exit code extraction.
**Warning signs:** Timeout errors misclassified as EXIT_ERROR.

## Code Examples

### Fix: Updated classifyError (identical in all 3 adapters)

```javascript
// Source: Empirical testing on Node.js v22.21.1
function classifyError(err) {
  if (err.signal === 'SIGTERM') return 'TIMEOUT';
  // err.status = exit code from execSync; err.code = exit code (number) from exec
  const exitCode = err.status || (typeof err.code === 'number' ? err.code : undefined);
  if (err.code === 'ENOENT' || exitCode === 127) return 'NOT_FOUND';
  if (exitCode === 126) return 'PERMISSION';
  return 'EXIT_ERROR';
}
```

### Fix: Updated module.exports (identical in all 3 adapters)

```javascript
// Before:
module.exports = { detect, invoke, invokeAsync, CLI_NAME };

// After:
module.exports = { detect, invoke, invokeAsync, CLI_NAME, classifyError };
```

### Test Pattern: classifyError Unit Tests

```javascript
// Source: Follows existing project test patterns in gsd-tools.test.cjs
const codexAdapter = require('./adapters/codex.cjs');

describe('codex classifyError', () => {
  test('exit 127 classified as NOT_FOUND (sync shape)', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ status: 127, signal: null }),
      'NOT_FOUND'
    );
  });

  test('exit 127 classified as NOT_FOUND (async shape)', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ code: 127, signal: null }),
      'NOT_FOUND'
    );
  });

  test('exit 126 classified as PERMISSION (sync shape)', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ status: 126, signal: null }),
      'PERMISSION'
    );
  });

  test('exit 126 classified as PERMISSION (async shape)', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ code: 126, signal: null }),
      'PERMISSION'
    );
  });

  test('SIGTERM classified as TIMEOUT', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ signal: 'SIGTERM', code: null }),
      'TIMEOUT'
    );
  });

  test('ENOENT classified as NOT_FOUND', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ code: 'ENOENT', signal: null }),
      'NOT_FOUND'
    );
  });

  test('other exit codes classified as EXIT_ERROR', () => {
    assert.strictEqual(
      codexAdapter.classifyError({ status: 1, signal: null }),
      'EXIT_ERROR'
    );
    assert.strictEqual(
      codexAdapter.classifyError({ code: 42, signal: null }),
      'EXIT_ERROR'
    );
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Check `err.status` only | Check both `err.status` and numeric `err.code` | This phase (Phase 11) | Fixes async path misclassification |

**Deprecated/outdated:**
- The assumption that `err.code` is always a string (like `'ENOENT'`) is wrong for `exec` callback errors where it's a number (the exit code).

## Open Questions

1. **invokeAsync exitCode field: keep `err.code || 1` or change to match sync?**
   - What we know: `err.code || 1` is correct for async — it extracts the numeric exit code from the exec callback error. Changing to `err.status || 1` (as CONTEXT.md suggests) would always resolve to `1` since `err.status` is undefined in async errors.
   - What's unclear: The CONTEXT.md explicitly says "Change both the exitCode field and the input to classifyError." Should we follow this literally even though it would break exitCode reporting?
   - Recommendation: Do NOT change the `exitCode` line in `invokeAsync`. The CONTEXT.md's root cause analysis is empirically incorrect (proved by testing). The `exitCode: err.code || 1` is correct. Fix only `classifyError`. Document the correction in the plan.

2. **Test file naming: `.test.cjs` vs `.test.js`**
   - What we know: Existing test file is `gsd-tools.test.cjs`. Package.json references `gsd-tools.test.js` (which doesn't exist).
   - What's unclear: Whether this was intentional or a typo.
   - Recommendation: Add tests to the existing `gsd-tools.test.cjs` file. The test file naming discrepancy is out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- **Empirical testing on Node.js v22.21.1** — All error property shapes verified by running actual commands (nonexistent command, non-executable file, exit codes, SIGTERM timeout) through both `exec` and `execSync` on the same Node.js version used by this project
- **Context7 `/nodejs/node/v22_20_0`** — child_process.exec and child_process.execSync documentation confirming error handling patterns
- **Source code inspection** — All three adapter files (`codex.cjs`, `gemini.cjs`, `opencode.cjs`) read and analyzed line-by-line

### Secondary (MEDIUM confidence)
- Node.js `execFileSync` documentation example showing `err.code` as string for spawn failures vs exit code in `err.status`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Node.js built-ins only, no external dependencies
- Architecture: HIGH — Bug root cause empirically verified, fix approach validated with test code
- Pitfalls: HIGH — All edge cases (ENOENT string, null code on SIGTERM, number code on exec) tested empirically

**Research date:** 2026-02-17
**Valid until:** No expiration — Node.js child_process error shapes are stable API

## Appendix: Full Error Property Enumeration

For reference, complete property dumps from empirical testing:

```
exec callback error (command not found):
  code: 127 (number)
  killed: false (boolean)
  signal: null (object)
  cmd: "nonexistent_command" (string)
  — NO status property —

execSync error (command not found):
  status: 127 (number)
  signal: null (object)
  pid: <number>
  — NO code property (when shell handles 'command not found') —

exec callback error (SIGTERM/timeout):
  code: null (object)
  killed: true (boolean)
  signal: "SIGTERM" (string)
  cmd: "sleep 100" (string)
  — NO status property —
```
