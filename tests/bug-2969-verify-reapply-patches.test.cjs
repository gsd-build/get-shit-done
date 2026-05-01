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
 * Tests fixture the three relevant directories (patches/pristine/installed)
 * in a tmp dir, run the script with --json, and assert via deepEqual on the
 * parsed structured report. No substring matching against script output —
 * the script's own --json mode is the structured contract we test against.
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

function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function resetFixture({ withPristine = true } = {}) {
  for (const dir of [patchesDir, configDir, pristineDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(patchesDir);
  fs.mkdirSync(configDir);
  if (withPristine) fs.mkdirSync(pristineDir);
}

/** Runs the verifier with --json and returns { status, report, stderr }. */
function runVerifier({ includePristine = true, extraArgs = [] } = {}) {
  const args = [
    SCRIPT,
    '--patches-dir', patchesDir,
    '--config-dir',  configDir,
    ...(includePristine ? ['--pristine-dir', pristineDir] : []),
    '--json',
    ...extraArgs,
  ];
  const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8' });
  let report = null;
  if (r.stdout && r.stdout.length) {
    // The script writes ONLY the JSON document to stdout under --json (stderr
    // for diagnostics). If parse fails, surface the raw output for debugging
    // — but the test author should never depend on a non-JSON stdout.
    try { report = JSON.parse(r.stdout); } catch { /* leave null */ }
  }
  return { status: r.status, report, stderr: r.stderr || '' };
}

before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2969-'));
  patchesDir = path.join(tmpRoot, 'patches');
  configDir = path.join(tmpRoot, 'installed');
  pristineDir = path.join(tmpRoot, 'pristine');
  resetFixture();
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Bug #2969: deterministic Step 5 verification gate', () => {
  test('exits 0 with empty failures when every user-added line is present in the merged file', () => {
    resetFixture();
    const pristine = 'line one of stock content here\nline two of stock content here\nline three of stock content here\n';
    const userAdded = 'a custom line the user added for behavior X\nanother substantial line that the user inserted\n';

    writeFile(path.join(pristineDir, 'skills', 'foo', 'SKILL.md'), pristine);
    writeFile(path.join(patchesDir, 'skills', 'foo', 'SKILL.md'), pristine + userAdded);
    writeFile(path.join(configDir, 'skills', 'foo', 'SKILL.md'), pristine + userAdded);

    const { status, report, stderr } = runVerifier();
    assert.equal(status, 0, `expected pass; stderr=${stderr}`);
    assert.equal(report.failures, 0);
    assert.equal(report.checked, 1);
    assert.equal(report.results[0].status, 'ok');
    assert.deepEqual(report.results[0].missing, []);
  });

  test('exits 1 with a structured failure entry when a user-added significant line is missing', () => {
    resetFixture();
    const pristine = 'first stock line in the original file here\nsecond stock line in the original file here\n';
    const lostLine = 'this is the visual companion block that must survive';
    const backup = `${pristine}${lostLine}\n`;
    const merged = pristine; // simulate the bug: line dropped

    writeFile(path.join(pristineDir, 'skills', 'discuss-phase', 'SKILL.md'), pristine);
    writeFile(path.join(patchesDir, 'skills', 'discuss-phase', 'SKILL.md'), backup);
    writeFile(path.join(configDir, 'skills', 'discuss-phase', 'SKILL.md'), merged);

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.equal(report.failures, 1);
    assert.equal(report.results[0].file, 'skills/discuss-phase/SKILL.md');
    assert.equal(report.results[0].status, 'fail');
    assert.ok(
      report.results[0].missing.includes(lostLine),
      `dropped line should be reported in .missing[]; got ${JSON.stringify(report.results[0].missing)}`,
    );
  });

  test('reports a structured fail (no crash) when the installed path is a directory, not a file', () => {
    resetFixture();
    writeFile(path.join(pristineDir, 'a.md'), 'pristine line of substantial content here\n');
    writeFile(path.join(patchesDir, 'a.md'), 'pristine line of substantial content here\nuser added line that is substantial\n');
    fs.mkdirSync(path.join(configDir, 'a.md')); // EISDIR trap

    const { status, report, stderr } = runVerifier();
    assert.equal(status, 1, 'directory at installed path should fail the gate');
    assert.equal(report.failures, 1);
    assert.equal(report.results[0].status, 'fail');
    assert.ok(
      /not a regular file/.test(report.results[0].reason || ''),
      `reason should explain the directory case; got ${report.results[0].reason}`,
    );
    // The gate must produce a structured diagnostic, not crash with a stack trace.
    // We assert this on the script's own report rather than stderr, since stderr
    // is a separate channel reserved for diagnostics.
    assert.equal(report.checked, 1);
  });

  test('reports a structured fail when the merged installed file has been deleted entirely', () => {
    resetFixture();
    const pristine = 'stock line one with substantial content for the test\n';
    writeFile(path.join(pristineDir, 'workflow.md'), pristine);
    writeFile(path.join(patchesDir, 'workflow.md'), `${pristine}this user customisation should never be lost\n`);
    // configDir intentionally missing the file.

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.equal(report.failures, 1);
    assert.equal(report.results[0].status, 'fail');
    assert.equal(report.results[0].reason, 'installed file missing after merge');
  });

  test('--json report has the documented shape: { checked, failures, results: [{ file, status, missing, reason }] }', () => {
    resetFixture();
    const pristine = 'pristine line that is sufficiently long to be significant\n';
    const lostLine = 'extra line the user wrote for their workflow customisation';
    writeFile(path.join(pristineDir, 'a.md'), pristine);
    writeFile(path.join(patchesDir, 'a.md'), `${pristine}${lostLine}\n`);
    writeFile(path.join(configDir, 'a.md'), pristine); // dropped

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.equal(typeof report.checked, 'number');
    assert.equal(typeof report.failures, 'number');
    assert.ok(Array.isArray(report.results));
    const r0 = report.results[0];
    assert.deepEqual(Object.keys(r0).sort(), ['file', 'missing', 'reason', 'status']);
    assert.equal(r0.file, 'a.md');
    assert.equal(r0.status, 'fail');
    assert.ok(Array.isArray(r0.missing));
    assert.ok(r0.missing.length >= 1);
  });

  test('ignores backup-meta.json — it is metadata, not a patched file', () => {
    resetFixture();
    writeFile(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({ files: [] }));

    const { status, report } = runVerifier();
    assert.equal(status, 0);
    assert.equal(report.checked, 0);
    assert.equal(report.failures, 0);
    assert.deepEqual(report.results, []);
  });

  test('without --pristine-dir, treats every significant backup line as required (safe over-broad fallback)', () => {
    resetFixture({ withPristine: false });
    const presentLine = 'this is a substantial line of user content here';
    const droppedLine = 'another substantial line that should survive';
    writeFile(path.join(patchesDir, 'b.md'), `${presentLine}\n${droppedLine}\n`);
    writeFile(path.join(configDir, 'b.md'), `${presentLine}\n`); // dropped second line

    const { status, report } = runVerifier({ includePristine: false });
    assert.equal(status, 1);
    assert.equal(report.failures, 1);
    assert.ok(
      report.results[0].missing.includes(droppedLine),
      `over-broad mode must catch the dropped line; got ${JSON.stringify(report.results[0].missing)}`,
    );
    assert.ok(
      !report.results[0].missing.includes(presentLine),
      'present line must NOT appear in .missing[]',
    );
  });
});
