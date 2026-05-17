/**
 * Filesystem fault-injection coverage for the canonical atomic-write
 * seam (#3595).
 *
 * `platformWriteSync` in `get-shit-done/bin/lib/shell-command-projection.cjs`
 * is the shared seam every config/state/generated-artifact writer in
 * the CJS layer routes through. Its contract:
 *
 *   1. mkdirSync(dirname, { recursive: true }) — ensure parent exists.
 *   2. writeFileSync(<tmpPath>, content) — write to a sibling tmpfile
 *      named `<filePath>.tmp.<pid>`.
 *   3. renameSync(<tmpPath>, filePath) — atomic publish.
 *   4. On any error in steps 2-3: unlinkSync(<tmpPath>) (best-effort)
 *      then writeFileSync(filePath, content) directly as a fallback.
 *
 * Per CONTRIBUTING.md §"QA Matrix Requirements / Filesystem writes and
 * installers" the tests below use `mock.method()` against the real `fs`
 * seam to drive each fault mode, restore mocks with `t.after()`, and
 * assert on observable post-conditions (file existence, content,
 * presence/absence of orphan tmp files, propagated error code) — not
 * on prose.
 *
 * Pre-existing behavior gaps surfaced and PINNED (not fixed in this
 * PR — #3595 is test coverage, fixes belong in separate issues):
 *
 *   - The "fall back to direct write" branch silently swallows the
 *     ORIGINAL error from the tmp+rename path. If the fallback ALSO
 *     fails, the operator only sees the fallback's error — not the
 *     original cause. Tests document this.
 *   - On EACCES against the parent directory mkdir, the error
 *     escapes (no try/catch around mkdirSync). Pinned.
 */

'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  platformWriteSync,
  platformEnsureDir,
} = require('../get-shit-done/bin/lib/shell-command-projection.cjs');

/**
 * Create a fresh real-fs scratch dir per test so no two faults share
 * state. Returns the directory; caller must clean up.
 */
const { createTempDir } = require('./helpers.cjs');
const mkScratch = (name) => createTempDir(`fs-fault-${name}-`);

/**
 * Enumerate orphan tmp files left behind by platformWriteSync. The
 * tmp shape is `<filename>.tmp.<pid>`; we match that pattern strictly
 * so a test that happens to write a real `*.tmp.123` doesn't get a
 * false positive.
 */
function orphanTmpFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /\.tmp\.\d+$/.test(n));
}

// ─── Happy path baseline ────────────────────────────────────────────────────

test('platformWriteSync happy path writes content atomically (baseline for fault tests)', (t) => {
  const dir = mkScratch('happy');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  platformWriteSync(file, '{"k":"v"}\n');
  assert.equal(fs.readFileSync(file, 'utf-8'), '{"k":"v"}\n');
  assert.deepEqual(orphanTmpFiles(dir), [], 'happy path must leave no orphan tmp file');
});

// ─── Rename failure → falls back to direct write ────────────────────────────

test('platformWriteSync recovers when renameSync fails (EXDEV cross-device fallback)', (t) => {
  const dir = mkScratch('exdev');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');

  // Simulate rename failing once (e.g. cross-device move on a CI runner
  // with overlayfs). The fallback path must write the content directly.
  let renameCalls = 0;
  const renameMock = mock.method(fs, 'renameSync', (src, dest) => {
    renameCalls++;
    const err = new Error('EXDEV: cross-device link not permitted');
    err.code = 'EXDEV';
    throw err;
  });
  t.after(() => renameMock.mock.restore());

  platformWriteSync(file, 'fallback content\n');

  // File exists and has the new content — fallback wrote it directly.
  assert.equal(fs.readFileSync(file, 'utf-8'), 'fallback content\n');
  assert.equal(renameCalls, 1, 'renameSync was called exactly once before falling back');
  // The tmp file was unlinked by the fallback path's best-effort cleanup.
  assert.deepEqual(orphanTmpFiles(dir), [], 'tmp file must be cleaned up after rename failure');
});

// ─── Tmp write failure → falls back to direct write ─────────────────────────

