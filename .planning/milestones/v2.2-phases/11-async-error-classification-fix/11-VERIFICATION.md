---
phase: 11-async-error-classification-fix
verified: 2026-02-17T21:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 11: Async Error Classification Fix Verification Report

**Phase Goal:** Fix classifyError to correctly identify NOT_FOUND/PERMISSION errors in the async invocation path
**Verified:** 2026-02-17T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | classifyError returns NOT_FOUND for exit code 127 from async path (err.code = 127) | VERIFIED | All 3 adapters: `const exitCode = err.status \|\| (typeof err.code === 'number' ? err.code : undefined)` — runtime confirmed returns `'NOT_FOUND'` |
| 2  | classifyError returns NOT_FOUND for exit code 127 from sync path (err.status = 127) | VERIFIED | `err.status \|\| ...` short-circuits for sync; runtime confirmed returns `'NOT_FOUND'` |
| 3  | classifyError returns PERMISSION for exit code 126 from async path (err.code = 126) | VERIFIED | All 3 adapters: `if (exitCode === 126) return 'PERMISSION'`; runtime confirmed |
| 4  | classifyError returns PERMISSION for exit code 126 from sync path (err.status = 126) | VERIFIED | Sync path: `err.status` provides exitCode 126; runtime confirmed returns `'PERMISSION'` |
| 5  | classifyError returns TIMEOUT for SIGTERM signal async shape (err.code = null) | VERIFIED | `if (err.signal === 'SIGTERM') return 'TIMEOUT'` fires before exitCode extraction; test passes |
| 6  | classifyError returns TIMEOUT for SIGTERM signal sync shape (err.status = null) | VERIFIED | Same guard; test passes |
| 7  | classifyError returns NOT_FOUND for ENOENT string code (spawn failure) | VERIFIED | `if (err.code === 'ENOENT' \|\| exitCode === 127)` — string ENOENT check preserved; test passes |
| 8  | classifyError returns EXIT_ERROR for other exit codes (both error shapes) | VERIFIED | Fallback `return 'EXIT_ERROR'`; tests for `{ status: 1 }` and `{ code: 42 }` both pass |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/adapters/codex.cjs` | Fixed classifyError + exported for testing | VERIFIED | Line 13: `typeof err.code === 'number'` guard present; line 133: exports `classifyError` |
| `get-shit-done/bin/adapters/gemini.cjs` | Fixed classifyError + exported for testing | VERIFIED | Line 13: `typeof err.code === 'number'` guard present; line 158: exports `classifyError` |
| `get-shit-done/bin/adapters/opencode.cjs` | Fixed classifyError + exported for testing | VERIFIED | Line 13: `typeof err.code === 'number'` guard present; line 151: exports `classifyError` |
| `get-shit-done/bin/gsd-tools.test.cjs` | classifyError unit tests for all 3 adapters | VERIFIED | 27 classifyError tests (9 per adapter) added at line 2276+; all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `codex.cjs` | `classifyError` | `exitCode = err.status \|\| (typeof err.code === 'number' ? err.code : undefined)` | WIRED | Line 13 in function body; called from `invokeAsync` at line 117, `invoke` at line 70, `detect` at line 28 |
| `gemini.cjs` | `classifyError` | same pattern | WIRED | Line 13; called from `invokeAsync` at line 134, `invoke` at line 86, `detect` at line 34 |
| `opencode.cjs` | `classifyError` | same pattern | WIRED | Line 13; called from `invokeAsync` at line 133, `invoke` at line 86, `detect` at line 40 |
| `gsd-tools.test.cjs` | `codex.cjs` classifyError | `require('./adapters/codex.cjs')` at line 2279 | WIRED | Import confirmed; 9 test cases exercise the function directly |
| `gsd-tools.test.cjs` | `gemini.cjs` classifyError | `require('./adapters/gemini.cjs')` at line 2280 | WIRED | Import confirmed; 9 test cases exercise the function directly |
| `gsd-tools.test.cjs` | `opencode.cjs` classifyError | `require('./adapters/opencode.cjs')` at line 2281 | WIRED | Import confirmed; 9 test cases exercise the function directly |

### Anti-Patterns Found

None found. No TODOs, FIXMEs, placeholders, empty implementations, or console.log stubs in any modified file.

### Human Verification Required

None. All success criteria are verifiable programmatically via unit tests and static analysis. The fix is a pure function with no external dependencies, UI, or runtime side effects.

## Test Suite Results

```
node --test get-shit-done/bin/gsd-tools.test.cjs

# tests 109
# suites 22
# pass  109
# fail  0
```

All 27 classifyError tests pass across the 3 adapters:
- codex adapter: 9/9 pass
- gemini adapter: 9/9 pass
- opencode adapter: 9/9 pass

## Fix Verification

The fix pattern is identical and correct in all three adapters:

```javascript
function classifyError(err) {
  if (err.signal === 'SIGTERM') return 'TIMEOUT';
  // err.status = exit code from execSync; err.code = exit code (number) from exec
  const exitCode = err.status || (typeof err.code === 'number' ? err.code : undefined);
  if (err.code === 'ENOENT' || exitCode === 127) return 'NOT_FOUND';
  if (exitCode === 126) return 'PERMISSION';
  return 'EXIT_ERROR';
}
```

`classifyError` is called inside `invokeAsync`'s `exec` callback in all 3 adapters, confirming the async path is fully wired to the fixed function.

Runtime verification:

```
codex  exit 127 async: NOT_FOUND   (was: EXIT_ERROR before fix)
codex  exit 126 async: PERMISSION  (was: EXIT_ERROR before fix)
gemini exit 127 async: NOT_FOUND
gemini exit 126 async: PERMISSION
opencode exit 127 async: NOT_FOUND
opencode exit 126 async: PERMISSION
```

Sync path regression check:

```
codex exit 127 sync: NOT_FOUND    (unchanged, correct)
codex exit 126 sync: PERMISSION   (unchanged, correct)
```

---

_Verified: 2026-02-17T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
