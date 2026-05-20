/**
 * Regression tests for issue #3670: --cursor --local install self-deadlocks
 * on gsd-install-migration.lock.
 *
 * Root cause: On Windows, `fs.rmSync(lockPath, { force: true })` in the lock
 * release closure silently swallows EPERM errors that NTFS returns when a
 * recently-closed file descriptor's handle has not yet been fully released by
 * the OS. The lock file is left on disk. The next `runInstallerMigrations`
 * call in the same install() invocation hits EEXIST, spins for
 * DEFAULT_LOCK_TIMEOUT_MS (30 s), then throws "installer migration lock is
 * held". There is also no stale-PID reclamation: if the lock names the
 * current process's PID, the helper should reclaim rather than spin.
 *
 * Windows wall-clock deadlock repro depends on Docker matrix Windows runners.
 * These tests reproduce the failure modes via mock-injected fs faults on any
 * platform (macOS/Linux/Windows). They fail deterministically WITHOUT the fix
 * and pass WITH it.
 *
 * Test plan:
 *   T1 (same-process re-entry / stale-PID reclamation — primary regression)
 *      Pre-seed the lock file with {pid: process.pid, ...}. Verify that a
 *      runInstallerMigrations call reclaims the lock and succeeds rather than
 *      spinning 30 s and throwing.
 *
 *   T2 (dead-PID reclamation — cross-invocation stale lock)
 *      Pre-seed the lock file with a PID known to be dead. Verify that acquire
 *      reclaims rather than throws.
 *
 *   T3 (silent rmSync swallow / Windows EPERM simulation)
 *      Inject a fault that makes fs.rmSync throw EPERM for the lock file only
 *      (simulating Windows NTFS delete-pending). Verify that the lock file IS
 *      removed by an alternative path (or that the error propagates) — i.e.
 *      verify that the fix does not silently leave the lock on disk.
 *
 *   T4 (counter-test: normal single acquire/release round-trip still works)
 *      No pre-seeded lock. One runInstallerMigrations call. Must succeed and
 *      leave no lock file behind.
 *
 *   T5 (counter-test: genuinely-held live lock still surfaces an error)
 *      Pre-seed lock with a live PID (process.pid) AND simulate a lock that
 *      has been "truly acquired" (fd still open). With lockTimeoutMs: 0 and a
 *      truly un-reclaimable lock, must still throw with a useful message naming
 *      the holder PID. (This guards against over-reclamation.)
 *
 * @see https://github.com/gsd-build/get-shit-done/issues/3670
 */

'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  INSTALL_MIGRATION_LOCK_NAME,
  runInstallerMigrations,
} = require('../get-shit-done/bin/lib/installer-migrations.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3670-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function lockPath(dir) {
  return path.join(dir, INSTALL_MIGRATION_LOCK_NAME);
}

function writeLockFile(dir, pid, acquiredAt) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    lockPath(dir),
    JSON.stringify({ pid, acquiredAt: acquiredAt || new Date().toISOString() }) + '\n',
    'utf8'
  );
}

/**
 * Find a PID that is guaranteed to be dead on this host.
 * We probe a set of high candidate PIDs (far outside the running set) and
 * pick the first one for which process.kill(pid, 0) throws ESRCH.
 * Falls back to 99999 if the probe loop exhausts (extremely unlikely).
 */
function findDeadPid() {
  // Avoid process.pid ± small numbers — those could be live siblings.
  for (let candidate = 600000; candidate < 700000; candidate += 1000) {
    try {
      process.kill(candidate, 0);
      // Still alive (or permission denied but exists) — try next
    } catch (err) {
      if (err.code === 'ESRCH') return candidate;
    }
  }
  return 99999; // fallback: extremely unlikely to be a live PID
}