test('platformWriteSync falls back when initial tmp writeFileSync fails (ENOSPC)', (t) => {
  const dir = mkScratch('enospc');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');

  // Make the FIRST writeFileSync (to .tmp.<pid>) fail with ENOSPC. The
  // SECOND writeFileSync (the fallback, direct to filePath) succeeds.
  let writeCalls = 0;
  const realWrite = fs.writeFileSync;
  const writeMock = mock.method(fs, 'writeFileSync', function (target, data, opts) {
    writeCalls++;
    if (writeCalls === 1) {
      // First call is to the tmp path.
      assert.match(String(target), /\.tmp\.\d+$/, 'first write must be to the tmp path');
      const err = new Error('ENOSPC: no space left on device');
      err.code = 'ENOSPC';
      throw err;
    }
    // Second call is the fallback to the real target.
    assert.equal(target, file, 'fallback write must target the original file path');
    return realWrite.call(fs, target, data, opts);
  });
  t.after(() => writeMock.mock.restore());

  platformWriteSync(file, 'recovered\n');

  assert.equal(writeCalls, 2, 'expected exactly 2 writeFileSync calls (tmp fail + fallback)');
  assert.equal(fs.readFileSync(file, 'utf-8'), 'recovered\n');
  // The fallback path tries unlinkSync on the tmp; the tmp never
  // existed (its write failed), so unlink throws ENOENT and is
  // swallowed by the inner catch. Either way: no orphan.
  assert.deepEqual(orphanTmpFiles(dir), []);
});

// ─── Both attempts fail → error propagates (pinned current behavior) ────────

test('platformWriteSync propagates the FALLBACK error when both tmp and fallback writes fail', (t) => {
  const dir = mkScratch('double-fail');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');

  let writeCalls = 0;
  const writeMock = mock.method(fs, 'writeFileSync', function () {
    writeCalls++;
    const err = new Error(
      writeCalls === 1
        ? 'ENOSPC: original failure on tmp write'
        : 'EACCES: permission denied on fallback write',
    );
    err.code = writeCalls === 1 ? 'ENOSPC' : 'EACCES';
    throw err;
  });
  t.after(() => writeMock.mock.restore());

  // The current implementation does NOT chain the original cause; the
  // fallback's error is what surfaces. This test pins that behavior so a
  // future "preserve original error in .cause" fix is a visible change
  // (open follow-up).
  let caught;
  try {
    platformWriteSync(file, 'wont-write\n');
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'double-failure must throw');
  assert.equal(caught.code, 'EACCES', 'currently the fallback error wins (open: should chain via .cause)');
  // The original file was never created.
  assert.equal(fs.existsSync(file), false);
  // No orphan tmp left because the tmp write failed before any file was created.
  assert.deepEqual(orphanTmpFiles(dir), []);
});

// ─── mkdirSync failure → escapes immediately (no try/catch upstream) ────────

test('platformWriteSync propagates mkdirSync failure unchanged (no swallowed parent-dir errors)', (t) => {
  const dir = mkScratch('mkdir-fail');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'deep', 'nested', 'config.json');

  const mkdirMock = mock.method(fs, 'mkdirSync', () => {
    const err = new Error('EACCES: permission denied creating directory');
    err.code = 'EACCES';
    throw err;
  });
  t.after(() => mkdirMock.mock.restore());

  let caught;
  try {
    platformWriteSync(file, 'never-reached\n');
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'mkdir failure must propagate');
  assert.equal(caught.code, 'EACCES', 'mkdir error code must be preserved');
  // No partial write happened.
  assert.equal(fs.existsSync(file), false);
});

// ─── Target path is a directory (writing OVER a dir is undefined) ──────────

