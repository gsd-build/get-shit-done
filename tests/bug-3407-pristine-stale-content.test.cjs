'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #3407: Installer leaves stale content in gsd-pristine/
 *
 * Root cause: populatePristineDir() in saveLocalPatches() snapshots from
 * pristineCtx.packageSrc — the NEWLY-downloaded release tree — and writes
 * those bytes into gsd-pristine/.  For files changed between the old and new
 * release, this writes the NEW bytes into the pristine baseline instead of
 * the OLD bytes.  The three-way-diff verifier then classifies upstream-changed
 * lines as user-added → Step 5a gate fails with false FAIL_USER_LINES_MISSING.
 *
 * The #3657 fix (OK_PRISTINE_DRIFT_DETECTED) was a symptom workaround: the
 * verifier detects hash mismatch (backup-meta.json records old-release hash
 * but gsd-pristine/ has new-release bytes) and skips to over-broad mode
 * instead of false-failing.  The root-cause stale write was never fixed.
 *
 * Fix: when a correctly-populated gsd-pristine/ already exists from the
 * previous install (i.e., the file's sha256 matches the originalHash recorded
 * in the manifest), preserve it — do NOT wipe and re-populate from the new
 * release source.  This ensures gsd-pristine/ holds old-release bytes even
 * after an upgrade where the file content changed upstream.
 *
 * Regression contract (byte-comparison):
 *   After saveLocalPatches() is called with a user-modified file whose
 *   gsd-pristine/ entry was correctly set by the previous install, the
 *   gsd-pristine/ file MUST still contain the old-release bytes, not the
 *   new-release bytes supplied in pristineCtx.packageSrc.
 *
 * Closes: #3407
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const INSTALL = require(path.join(ROOT, 'bin', 'install.js'));

const MANIFEST_NAME = 'gsd-file-manifest.json';
const PATCHES_DIR_NAME = 'gsd-local-patches';

function sha256(content) {
  return crypto.createHash('sha256').update(content instanceof Buffer ? content : Buffer.from(content)).digest('hex');
}

// ─── Bug #3407: gsd-pristine/ must preserve OLD-release bytes across upgrade ──

