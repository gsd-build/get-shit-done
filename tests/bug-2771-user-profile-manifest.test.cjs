/**
 * Regression tests for bug #2771: USER-PROFILE.md tracked in install manifest
 *
 * USER-PROFILE.md is a user-owned artifact created/refreshed by /gsd-profile-user.
 * preserveUserArtifacts() correctly preserves it across reinstalls. But writeManifest()
 * also records it under "get-shit-done/USER-PROFILE.md" with a SHA-256 of whatever was
 * on disk at install time. On the next install, saveLocalPatches() compares the on-disk
 * (refreshed) hash to the manifest hash, finds them different, and emits the spurious
 * "Found N locally modified GSD file(s) — backed up to gsd-local-patches/" warning.
 *
 * Invariant: a file is either distribution (manifest-tracked, diff'd against manifest)
 * or user artifact (preserved across installs, never diff'd). It cannot be both. The
 * shared truth source must be a single USER_OWNED_ARTIFACTS list referenced by both
 * preserveUserArtifacts callers and writeManifest.
 *
 * Closes: #2771
 */

'use strict';

const { describe, test, beforeEach, afterEach, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createTempDir, cleanup } = require('./helpers.cjs');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const MANIFEST_NAME = 'gsd-file-manifest.json';
const PATCHES_DIR_NAME = 'gsd-local-patches';

before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
});

function runInstaller(configDir) {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  delete env.GSD_TEST_MODE;
  return execFileSync(
    process.execPath,
    [INSTALL_SCRIPT, '--claude', '--global', '--yes', '--no-sdk'],
    { encoding: 'utf-8', stdio: 'pipe', env }
  );
}

// ─── Test 1: writeManifest must NOT record USER-PROFILE.md ────────────────────

describe('#2771: USER-PROFILE.md is excluded from gsd-file-manifest.json', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir('gsd-2771-manifest-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('writeManifest excludes get-shit-done/USER-PROFILE.md even when present on disk', () => {
    runInstaller(tmpDir);

    // Simulate /gsd-profile-user creating USER-PROFILE.md
    const profilePath = path.join(tmpDir, 'get-shit-done', 'USER-PROFILE.md');
    fs.writeFileSync(profilePath, '# My Profile\n\nFirst version.\n');

    // Re-install: writeManifest runs again with USER-PROFILE.md present on disk
    runInstaller(tmpDir);

    const manifestPath = path.join(tmpDir, MANIFEST_NAME);
    assert.ok(fs.existsSync(manifestPath), 'manifest must be written');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.ok(
      !Object.prototype.hasOwnProperty.call(manifest.files, 'get-shit-done/USER-PROFILE.md'),
      'manifest.files must NOT contain get-shit-done/USER-PROFILE.md — it is a user artifact, not distribution'
    );
  });
});

// ─── Test 2: preserveUserArtifacts still preserves USER-PROFILE.md ────────────

describe('#2771: USER-PROFILE.md is still preserved across reinstall', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir('gsd-2771-preserve-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('USER-PROFILE.md content survives reinstall (preservation regression guard)', () => {
    runInstaller(tmpDir);

    const profilePath = path.join(tmpDir, 'get-shit-done', 'USER-PROFILE.md');
    const content = '# Profile\n\nUser content from /gsd-profile-user.\n';
    fs.writeFileSync(profilePath, content);

    runInstaller(tmpDir);

    assert.ok(fs.existsSync(profilePath), 'USER-PROFILE.md must survive reinstall');
    assert.strictEqual(fs.readFileSync(profilePath, 'utf8'), content);
  });
});

// ─── Test 3: no spurious "local patches" hit for USER-PROFILE.md refresh ──────

describe('#2771: refreshed USER-PROFILE.md does not trigger local-patches warning', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir('gsd-2771-patches-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('saveLocalPatches does not classify a refreshed USER-PROFILE.md as a local patch', () => {
    // Initial install
    runInstaller(tmpDir);

    // /gsd-profile-user creates USER-PROFILE.md (v1)
    const profilePath = path.join(tmpDir, 'get-shit-done', 'USER-PROFILE.md');
    fs.writeFileSync(profilePath, '# Profile v1\n');

    // Reinstall — manifest written with v1 contents (under buggy code) or excluded (under fix)
    runInstaller(tmpDir);

    // /gsd-profile-user --refresh rewrites USER-PROFILE.md (v2 != v1)
    fs.writeFileSync(profilePath, '# Profile v2 — refreshed\n');

    // Reinstall — saveLocalPatches scans manifest. Under bug, v2 hash != v1 manifest
    // hash → patch detected. Under fix, file is not in manifest → no patch.
    const output = runInstaller(tmpDir);

    const patchesDir = path.join(tmpDir, PATCHES_DIR_NAME);
    const patchFile = path.join(patchesDir, 'get-shit-done', 'USER-PROFILE.md');
    assert.ok(
      !fs.existsSync(patchFile),
      'USER-PROFILE.md must NOT appear in gsd-local-patches/ — it is a user artifact, not a modified distribution file'
    );

    const offendingLine = output
      .split('\n')
      .find((line) => /locally modified GSD file/.test(line) && /USER-PROFILE/.test(line));
    assert.strictEqual(
      offendingLine,
      undefined,
      'installer output must not report USER-PROFILE.md as a locally modified GSD file on any single line. Output was:\n' + output
    );
  });
});

// ─── Test 5: legacy manifest with USER-PROFILE.md entry is normalized ─────────