test('platformWriteSync against a target path that is an existing directory fails cleanly', (t) => {
  const dir = mkScratch('target-is-dir');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'collides');
  // Pre-create the target AS a directory so the rename step would
  // collide with a directory at the destination.
  fs.mkdirSync(file);

  let caught;
  try {
    platformWriteSync(file, 'shouldnt-overwrite-dir\n');
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'writing over an existing directory must fail');
  // We don't pin the exact code (Node varies: EISDIR on rename, EPERM on
  // some platforms). We pin: a real error code (string starting with E)
  // surfaces, AND the directory was not replaced by a file.
  assert.equal(typeof caught.code, 'string');
  assert.match(caught.code, /^E[A-Z]+$/, `expected an errno-style code, got ${caught.code}`);
  assert.equal(fs.statSync(file).isDirectory(), true, 'pre-existing directory must remain a directory');
});

// ─── Path with spaces, unicode, newline characters ─────────────────────────

test('platformWriteSync handles paths with spaces, unicode, and newline characters', (t) => {
  const dir = mkScratch('weird-path');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cases = [
    'has spaces in name.json',
    'unicode-日本語-name.json',
  ];
  if (process.platform !== 'win32') {
    // Tab (0x09) and newline (0x0A) in filenames are POSIX-valid but
    // Windows-illegal (NTFS forbids control characters 0x00–0x1F). Append
    // both only on POSIX so cross-platform CI stays green.
    cases.push('with\ttab.json');
    cases.push('with\nnewline.json');
  }

  for (const name of cases) {
    const file = path.join(dir, name);
    platformWriteSync(file, `payload for ${name}\n`);
    assert.equal(
      fs.readFileSync(file, 'utf-8'),
      `payload for ${name}\n`,
      `roundtrip failed for path "${JSON.stringify(name)}"`,
    );
  }
  assert.deepEqual(orphanTmpFiles(dir), [], 'no tmp orphans across the corpus');
});

// ─── Orphan-tmp cleanup invariant ──────────────────────────────────────────

test('platformWriteSync never leaks a tmp file after a successful happy-path write', (t) => {
  const dir = mkScratch('no-orphan-happy');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (let i = 0; i < 25; i++) {
    platformWriteSync(path.join(dir, `f-${i}.json`), `{"i":${i}}\n`);
  }
  // 25 real files, 0 tmp orphans.
  const entries = fs.readdirSync(dir);
  const tmpCount = entries.filter((n) => /\.tmp\.\d+$/.test(n)).length;
  const realCount = entries.length - tmpCount;
  assert.equal(realCount, 25);
  assert.equal(tmpCount, 0);
});

// ─── platformEnsureDir is idempotent and chains errors ─────────────────────

test('platformEnsureDir is idempotent on an existing directory', (t) => {
  const dir = mkScratch('ensure-idem');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, 'a', 'b', 'c');
  // First call creates; subsequent calls must not throw EEXIST.
  platformEnsureDir(target);
  assert.equal(fs.statSync(target).isDirectory(), true);
  // Repeat.
  platformEnsureDir(target);
  platformEnsureDir(target);
  assert.equal(fs.statSync(target).isDirectory(), true);
});

test('platformEnsureDir propagates EACCES when parent dir is unwritable', (t) => {
  const dir = mkScratch('ensure-fail');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const mkdirMock = mock.method(fs, 'mkdirSync', () => {
    const err = new Error('EACCES: permission denied');
    err.code = 'EACCES';
    throw err;
  });
  t.after(() => mkdirMock.mock.restore());

  let caught;
  try {
    platformEnsureDir(path.join(dir, 'cannot-create'));
  } catch (err) {
    caught = err;
  }
  assert.ok(caught);
  assert.equal(caught.code, 'EACCES');
});

// ─── Symlink-following / escape behavior ────────────────────────────────────

