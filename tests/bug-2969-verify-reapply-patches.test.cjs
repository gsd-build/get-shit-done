'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2969: /gsd-reapply-patches Step 5 hunk verification gate reports
 * success on lost content because the LLM-driven workflow fills in
 * "verified: yes" without actually checking content presence.
 *
 * Fix: deterministic verifier script (scripts/verify-reapply-patches.cjs)
 * that the workflow calls.
 *
 * Per the repo's no-source-grep testing standard (CONTRIBUTING.md):
 * tests must assert on TYPED structured fields — not regex/substring
 * matching against script output, formatter prose, or file content.
 *
 * The script's --json mode emits a structured report whose `reason`
 * field is a stable enum (exposed as REASON), and whose `missing` field
 * is an array of typed strings (exact set membership, not substring).
 * Every assertion below is a deepEqual / equal / Array.includes against
 * those typed fields. Zero regex, zero String#includes on text.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
// Script lives at get-shit-done/bin/ so the installer ships it under
// `${GSD_HOME}/get-shit-done/bin/` (issue #2994). The top-level scripts/
// directory is not copied to user installs.
const SCRIPT = path.join(ROOT, 'get-shit-done', 'bin', 'verify-reapply-patches.cjs');
const { REASON } = require(SCRIPT);

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

/** Runs the verifier with --json. Returns parsed structured report. */
function runVerifier({ includePristine = true } = {}) {
  const args = [
    SCRIPT,
    '--patches-dir', patchesDir,
    '--config-dir',  configDir,
    ...(includePristine ? ['--pristine-dir', pristineDir] : []),
    '--json',
  ];
  const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8' });
  return {
    status: r.status,
    report: r.stdout && r.stdout.length ? JSON.parse(r.stdout) : null,
  };
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
  test('REASON enum exposes the documented set of stable codes', () => {
    // Locks the public diagnostic surface — adding a code requires updating
    // this assertion, removing one breaks consumers that switch on the enum.
    assert.deepEqual(
      Object.keys(REASON).sort(),
      [
        'FAIL_INSTALLED_MISSING',
        'FAIL_INSTALLED_NOT_REGULAR_FILE',
        'FAIL_READ_ERROR',
        'FAIL_USER_LINES_MISSING',
        'OK_NO_SIGNIFICANT_BACKUP_LINES',
        'OK_NO_USER_LINES_VS_PRISTINE',
      ],
    );
  });

  test('exits 0 with status=ok when every user-added line is present in the merged file', () => {
    resetFixture();
    const pristine = 'line one of stock content here\nline two of stock content here\nline three of stock content here\n';
    const userAdded = 'a custom line the user added for behavior X\nanother substantial line that the user inserted\n';

    writeFile(path.join(pristineDir, 'skills', 'foo', 'SKILL.md'), pristine);
    writeFile(path.join(patchesDir, 'skills', 'foo', 'SKILL.md'), pristine + userAdded);
    writeFile(path.join(configDir, 'skills', 'foo', 'SKILL.md'), pristine + userAdded);

    const { status, report } = runVerifier();
    assert.equal(status, 0);
    assert.equal(report.failures, 0);
    assert.equal(report.checked, 1);
    assert.equal(report.results[0].status, 'ok');
    assert.deepEqual(report.results[0].missing, []);
  });

  test('reason=FAIL_USER_LINES_MISSING with the exact dropped line in .missing[]', () => {
    resetFixture();
    const pristine = 'first stock line in the original file here\nsecond stock line in the original file here\n';
    const lostLine = 'this is the visual companion block that must survive';
    writeFile(path.join(pristineDir, 'skills', 'discuss-phase', 'SKILL.md'), pristine);
    writeFile(path.join(patchesDir, 'skills', 'discuss-phase', 'SKILL.md'), `${pristine}${lostLine}\n`);
    writeFile(path.join(configDir, 'skills', 'discuss-phase', 'SKILL.md'), pristine);

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.equal(report.failures, 1);
    const r0 = report.results[0];
    assert.equal(r0.file, 'skills/discuss-phase/SKILL.md');
    assert.equal(r0.status, 'fail');
    assert.equal(r0.reason, REASON.FAIL_USER_LINES_MISSING);
    assert.ok(
      r0.missing.includes(lostLine),
      `dropped line should be in .missing[]; got ${JSON.stringify(r0.missing)}`,
    );
  });

  test('reason=FAIL_INSTALLED_NOT_REGULAR_FILE when installed path is a directory', () => {
    resetFixture();
    writeFile(path.join(pristineDir, 'a.md'), 'pristine line of substantial content here\n');
    writeFile(path.join(patchesDir, 'a.md'), 'pristine line of substantial content here\nuser added line that is substantial\n');
    fs.mkdirSync(path.join(configDir, 'a.md')); // EISDIR trap

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.equal(report.results[0].status, 'fail');
    assert.equal(report.results[0].reason, REASON.FAIL_INSTALLED_NOT_REGULAR_FILE);
  });

  test('reason=FAIL_INSTALLED_MISSING when the merged file has been deleted', () => {
    resetFixture();
    const pristine = 'stock line one with substantial content for the test\n';
    writeFile(path.join(pristineDir, 'workflow.md'), pristine);
    writeFile(path.join(patchesDir, 'workflow.md'), `${pristine}user line that should survive but does not\n`);
    // configDir intentionally missing the file.

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.equal(report.results[0].status, 'fail');
    assert.equal(report.results[0].reason, REASON.FAIL_INSTALLED_MISSING);
  });

  test('--json report has the documented shape: { checked, failures, results: [{ file, status, missing, reason }] }', () => {
    resetFixture();
    const pristine = 'pristine line that is sufficiently long to be significant\n';
    const userAdded = 'extra line the user wrote for their workflow customisation';
    writeFile(path.join(pristineDir, 'a.md'), pristine);
    writeFile(path.join(patchesDir, 'a.md'), `${pristine}${userAdded}\n`);
    writeFile(path.join(configDir, 'a.md'), pristine);

    const { status, report } = runVerifier();
    assert.equal(status, 1);
    assert.deepEqual(Object.keys(report).sort(), ['checked', 'failures', 'results']);
    const r0 = report.results[0];
    assert.deepEqual(Object.keys(r0).sort(), ['file', 'missing', 'reason', 'status']);
    assert.equal(typeof r0.file, 'string');
    assert.equal(typeof r0.status, 'string');
    assert.equal(typeof r0.reason, 'string');
    assert.ok(Array.isArray(r0.missing));
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
    writeFile(path.join(configDir, 'b.md'), `${presentLine}\n`);

    const { status, report } = runVerifier({ includePristine: false });
    assert.equal(status, 1);
    assert.equal(report.results[0].reason, REASON.FAIL_USER_LINES_MISSING);
    assert.ok(report.results[0].missing.includes(droppedLine));
    assert.ok(!report.results[0].missing.includes(presentLine));
  });
});