describe('#2771: legacy manifest entries for USER_OWNED_ARTIFACTS are normalized', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir('gsd-2771-legacy-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('pre-existing manifest entry for USER-PROFILE.md does not trigger patches warning', () => {
    // Initial install
    runInstaller(tmpDir);

    const profilePath = path.join(tmpDir, 'get-shit-done', 'USER-PROFILE.md');
    fs.writeFileSync(profilePath, '# Profile v1\n');

    // Reinstall to populate manifest under the (now-fixed) writer
    runInstaller(tmpDir);

    // Inject a stale manifest entry simulating a pre-#2771 install: a hash for
    // USER-PROFILE.md that does NOT match current content.
    const manifestPath = path.join(tmpDir, MANIFEST_NAME);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.files = manifest.files || {};
    manifest.files['get-shit-done/USER-PROFILE.md'] = 'deadbeef'.repeat(8); // stale hash
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // /gsd-profile-user --refresh rewrites USER-PROFILE.md
    fs.writeFileSync(profilePath, '# Profile v2 — refreshed\n');

    // Reinstall — saveLocalPatches must strip the legacy entry before scanning
    const output = runInstaller(tmpDir);

    const patchesDir = path.join(tmpDir, PATCHES_DIR_NAME);
    const patchFile = path.join(patchesDir, 'get-shit-done', 'USER-PROFILE.md');
    assert.ok(
      !fs.existsSync(patchFile),
      'legacy USER-PROFILE.md manifest entry must be normalized away — not backed up as a patch'
    );

    const offendingLine = output
      .split('\n')
      .find((line) => /locally modified GSD file/.test(line) && /USER-PROFILE/.test(line));
    assert.strictEqual(
      offendingLine,
      undefined,
      'legacy manifest entry must not surface a USER-PROFILE.md patches warning. Output was:\n' + output
    );
  });
});

// ─── Test 4: shared constant exists and is used by both call sites ────────────

describe('#2771: USER_OWNED_ARTIFACTS is a single source of truth', () => {
  test('install.js exports USER_OWNED_ARTIFACTS containing USER-PROFILE.md', () => {
    const origMode = process.env.GSD_TEST_MODE;
    process.env.GSD_TEST_MODE = '1';
    let mod;
    try {
      delete require.cache[require.resolve(INSTALL_SCRIPT)];
      mod = require(INSTALL_SCRIPT);
    } finally {
      if (origMode === undefined) delete process.env.GSD_TEST_MODE;
      else process.env.GSD_TEST_MODE = origMode;
    }

    assert.ok(
      Array.isArray(mod.USER_OWNED_ARTIFACTS) || mod.USER_OWNED_ARTIFACTS instanceof Set,
      'install.js must export USER_OWNED_ARTIFACTS as a single source of truth'
    );
    const list = Array.isArray(mod.USER_OWNED_ARTIFACTS)
      ? mod.USER_OWNED_ARTIFACTS
      : Array.from(mod.USER_OWNED_ARTIFACTS);
    assert.ok(
      list.includes('USER-PROFILE.md'),
      'USER_OWNED_ARTIFACTS must include USER-PROFILE.md'
    );
  });
});

describe('manifest path safety', () => {
  let tmpDir;
  let outside;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-manifest-path-safety-');
    outside = path.join(tmpDir, '..', `outside-managed-file-${path.basename(tmpDir)}.txt`);
  });
  afterEach(() => {
    if (outside) fs.rmSync(outside, { recursive: true, force: true });
    cleanup(tmpDir);
  });

  test('saveLocalPatches ignores manifest entries that escape the install root', () => {
    const origMode = process.env.GSD_TEST_MODE;
    process.env.GSD_TEST_MODE = '1';
    let mod;
    try {
      delete require.cache[require.resolve(INSTALL_SCRIPT)];
      mod = require(INSTALL_SCRIPT);
    } finally {
      if (origMode === undefined) delete process.env.GSD_TEST_MODE;
      else process.env.GSD_TEST_MODE = origMode;
    }

    fs.writeFileSync(outside, 'outside user data\n', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, MANIFEST_NAME),
      JSON.stringify({
        version: 'legacy',
        timestamp: '2026-05-11T00:00:00.000Z',
        files: {
          '../outside-managed-file.txt': 'deadbeef',
        },
      }, null, 2),
      'utf8'
    );

    const modified = mod.saveLocalPatches(tmpDir);

    assert.deepEqual(modified, []);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'outside user data\n');
    assert.equal(fs.existsSync(path.join(tmpDir, PATCHES_DIR_NAME, '..', path.basename(outside))), false);
  });

  test('saveLocalPatches does not follow symlinked patch directories outside the install root', () => {
    const origMode = process.env.GSD_TEST_MODE;
    process.env.GSD_TEST_MODE = '1';
    let mod;
    try {
      delete require.cache[require.resolve(INSTALL_SCRIPT)];
      mod = require(INSTALL_SCRIPT);
    } finally {
      if (origMode === undefined) delete process.env.GSD_TEST_MODE;
      else process.env.GSD_TEST_MODE = origMode;
    }

    const hookPath = path.join(tmpDir, 'hooks', 'managed.js');
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.writeFileSync(hookPath, 'user edited hook\n', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, MANIFEST_NAME),
      JSON.stringify({
        version: 'legacy',
        timestamp: '2026-05-11T00:00:00.000Z',
        files: {
          'hooks/managed.js': crypto.createHash('sha256').update('managed hook\n').digest('hex'),
        },
      }, null, 2),
      'utf8'
    );

    fs.mkdirSync(outside, { recursive: true });
    try {
      fs.symlinkSync(outside, path.join(tmpDir, PATCHES_DIR_NAME), 'dir');
    } catch {
      return;
    }

    const modified = mod.saveLocalPatches(tmpDir);

    assert.deepEqual(modified, []);
    assert.equal(fs.existsSync(path.join(outside, 'hooks', 'managed.js')), false);
  });
});