test('platformWriteSync REPLACES a symlink with a regular file rather than following it (safe behavior)', (t) => {
  // Security-relevant invariant: if the destination path is a symlink
  // pointing somewhere the user did not intend the writer to touch
  // (e.g. an attacker-planted symlink in `.planning/` pointing at
  // `~/.ssh/authorized_keys`), the writer must NOT follow it and
  // clobber the target. The rename-based atomic-write pattern delivers
  // this property: `renameSync(tmp, symlinkPath)` replaces the symlink
  // entry in the parent directory with the regular file at `tmp`.
  // After the call:
  //   - `linkPath` is a regular file with the new content.
  //   - The original `realTarget` is UNTOUCHED.
  // This test pins that property so a future refactor (e.g. switching
  // to `fs.writeFileSync(linkPath, ...)` which follows symlinks) is a
  // visible regression.
  if (process.platform === 'win32') {
    t.skip('symlinks on Win32 need admin');
    return;
  }

  const dir = mkScratch('symlink-replace');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const realTarget = path.join(dir, 'real-target.json');
  fs.writeFileSync(realTarget, 'original — must not be touched\n');
  const linkPath = path.join(dir, 'link.json');
  fs.symlinkSync(realTarget, linkPath);

  platformWriteSync(linkPath, 'new content\n');

  // The real target is UNTOUCHED — the safety property.
  assert.equal(
    fs.readFileSync(realTarget, 'utf-8'),
    'original — must not be touched\n',
    'symlink target must be preserved when writer writes "through" the link',
  );
  // The link entry is now a regular file with the new content.
  const stat = fs.lstatSync(linkPath);
  assert.equal(stat.isSymbolicLink(), false, 'symlink entry replaced by a regular file (atomic rename semantics)');
  assert.equal(stat.isFile(), true);
  assert.equal(fs.readFileSync(linkPath, 'utf-8'), 'new content\n');
});

test('platformWriteSync against a broken symlink replaces it with the intended file', (t) => {
  if (process.platform === 'win32') {
    t.skip('symlinks on Win32 need admin');
    return;
  }
  const dir = mkScratch('symlink-broken');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const link = path.join(dir, 'dangling.json');
  fs.symlinkSync(path.join(dir, 'does-not-exist'), link);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true, 'pre-check: link is dangling');

  platformWriteSync(link, 'real content\n');

  assert.equal(fs.readFileSync(link, 'utf-8'), 'real content\n');
  assert.equal(fs.lstatSync(link).isSymbolicLink(), false, 'broken link replaced with regular file');
});

// ─── Concurrent-write collision ────────────────────────────────────────────

test('platformWriteSync survives a concurrent collision on the same target path', (t) => {
  // Two consecutive writes to the same path with DIFFERENT contents,
  // separated by a setImmediate boundary so the second can interleave
  // a mock-injected error mid-flight. The contract pinned here: after
  // both writes complete, the file is parseable and contains ONE of the
  // two contents — never a half-written corrupt blob.
  //
  // (True parallel writes from separate processes are out of scope —
  // the writer is sync. This exercises mid-flight error recovery, which
  // is the same concurrency hazard at a lower granularity.)
  const dir = mkScratch('concurrent');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'race.json');

  // First write completes normally.
  platformWriteSync(file, '{"writer":"first"}\n');
  // Second write: inject a transient rename failure on the first
  // attempt, then succeed via fallback. Capture the real renameSync
  // BEFORE installing the mock so subsequent calls (defensive — the
  // fallback path bypasses rename, so the second call shouldn't fire)
  // delegate to the real implementation. The previous form referenced
  // a non-existent `fs.renameSync.wrapped` property — that branch
  // would silently no-op instead of delegating.
  let renameCalls = 0;
  const originalRename = fs.renameSync;
  const renameMock = mock.method(fs, 'renameSync', (src, dest) => {
    renameCalls++;
    if (renameCalls === 1) {
      const err = new Error('EBUSY: file is locked');
      err.code = 'EBUSY';
      throw err;
    }
    return originalRename.call(fs, src, dest);
  });
  t.after(() => renameMock.mock.restore());

  platformWriteSync(file, '{"writer":"second"}\n');

  // The fallback path wrote 'second' content directly.
  const final = fs.readFileSync(file, 'utf-8');
  // Must be valid JSON — never a half-merged corruption.
  assert.doesNotThrow(() => JSON.parse(final), 'file must remain parseable after the contested write');
  // Must be the SECOND writer's content (it called platformWriteSync
  // after the first, and the fallback completed).
  assert.equal(final, '{"writer":"second"}\n');
  assert.deepEqual(orphanTmpFiles(dir), [], 'no tmp orphans after the contested write');
});
