/**
 * Regression test for bug #2638.
 *
 * loadConfig previously migrated/synced sub_repos to the TOP-LEVEL
 * `parsed.sub_repos`, but the KNOWN_TOP_LEVEL allowlist only recognizes
 * `planning.sub_repos` (per #2561 — canonical location). That asymmetry
 * made loadConfig write a key it then warns is unknown on the next read.
 *
 * Fix: writers target `parsed.planning.sub_repos` and strip any stale
 * top-level copy during the same migration pass.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createTempProject, cleanup } = require('./helpers.cjs');

const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');

function makeSubRepo(parent, name) {
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
}

function readConfig(tmpDir) {
  return JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8')
  );
}

function writeConfig(tmpDir, obj) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify(obj, null, 2)
  );
}

describe('bug #2638 — sub_repos canonical location', () => {
  let tmpDir;
  let originalCwd;
  let stderrCapture;
  let origStderrWrite;

  beforeEach(() => {
    tmpDir = createTempProject();
    originalCwd = process.cwd();
    stderrCapture = '';
    origStderrWrite = process.stderr.write;
    process.stderr.write = (chunk) => { stderrCapture += chunk; return true; };
  });

  afterEach(() => {
    process.stderr.write = origStderrWrite;
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('does not warn when planning.sub_repos is set (no top-level sub_repos)', () => {
    makeSubRepo(tmpDir, 'backend');
    makeSubRepo(tmpDir, 'frontend');
    writeConfig(tmpDir, {
      planning: { sub_repos: ['backend', 'frontend'] },
    });

    loadConfig(tmpDir);

    assert.ok(
      !stderrCapture.includes('unknown config key'),
      `should not warn for planning.sub_repos, got: ${stderrCapture}`
    );
    assert.ok(
      !stderrCapture.includes('sub_repos'),
      `should not mention sub_repos at all, got: ${stderrCapture}`
    );
  });

  test('migrates legacy multiRepo:true into planning.sub_repos (not top-level)', () => {
    makeSubRepo(tmpDir, 'backend');
    makeSubRepo(tmpDir, 'frontend');
    writeConfig(tmpDir, { multiRepo: true });

    loadConfig(tmpDir);

    const after = readConfig(tmpDir);
    assert.deepStrictEqual(
      after.planning?.sub_repos,
      ['backend', 'frontend'],
      'migration should write to planning.sub_repos'
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(after, 'sub_repos'),
      false,
      'migration must not leave a top-level sub_repos key'
    );
    assert.strictEqual(after.multiRepo, undefined, 'legacy multiRepo should be removed');

    assert.ok(
      !stderrCapture.includes('unknown config key'),
      `post-migration read should not warn, got: ${stderrCapture}`
    );
  });

  test('filesystem sync writes detected list to planning.sub_repos only', () => {
    makeSubRepo(tmpDir, 'api');
    makeSubRepo(tmpDir, 'web');
    writeConfig(tmpDir, { planning: { sub_repos: ['api'] } });

    loadConfig(tmpDir);

    const after = readConfig(tmpDir);
    assert.deepStrictEqual(after.planning?.sub_repos, ['api', 'web']);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(after, 'sub_repos'),
      false,
      'sync must not create a top-level sub_repos key'
    );
    assert.ok(
      !stderrCapture.includes('unknown config key'),
      `sync should not produce unknown-key warning, got: ${stderrCapture}`
    );
  });

  test('stale top-level sub_repos is stripped on load', () => {
    makeSubRepo(tmpDir, 'backend');
    writeConfig(tmpDir, {
      sub_repos: ['backend'],
      planning: { sub_repos: ['backend'] },
    });

    loadConfig(tmpDir);

    const after = readConfig(tmpDir);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(after, 'sub_repos'),
      false,
      'stale top-level sub_repos should be removed to self-heal legacy installs'
    );
    assert.deepStrictEqual(after.planning?.sub_repos, ['backend']);
  });
});