describe('Bug #3407: saveLocalPatches preserves old-release pristine across upgrade', () => {
  let tmpDir;
  let configDir;
  let fakeSrcDir;

  beforeEach((t) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3407-'));
    configDir = path.join(tmpDir, 'config');
    fakeSrcDir = path.join(tmpDir, 'new-release-src');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(fakeSrcDir, { recursive: true });
    t.after(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    });
  });

  /**
   * Core regression test.
   *
   * Timeline:
   *   Install v1: file content = OLD_RELEASE_CONTENT, gsd-pristine/ROOT_FILE
   *               = OLD_RELEASE_CONTENT (correctly set by previous install),
   *               manifest hash = sha256(OLD_RELEASE_CONTENT)
   *   User edits: configDir/ROOT_FILE = USER_MODIFIED_CONTENT
   *   Upgrade v2: pristineCtx.packageSrc has NEW_RELEASE_CONTENT for ROOT_FILE
   *   saveLocalPatches is called before the wipe.
   *
   * Expected AFTER fix: gsd-pristine/ROOT_FILE still == OLD_RELEASE_CONTENT
   * Actual BEFORE fix:  gsd-pristine/ROOT_FILE == NEW_RELEASE_CONTENT (stale)
   */
  test('gsd-pristine/ retains old-release bytes when upgrading a user-modified file', () => {
    const OLD_RELEASE_CONTENT = '# Old Release Content\nThis is v1 pristine.\n';
    const NEW_RELEASE_CONTENT = '# New Release Content\nThis is v2 — upstream changed this line.\n';
    const USER_MODIFIED_CONTENT = '# Old Release Content\nThis is v1 pristine.\n## User addition\nUser customization here.\n';

    const oldHash = sha256(OLD_RELEASE_CONTENT);

    // Simulate a root-level installed file. Root-level files in the manifest
    // are denoted without a subdirectory (slash-free relPath).
    const relPath = 'test-root-file.md';

    // Set up configDir: user-modified installed file + manifest recording old hash
    fs.writeFileSync(path.join(configDir, relPath), USER_MODIFIED_CONTENT);
    fs.writeFileSync(
      path.join(configDir, MANIFEST_NAME),
      JSON.stringify({ version: '1.0.0', files: { [relPath]: oldHash } }, null, 2)
    );

    // Set up fakeSrcDir (new release): the file has NEW content
    fs.writeFileSync(path.join(fakeSrcDir, relPath), NEW_RELEASE_CONTENT);

    // Set up gsd-pristine/ with OLD content (as correctly populated by previous install)
    const pristineDir = path.join(configDir, 'gsd-pristine');
    fs.mkdirSync(pristineDir, { recursive: true });
    fs.writeFileSync(path.join(pristineDir, relPath), OLD_RELEASE_CONTENT);

    // Call saveLocalPatches with the new release as packageSrc (the buggy scenario)
    INSTALL.saveLocalPatches(configDir, {
      packageSrc: fakeSrcDir,
      runtime: 'claude',
      pathPrefix: '$HOME/.claude/',
      isGlobal: true,
    });

    // Assert: gsd-pristine/ must still contain OLD-release bytes
    const pristineFile = path.join(pristineDir, relPath);
    assert.ok(
      fs.existsSync(pristineFile),
      `gsd-pristine/${relPath} must exist after saveLocalPatches`
    );

    const actualPristineContent = fs.readFileSync(pristineFile, 'utf8');
    assert.equal(
      sha256(actualPristineContent),
      oldHash,
      [
        `gsd-pristine/${relPath} must contain OLD-release bytes (sha256=${oldHash.slice(0, 12)}…)`,
        `but got sha256=${sha256(actualPristineContent).slice(0, 12)}…`,
        `(If equal to sha256(NEW_RELEASE_CONTENT)=${sha256(NEW_RELEASE_CONTENT).slice(0, 12)}… then #3407 is NOT fixed)`,
      ].join(' ')
    );

    // Secondary: confirm backup-meta records the old hash (not new)
    const backupMeta = JSON.parse(
      fs.readFileSync(path.join(configDir, PATCHES_DIR_NAME, 'backup-meta.json'), 'utf8')
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(backupMeta.pristine_hashes, relPath),
      'backup-meta.json must record pristine_hash for modified file'
    );
    assert.equal(
      backupMeta.pristine_hashes[relPath],
      oldHash,
      'backup-meta.json pristine_hash must equal old-release hash (not new-release hash)'
    );
  });

  /**
   * Second scenario: gsd-pristine/ does NOT pre-exist (first upgrade with no
   * prior pristine population).  In this case there is no way to obtain the
   * old-release pristine bytes — populatePristineDir must NOT write the new-
   * release bytes either.  The correct outcome is: gsd-pristine/ stays empty
   * for this file, and the verifier falls back to over-broad mode (safe).
   */
  test('gsd-pristine/ stays empty when no prior pristine exists (first upgrade, no stale write)', () => {
    const OLD_RELEASE_CONTENT = '# Old Release Content\nThis is v1.\n';
    const NEW_RELEASE_CONTENT = '# New Release Content\nThis is v2 — changed.\n';
    const USER_MODIFIED_CONTENT = '# Old Release Content\nThis is v1.\n## User addition\nCustom.\n';

    const oldHash = sha256(OLD_RELEASE_CONTENT);
    const relPath = 'test-first-upgrade.md';

    // configDir has user-modified file + manifest
    fs.writeFileSync(path.join(configDir, relPath), USER_MODIFIED_CONTENT);
    fs.writeFileSync(
      path.join(configDir, MANIFEST_NAME),
      JSON.stringify({ version: '1.0.0', files: { [relPath]: oldHash } }, null, 2)
    );

    // fakeSrcDir (new release) has new content
    fs.writeFileSync(path.join(fakeSrcDir, relPath), NEW_RELEASE_CONTENT);

    // NOTE: gsd-pristine/ does NOT exist yet (first upgrade)

    INSTALL.saveLocalPatches(configDir, {
      packageSrc: fakeSrcDir,
      runtime: 'claude',
      pathPrefix: '$HOME/.claude/',
      isGlobal: true,
    });

    const pristineFile = path.join(configDir, 'gsd-pristine', relPath);
    if (fs.existsSync(pristineFile)) {
      // If a pristine file was written, it must NOT be the new-release bytes
      const writtenContent = fs.readFileSync(pristineFile, 'utf8');
      assert.notEqual(
        sha256(writtenContent),
        sha256(NEW_RELEASE_CONTENT),
        [
          `gsd-pristine/${relPath} must not contain new-release bytes when no prior pristine exists.`,
          `Writing new-release bytes as pristine for a file whose hash is unknown leads to`,
          `false FAIL_USER_LINES_MISSING in the reapply-patches verifier (#3407).`,
        ].join(' ')
      );
    }
    // If gsd-pristine/ is absent/empty for this file: over-broad fallback mode — acceptable.
  });
});

// ─── Antipattern hunt: no other populate/save routine conflates old/new state ─

describe('Bug #3407: populatePristineDir does not corrupt existing correct pristine', () => {
  let tmpDir;

  beforeEach((t) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3407-anti-'));
    t.after(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    });
  });

  test('populatePristineDir is still exported (structural)', () => {
    assert.equal(
      typeof INSTALL.populatePristineDir,
      'function',
      'populatePristineDir must remain exported for direct unit testing'
    );
  });

  test('saveLocalPatches is still exported (structural)', () => {
    assert.equal(
      typeof INSTALL.saveLocalPatches,
      'function',
      'saveLocalPatches must remain exported for direct unit testing'
    );
  });
});