// ---------------------------------------------------------------------------
// T1: Same-process re-entry — stale lock with current process.pid reclaimed
// ---------------------------------------------------------------------------
test('T1: reclaims stale lock that names the current process PID (same-process re-entry)', (t) => {
  const configDir = createTempDir();
  t.after(() => cleanup(configDir));

  // Pre-seed lock file with the CURRENT process's PID — exactly what happens
  // on Windows when rmSync swallows EPERM after the first runInstallerMigrations
  // call releases (or fails to release) the lock.
  writeLockFile(configDir, process.pid);

  // Without the fix: this would spin for lockTimeoutMs then throw.
  // With the fix: detects own PID → reclaims → succeeds.
  // lockTimeoutMs: 200 (fail fast so the test doesn't hang for 30 s without fix)
  const result = runInstallerMigrations({
    configDir,
    migrations: [],
    lockTimeoutMs: 200,
  });

  assert.ok(result, 'runInstallerMigrations must return a result object');
  // Lock file must be removed after the call completes.
  assert.equal(
    fs.existsSync(lockPath(configDir)),
    false,
    'lock file must not remain on disk after successful runInstallerMigrations'
  );
});

// ---------------------------------------------------------------------------
// T2: Dead-PID reclamation — cross-invocation stale lock
// ---------------------------------------------------------------------------
test('T2: reclaims stale lock whose PID is no longer alive', (t) => {
  const configDir = createTempDir();
  t.after(() => cleanup(configDir));

  const deadPid = findDeadPid();
  writeLockFile(configDir, deadPid);

  const result = runInstallerMigrations({
    configDir,
    migrations: [],
    lockTimeoutMs: 200,
  });

  assert.ok(result, 'runInstallerMigrations must return a result object');
  assert.equal(
    fs.existsSync(lockPath(configDir)),
    false,
    'lock file must not remain on disk after stale-PID reclamation'
  );
});

// ---------------------------------------------------------------------------
// T3: Windows EPERM simulation — unlinkSync failure surfaces (not silently swallowed)
// ---------------------------------------------------------------------------
test('T3: lock release does not silently leave lock file on disk when unlink fails (Windows EPERM simulation)', (t) => {
  const configDir = createTempDir();
  const originalUnlinkSync = fs.unlinkSync;

  t.after(() => {
    fs.unlinkSync = originalUnlinkSync;
    cleanup(configDir);
  });

  // The fix uses fs.unlinkSync (not fs.rmSync with { force: true }) in the
  // release closure. Inject EPERM on the lock file to simulate the Windows
  // NTFS condition where the recently-closed handle has not been fully
  // released by the OS.
  //
  // The fix's contract: EPERM must NOT be silently swallowed.
  // Either (a) the error propagates as a releaseError, or (b) some alternative
  // deletion path succeeds. Silent-swallow (no error + file still exists) is
  // the failure condition we guard against.
  let unlinkCallCount = 0;
  fs.unlinkSync = function faultInjectUnlinkSync(targetPath) {
    const isLock = path.basename(String(targetPath)) === INSTALL_MIGRATION_LOCK_NAME;
    if (isLock) {
      unlinkCallCount++;
      // Simulate Windows EPERM (file handle not fully released by OS)
      const err = Object.assign(
        new Error('EPERM: operation not permitted, unlink ' + targetPath),
        { code: 'EPERM' }
      );
      throw err;
    }
    return originalUnlinkSync.call(fs, targetPath);
  };

  // With the fix: unlinkSync throws EPERM → releaseError is thrown by the
  // release closure → runInstallerMigrations throws releaseError.
  // With the buggy code (rmSync + force:true): EPERM was swallowed silently,
  // no error thrown, lock file left on disk.
  //
  // Assert: if the call succeeds (no throw), the lock file must be gone.
  // If the call throws, the error message must reference the lock.
  let threw = false;
  let thrownError = null;
  try {
    runInstallerMigrations({
      configDir,
      migrations: [],
      lockTimeoutMs: 500,
    });
  } catch (err) {
    threw = true;
    thrownError = err;
  }

  if (threw) {
    // Acceptable: error surfaced. Verify it's lock-related (not a bug elsewhere).
    assert.match(
      thrownError.message,
      /lock/i,
      'thrown error must reference the lock file'
    );
  } else {
    // If no error was thrown, the lock file must have been removed by some
    // alternative path (not left silently on disk).
    assert.equal(
      fs.existsSync(lockPath(configDir)),
      false,
      'if unlinkSync EPERM is encountered but no error thrown, lock file must still be removed'
    );
  }

  // Sanity: the fault injection was actually triggered.
  assert.ok(unlinkCallCount > 0, 'unlinkSync must have been called for the lock file at least once');
});

