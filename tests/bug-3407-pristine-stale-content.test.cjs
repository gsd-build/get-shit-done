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

const { test, describe, beforeEach } = require('node:test');
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
   * Regression test for Codex finding: when gsd-pristine/ entry is absent
   * (e.g., post-buggy-run deletion or first upgrade without prior pristine)
   * but the file is UNCHANGED between old and new release, the hash-validated
   * regeneration path must restore the pristine entry using new-release source.
   *
   * When sha256(newReleaseBytesForFile) === originalHash, the file is identical
   * between releases — new-release generated bytes ARE the old-release pristine
   * and may be safely promoted.
   *
   * Previously (before the regeneration path was added): missing entries were
   * left absent unconditionally, causing permanent over-broad fallback even
   * when the file was unchanged upstream.
   */
  test('gsd-pristine/ is regenerated for missing entries when file is unchanged between releases', () => {
    const SHARED_RELEASE_CONTENT = '# Shared Content\nThis file is identical in v1 and v2.\n';
    const USER_MODIFIED_CONTENT = '# Shared Content\nThis file is identical in v1 and v2.\n## User addition\nCustom.\n';

    const oldHash = sha256(SHARED_RELEASE_CONTENT);
    const relPath = 'test-unchanged-file.md';

    // configDir has user-modified file + manifest with old-release hash
    fs.writeFileSync(path.join(configDir, relPath), USER_MODIFIED_CONTENT);
    fs.writeFileSync(
      path.join(configDir, MANIFEST_NAME),
      JSON.stringify({ version: '1.0.0', files: { [relPath]: oldHash } }, null, 2)
    );

    // fakeSrcDir (new release) has the SAME content — file was not changed upstream
    fs.writeFileSync(path.join(fakeSrcDir, relPath), SHARED_RELEASE_CONTENT);

    // NOTE: gsd-pristine/ does NOT exist (simulating post-buggy-run or first-time scenario)

    INSTALL.saveLocalPatches(configDir, {
      packageSrc: fakeSrcDir,
      runtime: 'claude',
      pathPrefix: '$HOME/.claude/',
      isGlobal: true,
    });

    // The regeneration path should have detected that sha256(new-release candidate)
    // === originalHash, and promoted the candidate into gsd-pristine/.
    const pristineFile = path.join(configDir, 'gsd-pristine', relPath);
    assert.ok(
      fs.existsSync(pristineFile),
      [
        `gsd-pristine/${relPath} must exist after hash-validated regeneration.`,
        `When new-release bytes hash to originalHash, the file was unchanged between`,
        `releases and the candidate should be promoted to restore the pristine baseline.`,
      ].join(' ')
    );

    const actualContent = fs.readFileSync(pristineFile, 'utf8');
    assert.equal(
      sha256(actualContent),
      oldHash,
      [
        `gsd-pristine/${relPath} must contain bytes matching originalHash after regeneration`,
        `(sha256=${oldHash.slice(0, 12)}…)`,
      ].join(' ')
    );
  });

  /**
   * Stale-pristine recovery test (pre-fix bug artifact).
   *
   * Timeline:
   *   Buggy run:  gsd-pristine/<rel> was written with NEW_RELEASE_CONTENT
   *               (the exact #3407 artifact — stale bytes from a buggy populatePristineDir).
   *   Fix run:    saveLocalPatches detects the hash mismatch
   *               (sha256(NEW_RELEASE_CONTENT) !== originalHash recorded in manifest),
   *               removes the stale entry, then attempts regeneration.
   *
   * When the file CHANGED between releases (NEW !== OLD):
   *   - The stale entry is removed.
   *   - Regeneration discards the new-release candidate (hash mismatch).
   *   - gsd-pristine/<rel> must be ABSENT (over-broad fallback — correct).
   *
   * When the file is UNCHANGED between releases (NEW === OLD):
   *   - The stale entry (which happens to have correct bytes despite the bug) is
   *     detected as correct (hash matches originalHash) and PRESERVED.
   *   - gsd-pristine/<rel> must remain present with the correct bytes.
   *
   * This test covers the "file changed across release boundary" case.
   * The "unchanged" case is already covered by the regeneration test above.
   */
  test('stale gsd-pristine/ entry (new-release bytes) is removed when file changed between releases', () => {
    const OLD_RELEASE_CONTENT = '# Old Release\nv1 content here.\n';
    const NEW_RELEASE_CONTENT = '# New Release\nv2 content — upstream changed this.\n';
    const USER_MODIFIED_CONTENT = '# Old Release\nv1 content here.\n## User section\nCustom work.\n';

    const oldHash = sha256(OLD_RELEASE_CONTENT);
    const relPath = 'test-stale-recovery.md';

    // configDir: user-modified file + manifest recording OLD hash
    fs.writeFileSync(path.join(configDir, relPath), USER_MODIFIED_CONTENT);
    fs.writeFileSync(
      path.join(configDir, MANIFEST_NAME),
      JSON.stringify({ version: '1.0.0', files: { [relPath]: oldHash } }, null, 2)
    );

    // fakeSrcDir (new release): contains the NEW content
    fs.writeFileSync(path.join(fakeSrcDir, relPath), NEW_RELEASE_CONTENT);

    // Pre-populate gsd-pristine/ with NEW_RELEASE_CONTENT — the exact pre-fix bug artifact.
    // This simulates a prior buggy run that wrote new-release bytes into the pristine baseline.
    const STALE_BYTES = NEW_RELEASE_CONTENT; // named constant for clarity
    const pristineDir = path.join(configDir, 'gsd-pristine');
    fs.mkdirSync(pristineDir, { recursive: true });
    fs.writeFileSync(path.join(pristineDir, relPath), STALE_BYTES);

    // Verify the pre-condition: stale bytes do NOT match the original hash.
    // If this assert fails, the test fixture is wrong (not a fix regression).
    assert.notEqual(
      sha256(STALE_BYTES),
      oldHash,
      'test fixture check: stale bytes must differ from originalHash'
    );

    INSTALL.saveLocalPatches(configDir, {
      packageSrc: fakeSrcDir,
      runtime: 'claude',
      pathPrefix: '$HOME/.claude/',
      isGlobal: true,
    });

    // The fix must detect the hash mismatch (stale entry) and remove it.
    // The regeneration path discards the new-release candidate (its hash !== oldHash).
    // Result: gsd-pristine/<rel> must be ABSENT — over-broad fallback is the safe outcome.
    const pristineFile = path.join(pristineDir, relPath);
    assert.strictEqual(
      fs.existsSync(pristineFile),
      false,
      [
        `expected gsd-pristine/${relPath} to be absent after stale-pristine recovery.`,
        `The stale entry (new-release bytes, sha256=${sha256(STALE_BYTES).slice(0, 12)}…)`,
        `must be removed; regeneration must discard the candidate because`,
        `sha256(new-release)=${sha256(NEW_RELEASE_CONTENT).slice(0, 12)}… !== originalHash=${oldHash.slice(0, 12)}….`,
        `Presence of the file means the stale bytes were NOT cleaned up (pre-fix behavior).`,
      ].join(' ')
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
    assert.strictEqual(
      fs.existsSync(pristineFile),
      false,
      [
        `expected gsd-pristine/${relPath} to be absent when file changed across release boundary.`,
        `Writing new-release bytes as pristine for a file whose hash is unknown leads to`,
        `false FAIL_USER_LINES_MISSING in the reapply-patches verifier (#3407).`,
        `Over-broad fallback mode is the correct outcome here.`,
      ].join(' ')
    );
  });
});

// The former "Antipattern hunt" describe block (structural typeof checks only) was
// removed — it provided no real behavioral coverage and was a vacuous-truth pattern
// per /test-rigor skill. Behavioral tests for populatePristineDir are covered above.
