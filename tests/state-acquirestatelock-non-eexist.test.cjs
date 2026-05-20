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
 * Extended in #3776 to cover Docker overlay-fs and NFS transient errno codes.
 *
 * Contract under test:
 *   C1. Non-EEXIST error from fs.openSync → must throw, not return lockPath
 *   C2. Success path (openSync succeeds) → must return lockPath
 *   C3. EEXIST error → retry / wait semantics unchanged (not impacted by this fix)
 *   C4. RETRY_ERRNOS set: EAGAIN/EINTR/EINVAL/EIO/ENOENT/ESTALE must be in the retry allowlist
 *   C5. Fatal codes: EMFILE/ENOSPC/EROFS/EACCES must NOT be in the retry allowlist
 *   C6. Unknown errno codes must NOT be in the retry allowlist (conservative default)
 *   C7. EPERM/EBUSY must remain in the retry allowlist (from #3773)
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

// ─────────────────────────────────────────────────────────────────────────────
// C4. RETRY_ERRNOS set: new Docker/NFS transient codes must be present (#3776)
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the ACQUIRE_LOCK_RETRY_ERRNOS Set literal from the source file. */
function extractRetryErrnosSource(src) {
  const constStart = src.indexOf('const ACQUIRE_LOCK_RETRY_ERRNOS');
  assert.ok(constStart !== -1, 'ACQUIRE_LOCK_RETRY_ERRNOS constant must exist in state.cjs');
  // Extract to the end of the Set(...) constructor — find the closing ]);
  const setEnd = src.indexOf(']);', constStart);
  assert.ok(setEnd !== -1, 'ACQUIRE_LOCK_RETRY_ERRNOS Set must have closing ]);');
  return src.slice(constStart, setEnd + 2);
}

describe('acquireStateLock: RETRY_ERRNOS Set contains expected transient codes (#3776)', () => {
  test('C4a: EAGAIN is in ACQUIRE_LOCK_RETRY_ERRNOS', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'EAGAIN'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must include EAGAIN (resource temporarily unavailable)');
  });

  test('C4b: EINTR is in ACQUIRE_LOCK_RETRY_ERRNOS', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'EINTR'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must include EINTR (syscall interrupted)');
  });

  test('C4c: EINVAL is in ACQUIRE_LOCK_RETRY_ERRNOS', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'EINVAL'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must include EINVAL (Docker overlay-fs transient)');
  });

  test('C4d: EIO is in ACQUIRE_LOCK_RETRY_ERRNOS', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'EIO'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must include EIO (Docker overlay-fs / NFS transient)');
  });

  test('C4e: ENOENT is in ACQUIRE_LOCK_RETRY_ERRNOS', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'ENOENT'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must include ENOENT (Docker overlay-fs parent dir transient)');
  });

  test('C4f: ESTALE is in ACQUIRE_LOCK_RETRY_ERRNOS', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'ESTALE'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must include ESTALE (NFS stale file handle)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C5. Fatal codes: EMFILE/ENOSPC/EROFS/EACCES must NOT be in the retry set
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: fatal errno codes NOT in RETRY_ERRNOS (#3776)', () => {
  test('C5a: EMFILE is NOT in ACQUIRE_LOCK_RETRY_ERRNOS (fd limit exhausted — fatal)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(!setBlock.includes("'EMFILE'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must NOT include EMFILE (fatal: fd limit)');
  });

  test('C5b: ENOSPC is NOT in ACQUIRE_LOCK_RETRY_ERRNOS (disk full — fatal)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(!setBlock.includes("'ENOSPC'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must NOT include ENOSPC (fatal: disk full)');
  });

  test('C5c: EROFS is NOT in ACQUIRE_LOCK_RETRY_ERRNOS (read-only fs — fatal)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(!setBlock.includes("'EROFS'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must NOT include EROFS (fatal: read-only fs)');
  });

  test('C5d: EACCES is NOT in ACQUIRE_LOCK_RETRY_ERRNOS (permission denied — fatal)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(!setBlock.includes("'EACCES'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must NOT include EACCES (fatal: no permission)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C6. Unknown errno codes are not in the retry set (conservative default)
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: unknown errno codes not retried (conservative default, #3776)', () => {
  test('C6: ACQUIRE_LOCK_RETRY_ERRNOS does not include ESOMETHING (unknown code)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(
      !setBlock.includes("'ESOMETHING'"),
      'ACQUIRE_LOCK_RETRY_ERRNOS must not include unknown errno ESOMETHING (conservative: surface unknowns)'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C7. EPERM/EBUSY remain in the retry set (regression guard from #3773)
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: EPERM/EBUSY still in RETRY_ERRNOS (regression guard, #3773)', () => {
  test('C7a: EPERM is in ACQUIRE_LOCK_RETRY_ERRNOS (Windows / macOS AV scanner)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'EPERM'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must still include EPERM (#3773 regression guard)');
  });

  test('C7b: EBUSY is in ACQUIRE_LOCK_RETRY_ERRNOS (Windows file in use)', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const setBlock = extractRetryErrnosSource(src);
    assert.ok(setBlock.includes("'EBUSY'"), 'ACQUIRE_LOCK_RETRY_ERRNOS must still include EBUSY (#3773 regression guard)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C8. acquireStateLock uses Set-based retry check (not inline literal)
// ─────────────────────────────────────────────────────────────────────────────

describe('acquireStateLock: uses Set-based retry check (grep-able, not inline literal)', () => {
  test('C8: retry check uses ACQUIRE_LOCK_RETRY_ERRNOS.has() not hardcoded comparisons', () => {
    const src = fs.readFileSync(STATE_CJS_PATH, 'utf-8');
    const fnSrc = extractAcquireStateLockSource(src);

    // Must use the named Set for the check inside the function
    assert.ok(
      fnSrc.includes('ACQUIRE_LOCK_RETRY_ERRNOS.has('),
      'acquireStateLock catch block must use ACQUIRE_LOCK_RETRY_ERRNOS.has() for retry decision'
    );

    // Must NOT have the old inline EPERM/EBUSY literal check
    const oldPattern = /err\.code\s*===\s*['"]EPERM['"]\s*\|\|\s*err\.code\s*===\s*['"]EBUSY['"]/;
    assert.ok(
      !oldPattern.test(fnSrc),
      'acquireStateLock must not use old inline EPERM||EBUSY check (should use ACQUIRE_LOCK_RETRY_ERRNOS.has())'
    );
  });
});
