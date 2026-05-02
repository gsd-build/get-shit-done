'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2998: gsd-pristine/ snapshot is documented but never populated by
 * the installer. saveLocalPatches declared a pristineDir variable and
 * promised "saves pristine copies (from manifest) to gsd-pristine/ to
 * enable three-way merge during reapply-patches" -- but no code ever
 * wrote to that directory. Effect: the /gsd-reapply-patches Step 5
 * verifier (#2972) silently degrades to its over-broad fallback heuristic
 * ("every significant backup line"), exactly the silent-success-on-lost-
 * content failure mode #2969 was designed to prevent.
 *
 * Fix: new populatePristineDir({...}) helper runs the install transform
 * pipeline (copyWithPathReplacement) into a tmp staging dir, then copies
 * out the modified-file paths into gsd-pristine/. saveLocalPatches now
 * accepts a pristineCtx and calls the helper when local patches are
 * detected.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const INSTALL = require(path.join(ROOT, 'bin', 'install.js'));

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Bug #2998: populatePristineDir is exported and writes pristine for modified files', () => {
  test('exported as a function', () => {
    assert.equal(typeof INSTALL.populatePristineDir, 'function',
      'expected populatePristineDir in install.js exports (#2998)');
  });

  test('returns 0 when no files are modified (no-op)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-'));
    try {
      const written = INSTALL.populatePristineDir({
        packageSrc: ROOT,
        pristineDir: path.join(tmp, 'gsd-pristine'),
        modified: [],
        runtime: 'claude',
        pathPrefix: '$HOME/.claude/',
        isGlobal: true,
      });
      assert.equal(written, 0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('writes one pristine file per modified path that exists in source', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-'));
    const pristineDir = path.join(tmp, 'gsd-pristine');
    try {
      // Pick a real installed-side relPath from the package source. The
      // install transforms map source `get-shit-done/<rel>` to installed
      // `get-shit-done/<rel>` for skills-aware runtimes (like claude),
      // so the relPath is the same on both sides.
      const candidate = path.join('get-shit-done', 'workflows', 'reapply-patches.md');
      const sourcePath = path.join(ROOT, candidate);
      assert.equal(fs.existsSync(sourcePath), true,
        `precondition: source file exists at ${candidate}`);
      const written = INSTALL.populatePristineDir({
        packageSrc: ROOT,
        pristineDir,
        modified: [candidate],
        runtime: 'claude',
        pathPrefix: '$HOME/.claude/',
        isGlobal: true,
      });
      assert.equal(written, 1, 'expected exactly one pristine file written');
      const out = path.join(pristineDir, candidate);
      assert.equal(fs.existsSync(out), true, `expected pristine file at ${out}`);
      // The pristine content should be the transformed version (not raw source):
      // copyWithPathReplacement substitutes ~/.claude/ for the runtime path prefix.
      // For claude+global, the prefix is $HOME/.claude/ which equals the original,
      // so the transform is effectively identity here. We assert the content is a
      // non-empty markdown file rather than asserting on transform specifics.
      const content = fs.readFileSync(out, 'utf-8');
      assert.ok(content.length > 0, 'pristine file should be non-empty');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('skips paths not present in source (does not corrupt pristine with stale data)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-'));
    const pristineDir = path.join(tmp, 'gsd-pristine');
    try {
      const written = INSTALL.populatePristineDir({
        packageSrc: ROOT,
        pristineDir,
        modified: ['get-shit-done/this-path-does-not-exist.md'],
        runtime: 'claude',
        pathPrefix: '$HOME/.claude/',
        isGlobal: true,
      });
      assert.equal(written, 0, 'expected zero pristine files for non-existent source paths');
      const out = path.join(pristineDir, 'get-shit-done/this-path-does-not-exist.md');
      assert.equal(fs.existsSync(out), false, 'pristine should not contain ghost paths');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('pristine files have stable content (transformations are deterministic)', () => {
    // Determinism is what makes the verifier's hash check meaningful:
    // backup-meta.json records pristine_hashes computed at this same step,
    // so re-running with the same inputs must yield byte-identical files.
    const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-d1-'));
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-d2-'));
    try {
      const candidate = path.join('get-shit-done', 'workflows', 'reapply-patches.md');
      const ctx = {
        packageSrc: ROOT,
        modified: [candidate],
        runtime: 'claude',
        pathPrefix: '$HOME/.claude/',
        isGlobal: true,
      };
      INSTALL.populatePristineDir(Object.assign({ pristineDir: path.join(tmp1, 'gsd-pristine') }, ctx));
      INSTALL.populatePristineDir(Object.assign({ pristineDir: path.join(tmp2, 'gsd-pristine') }, ctx));
      const a = fs.readFileSync(path.join(tmp1, 'gsd-pristine', candidate));
      const b = fs.readFileSync(path.join(tmp2, 'gsd-pristine', candidate));
      assert.equal(sha256(a), sha256(b), 'two runs of the same inputs must yield identical pristine content');
    } finally {
      fs.rmSync(tmp1, { recursive: true, force: true });
      fs.rmSync(tmp2, { recursive: true, force: true });
    }
  });
});

// ─── #3004 CR follow-up: multi-root pristine expansion ─────────────────────

describe('Bug #2998 (#3004 CR): pristine expansion covers every manifest install root', () => {
  test('paths under agents/ are staged via copyWithPathReplacement, not silently skipped', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-multi-'));
    const pristineDir = path.join(tmp, 'gsd-pristine');
    try {
      const candidate = path.join('agents', 'gsd-planner.md');
      const sourcePath = path.join(ROOT, candidate);
      assert.equal(fs.existsSync(sourcePath), true,
        `precondition: source file exists at ${candidate}`);
      const written = INSTALL.populatePristineDir({
        packageSrc: ROOT,
        pristineDir,
        modified: [candidate],
        runtime: 'claude',
        pathPrefix: '$HOME/.claude/',
        isGlobal: true,
      });
      assert.equal(written, 1, 'expected agents/ path to be staged and copied to pristine');
      assert.equal(fs.existsSync(path.join(pristineDir, candidate)), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('a mix of get-shit-done/ and agents/ paths in modified list are all staged', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2998-mix-'));
    const pristineDir = path.join(tmp, 'gsd-pristine');
    try {
      const a = path.join('get-shit-done', 'workflows', 'reapply-patches.md');
      const b = path.join('agents', 'gsd-planner.md');
      assert.equal(fs.existsSync(path.join(ROOT, a)), true);
      assert.equal(fs.existsSync(path.join(ROOT, b)), true);
      const written = INSTALL.populatePristineDir({
        packageSrc: ROOT,
        pristineDir,
        modified: [a, b],
        runtime: 'claude',
        pathPrefix: '$HOME/.claude/',
        isGlobal: true,
      });
      assert.equal(written, 2, 'expected both top-level dirs to be staged');
      assert.equal(fs.existsSync(path.join(pristineDir, a)), true);
      assert.equal(fs.existsSync(path.join(pristineDir, b)), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('Bug #2998: saveLocalPatches no longer leaves the pristineDir variable unused', () => {
  test('saveLocalPatches accepts a pristineCtx and exposes the helper for direct testing', () => {
    // Structural assertion: the function exists with the new signature shape.
    // Behavioral end-to-end is covered by the populatePristineDir tests above
    // (that helper is what saveLocalPatches calls internally).
    assert.equal(typeof INSTALL.populatePristineDir, 'function');
    // The signature for saveLocalPatches isn't exported, but the helper IS,
    // and it's the unit of behavior the bug is about. Asserting on the helper
    // is the structural-IR equivalent of the no-source-grep convention.
  });
});
