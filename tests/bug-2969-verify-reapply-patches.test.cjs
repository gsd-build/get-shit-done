'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2969: /gsd-reapply-patches Step 5 hunk verification gate reports
 * success on lost content because the LLM-driven workflow fills in
 * "verified: yes" without actually checking content presence.
 *
 * Fix: deterministic verifier script (scripts/verify-reapply-patches.cjs)
 * that the workflow calls. The script computes user-added lines from a real
 * diff against the pristine baseline and asserts each significant line is
 * present in the merged installed file. Exits non-zero on any miss.
 *
 * These tests fixture the three relevant directories (patches/pristine/installed)
 * in a tmp dir, run the script as a child process, and assert exit codes +
 * output for each scenario.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-reapply-patches.cjs');

let tmpRoot;
let patchesDir;
let configDir;
let pristineDir;

function fixturePath(rel) { return path.join(tmpRoot, rel); }

function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function runScript(args = []) {
  const result = cp.spawnSync(
    process.execPath,
    [SCRIPT, '--patches-dir', patchesDir, '--config-dir', configDir, '--pristine-dir', pristineDir, ...args],
    { encoding: 'utf8' },
  );
  return result;
}

before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2969-'));
  patchesDir = path.join(tmpRoot, 'patches');
  configDir = path.join(tmpRoot, 'installed');
  pristineDir = path.join(tmpRoot, 'pristine');
  fs.mkdirSync(patchesDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(pristineDir, { recursive: true });
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Bug #2969: deterministic Step 5 verification gate', () => {
  test('exits 0 when every user-added line is present in the merged file', () => {
    // Pristine: 3 stock lines.
    const pristine = 'line one of stock content here\nline two of stock content here\nline three of stock content here\n';
    // User added a meaningful customisation block.
    const userAdded = 'a custom line the user added for behavior X\nanother substantial line that the user inserted\n';
    const backup = pristine + userAdded;
    // Merged result still contains the user's lines.
    const merged = pristine + userAdded;

    writeFile(path.join(pristineDir, 'skills', 'foo', 'SKILL.md'), pristine);
    writeFile(path.join(patchesDir, 'skills', 'foo', 'SKILL.md'), backup);
    writeFile(path.join(configDir, 'skills', 'foo', 'SKILL.md'), merged);

    const r = runScript();
    assert.equal(r.status, 0, `expected pass; stderr=${r.stderr} stdout=${r.stdout}`);
    assert.match(r.stdout, /Failures: 0/);
  });

  test('exits 1 when a user-added significant line is missing from the merged file', () => {
    // Reset fixture
    fs.rmSync(patchesDir, { recursive: true });
    fs.rmSync(configDir, { recursive: true });
    fs.rmSync(pristineDir, { recursive: true });
    fs.mkdirSync(patchesDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(pristineDir);

    const pristine = 'first stock line in the original file here\nsecond stock line in the original file here\n';
    const userAdded = 'this is the visual companion block that must survive\n';
    const backup = pristine + userAdded;
    // Simulate the bug: merged file lost the user's line.
    const merged = pristine;

    writeFile(path.join(pristineDir, 'skills', 'discuss-phase', 'SKILL.md'), pristine);
    writeFile(path.join(patchesDir, 'skills', 'discuss-phase', 'SKILL.md'), backup);
    writeFile(path.join(configDir, 'skills', 'discuss-phase', 'SKILL.md'), merged);

    const r = runScript();
    assert.equal(r.status, 1, `expected fail; stdout=${r.stdout}`);
    assert.match(r.stdout, /Failures: 1/);
    assert.match(r.stdout, /skills\/discuss-phase\/SKILL\.md/);
    assert.match(r.stdout, /visual companion block that must survive/);
  });

  test('exits 1 when the merged installed file has been deleted entirely', () => {
    fs.rmSync(patchesDir, { recursive: true });
    fs.rmSync(configDir, { recursive: true });
    fs.rmSync(pristineDir, { recursive: true });
    fs.mkdirSync(patchesDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(pristineDir);

    const pristine = 'stock line one with substantial content for the test\n';
    const backup = pristine + 'this user customisation should never be lost\n';
    writeFile(path.join(pristineDir, 'workflow.md'), pristine);
    writeFile(path.join(patchesDir, 'workflow.md'), backup);
    // configDir intentionally missing the file.

    const r = runScript();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /installed file missing after merge/);
  });

  test('--json emits structured report parsable by the workflow', () => {
    fs.rmSync(patchesDir, { recursive: true });
    fs.rmSync(configDir, { recursive: true });
    fs.rmSync(pristineDir, { recursive: true });
    fs.mkdirSync(patchesDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(pristineDir);

    const pristine = 'pristine line that is sufficiently long to be significant\n';
    const userAdded = 'extra line the user wrote for their workflow customisation\n';
    writeFile(path.join(pristineDir, 'a.md'), pristine);
    writeFile(path.join(patchesDir, 'a.md'), pristine + userAdded);
    writeFile(path.join(configDir, 'a.md'), pristine); // missing user line

    const r = runScript(['--json']);
    assert.equal(r.status, 1);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.failures, 1);
    assert.equal(parsed.checked, 1);
    assert.equal(parsed.results[0].status, 'fail');
    assert.ok(parsed.results[0].missing.length >= 1);
  });

  test('ignores backup-meta.json — it is metadata, not a patched file', () => {
    fs.rmSync(patchesDir, { recursive: true });
    fs.rmSync(configDir, { recursive: true });
    fs.rmSync(pristineDir, { recursive: true });
    fs.mkdirSync(patchesDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(pristineDir);

    writeFile(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({ files: [] }));

    const r = runScript();
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Checked: 0/);
  });

  test('without --pristine-dir, treats every significant backup line as required (safe over-broad fallback)', () => {
    fs.rmSync(patchesDir, { recursive: true });
    fs.rmSync(configDir, { recursive: true });
    fs.mkdirSync(patchesDir);
    fs.mkdirSync(configDir);

    const backup = 'this is a substantial line of user content here\nanother substantial line that should survive\n';
    // Merged file has only one of the two lines — should fail.
    const merged = 'this is a substantial line of user content here\n';
    writeFile(path.join(patchesDir, 'b.md'), backup);
    writeFile(path.join(configDir, 'b.md'), merged);

    const r = cp.spawnSync(
      process.execPath,
      [SCRIPT, '--patches-dir', patchesDir, '--config-dir', configDir],
      { encoding: 'utf8' },
    );
    assert.equal(r.status, 1);
    assert.match(r.stdout, /another substantial line that should survive/);
  });
});
