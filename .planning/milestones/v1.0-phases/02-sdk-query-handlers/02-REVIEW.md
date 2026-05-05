---
phase: 02-sdk-query-handlers
reviewed: 2026-04-29T20:45:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - sdk/src/query/sme.ts
  - sdk/src/query/sme.test.ts
  - sdk/src/query/index.ts
  - sdk/src/golden/golden-policy.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-29T20:45:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed: the new SME query handlers (`sme.ts`), their unit tests (`sme.test.ts`), the updated query registry barrel (`index.ts`), and the golden parity policy (`golden-policy.ts`).

The SME handler implementation is solid overall. Path construction correctly avoids user-supplied segments (T-02-01 mitigation), frontmatter fields are null-coalesced (T-02-03), and the config feature flag guard is consistently applied across all three handlers. The golden-policy exceptions are properly registered for the three SDK-only SME commands.

Two warnings were identified: an unhandled `readFile` exception in `smeContextBlock` that can crash the caller, and an XML attribute injection vector in the context block builder. Three informational items relate to test hardening and minor code quality observations.

## Warnings

### WR-01: Unhandled readFile exception in smeContextBlock

**File:** `sdk/src/query/sme.ts:292`
**Issue:** In `smeContextBlock`, after the target file is found via `readdir`, the `readFile` call on line 292 is not wrapped in a try/catch. Both `smeList` (line 122-125) and `smeDetectProcesses` (line 192-195) protect their `readFile` calls with try/catch and `continue` on failure. In `smeContextBlock`, a race condition (file deleted between `readdir` and `readFile`), a permissions change, or a filesystem error will throw an unhandled exception that propagates to the caller as an unexpected error rather than a graceful `{ found: false }` response.

**Fix:**
```typescript
  // Only compose with filename returned by readdir (T-02-01)
  const filePath = join(smesDir, targetFile);
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return { data: { found: false, process: processName, block: '' } };
  }
  const fm = extractFrontmatter(content) as Record<string, unknown>;
```

### WR-02: Frontmatter values interpolated unsanitized into XML attributes

**File:** `sdk/src/query/sme.ts:296`
**Issue:** The `process` and `block_mode` XML attributes are built via string interpolation from frontmatter values. While the code comment (T-02-02) correctly notes that SME docs are author-created project files at the same trust level as PLAN.md, a frontmatter value containing a double-quote character (`"`) would produce malformed XML that could break downstream XML parsers. For example, `process_name: 'pay"ments'` would yield `process="pay"ments"`. This is not a security vulnerability (same trust level), but it is a correctness bug -- the XML output would be syntactically invalid.

**Fix:**
```typescript
  // Minimal escaping for XML attribute correctness (not security -- same trust level as PLAN.md)
  const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const block = `<sme_context process="${escAttr(String(fm['process_name'] ?? processName))}" block_mode="${escAttr(String(fm['block_mode'] ?? 'soft'))}">\n${content}\n</sme_context>`;
```

## Info

### IN-01: Test for smeContextBlock missing assertion on GSDError classification

**File:** `sdk/src/query/sme.test.ts:338`
**Issue:** The test on line 338 asserts that `smeContextBlock([], projectDir)` rejects, but only uses `.rejects.toThrow()` without verifying the error is a `GSDError` with `ErrorClassification.Validation`. The handler explicitly throws `new GSDError('process name required', ErrorClassification.Validation)` -- the test should verify the error type and message to prevent regressions where the error classification changes.

**Fix:**
```typescript
  it('throws GSDError(Validation) when process name argument is missing', async () => {
    await expect(smeContextBlock([], projectDir)).rejects.toThrow('process name required');
  });
```

### IN-02: No test coverage for smeDetectProcesses with multiple SME files

**File:** `sdk/src/query/sme.test.ts:200-315`
**Issue:** The `smeDetectProcesses` test suite only sets up a single SME file (`payments-SME.md`) in `beforeEach`. There is no test that verifies correct behavior when multiple SME files exist and multiple processes match (e.g., a goal containing both "payments" and "enrollment"). This is an edge case the implementation handles correctly (one entry per process), but would benefit from explicit test coverage.

**Fix:** Add a test case in the `smeDetectProcesses` describe block that writes both `payments-SME.md` and `enrollment-SME.md`, then queries with a goal that matches both processes, asserting that `matches.length === 2` with correct per-process `match_source` values.

### IN-03: Empty catch blocks in config guard sections

**File:** `sdk/src/query/sme.ts:96`, `sdk/src/query/sme.ts:166`, `sdk/src/query/sme.ts:256`
**Issue:** The config guard `try/catch` blocks at lines 96, 166, and 256 use bare `catch` without logging or noting the error. This is intentional (the JSDoc documents that missing config returns disabled), but makes debugging harder when `loadConfig` fails for unexpected reasons (e.g., malformed JSON). This is a minor observability concern, not a bug.

**Fix:** No code change required. The current behavior is correct per the documented contract. Consider adding a debug-level log in a future observability pass.

---

_Reviewed: 2026-04-29T20:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