// ---------------------------------------------------------------------------
// T4: Counter-test — normal single acquire/release round-trip still works
// ---------------------------------------------------------------------------
test('T4: normal (non-recursive) runInstallerMigrations acquires and releases lock correctly', (t) => {
  const configDir = createTempDir();
  t.after(() => cleanup(configDir));

  // No pre-seeded lock. Standard happy path.
  const result = runInstallerMigrations({
    configDir,
    migrations: [],
  });

  assert.ok(result, 'runInstallerMigrations must return a result');
  assert.equal(
    fs.existsSync(lockPath(configDir)),
    false,
    'lock file must be cleaned up after normal completion'
  );
});

// ---------------------------------------------------------------------------
// T5: Counter-test — unreclaimable live lock must surface a bounded error
// ---------------------------------------------------------------------------
// This test guards against over-reclamation: if the reclaim-unlink fails
// (e.g. Windows EPERM on a live open handle), the fix must NOT spin
// indefinitely — it must fall through to the timeout path and throw.
//
// Conditions forced by this test:
//   1. Lock file contains the CURRENT process.pid (triggers isSameProcess branch).
//   2. fs.unlinkSync is mocked to throw EPERM for the lock file (reclaim fails).
//   3. lockTimeoutMs: 200 — timeout must fire within a short wall-clock window.
//
// Expected outcome: throws with /installer migration lock is held/ within
// ~200ms. SUCCESS (no throw) is NOT acceptable here — that would mean the fix
// over-reclaimed a lock that it couldn't actually remove.
test('T5: unreclaimable same-PID lock throws bounded error (reclaim-unlink failure falls through to timeout)', (t) => {
  const configDir = createTempDir();
  const originalUnlinkSync = fs.unlinkSync;

  t.after(() => {
    mock.restoreAll();
    fs.unlinkSync = originalUnlinkSync;
    cleanup(configDir);
  });

  // Pre-seed lock file with the CURRENT process's PID.
  // This triggers the isSameProcess reclamation path inside acquireInstallerMigrationLock.
  writeLockFile(configDir, process.pid);

  // Mock unlinkSync to throw EPERM for the lock file only.
  // This simulates Windows NTFS refusing to delete a file with an open handle.
  // With the fix: reclaim-unlink fails → reclaimed=false → falls through to
  //   the timeout check → throws "installer migration lock is held" after ≤200ms.
  // Without the fix (original code): unlink throws but continue runs anyway →
  //   spins indefinitely, never reaches the timeout check → deadlock.
  mock.method(fs, 'unlinkSync', function faultInjectUnlinkSync(targetPath) {
    const isLock = path.basename(String(targetPath)) === INSTALL_MIGRATION_LOCK_NAME;
    if (isLock) {
      const err = Object.assign(
        new Error('EPERM: operation not permitted, unlink ' + targetPath),
        { code: 'EPERM' }
      );
      throw err;
    }
    return originalUnlinkSync.call(fs, targetPath);
  });

  const startMs = Date.now();
  assert.throws(
    () => runInstallerMigrations({
      configDir,
      migrations: [],
      lockTimeoutMs: 200,
    }),
    (err) => {
      assert.match(err.message, /installer migration lock is held/, 'error must name the held lock');
      return true;
    },
    'must throw "installer migration lock is held" when reclaim-unlink fails — not spin indefinitely'
  );
  const elapsedMs = Date.now() - startMs;

  // Must resolve within a generous but finite window (fix + timeout overhead).
  // If it spins (deadlock regression), the process-level test timeout fires instead.
  t.diagnostic(`T5 elapsed: ${elapsedMs}ms (expected ≤500ms for lockTimeoutMs:200 + overhead)`);
  assert.ok(elapsedMs < 500, `T5 must resolve within 500ms; actual ${elapsedMs}ms — possible spin-loop regression`);
});
