// allow-test-rule: architectural-invariant
// acquireStateLock is a private function (not exported). The behavioral contract —
// throw on non-EEXIST errors rather than returning a false-success lockPath — is
// an implementation invariant that cannot be verified through the public CLI API
// without introducing timing-sensitive mocks. Source inspection is the correct
// and authoritative level for this contract.

/**
 * Regression tests for #3772 — acquireStateLock silently returns false-success
 * on non-EEXIST openSync errors (EMFILE / EINTR / ENOSPC under load).
 *
 * Contract under test:
 *   C1. Non-EEXIST error from fs.openSync → must throw, not return lockPath
 *   C2. Success path (openSync succeeds) → must return lockPath
 *   C3. EEXIST error → retry / wait semantics unchanged (not impacted by this fix)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const STATE_CJS_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'bin', 'lib', 'state.cjs'
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the text of acquireStateLock from the source file. */
function extractAcquireStateLockSource(src) {
  const fnStart = src.indexOf('function acquireStateLock(');
  assert.ok(fnStart !== -1, 'acquireStateLock function must exist in state.cjs');
  // Find the closing brace by counting open/close braces from the function start
  let depth = 0;
  let i = fnStart;
  let foundOpen = false;
  while (i < src.length) {
    if (src[i] === '{') { depth++; foundOpen = true; }
    if (src[i] === '}') { depth--; }
    if (foundOpen && depth === 0) { return src.slice(fnStart, i + 1); }
    i++;
  }
  throw new Error('Could not find closing brace of acquireStateLock');
}

// ─────────────────────────────────────────────────────────────────────────────
// C1. Non-EEXIST error → must throw, not return lockPath
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: non-EEXIST openSync errors (#3772)', () => {
  test('C1: source contains throw-not-return for non-EEXIST errors', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const fnSrc = extractAcquireStateLockSource(src);

    // The bug pattern: silently returning the lockPath on non-EEXIST error.
    // This branch must NOT appear in the fixed code.
    const bugPattern = /if\s*\(\s*err\.code\s*!==\s*['"]EEXIST['"]\s*\)\s*return\s+lockPath/;
    assert.ok(
      !bugPattern.test(fnSrc),
      'acquireStateLock must NOT return lockPath on non-EEXIST errors (silent false-success — #3772)'
    );

    // The fix: throw the error so callers get the real OS-level failure.
    const fixPattern = /if\s*\(\s*err\.code\s*!==\s*['"]EEXIST['"]\s*\)\s*throw\s+err/;
    assert.ok(
      fixPattern.test(fnSrc),
      'acquireStateLock must throw err on non-EEXIST openSync errors (EMFILE/EINTR/ENOSPC — #3772)'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C2. Success path → returns lockPath (regression guard — fix must not break success)
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: success path still returns lockPath', () => {
  test('C2: source contains return lockPath in the success (try) branch', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const fnSrc = extractAcquireStateLockSource(src);

    // The success path: openSync succeeds → write PID → close → add to held set → return lockPath.
    // Verify the return is still present inside the try block (before the catch).
    const tryBlock = fnSrc.slice(fnSrc.indexOf('try {'), fnSrc.indexOf('} catch ('));
    assert.ok(
      tryBlock.includes('return lockPath'),
      'acquireStateLock must still return lockPath when fs.openSync succeeds (success path intact)'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C3. EEXIST error → retry semantics unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: EEXIST retry semantics unchanged', () => {
  test('C3: source still handles EEXIST with retry / stale-lock removal', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const fnSrc = extractAcquireStateLockSource(src);

    // The EEXIST branch falls through to stale-lock detection and Atomics.wait retry.
    // These must still be present after the non-EEXIST fix.
    assert.ok(
      fnSrc.includes('Atomics.wait'),
      'acquireStateLock must still use Atomics.wait() for EEXIST retry sleep'
    );

    assert.ok(
      fnSrc.includes('staleThresholdMs'),
      'acquireStateLock must still check stale lock threshold on EEXIST'
    );

    assert.ok(
      fnSrc.includes('maxWaitMs'),
      'acquireStateLock must still enforce max wait budget on EEXIST retry exhaustion'
    );

    // The fix only affects the non-EEXIST branch; the EEXIST guard must still exist.
    const eexistGuard = /err\.code\s*!==\s*['"]EEXIST['"]/;
    assert.ok(
      eexistGuard.test(fnSrc),
      'acquireStateLock must still distinguish EEXIST from other errors'
    );
  });
});
