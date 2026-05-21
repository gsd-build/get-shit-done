// allow-test-rule: source-text-is-the-product — Finding 2 reads reapply-patches.md to
// assert structural presence of the Step 5a drift-check block; the .md file is the
// product (workflow instructions consumed by AI agents), not a source .cjs file.
'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #3657: verify-reapply-patches false-fails when gsd-pristine/ snapshot is
 * newer than backup-meta baseline.
 *
 * Root cause: the verifier computes user-added lines as
 *   diff(backup, pristine_on_disk)
 * but pristine_on_disk is from a LATER GSD version than the one captured in
 * backup-meta.json.pristine_hashes.  Lines present in the backup but removed by
 * the upstream update appear as "user-added lines that must survive", causing
 * FAIL_USER_LINES_MISSING false positives even when the user's real
 * customisation survived the merge.
 *
 * Fix: when backup-meta.json contains `pristine_hashes` and the on-disk
 * pristine file's SHA-256 does NOT match the recorded hash, the verifier must
 * skip the stale pristine and fall back to the over-broad mode (treating every
 * significant backup line as required) rather than computing a diff against the
 * wrong baseline.  Over-broad mode still passes if all backup lines are present
 * in the installed file — it never false-fails for a DIFFERENT reason.
 *
 * Per CONTRIBUTING.md testing standard: assert on typed structured fields from
 * the --json report and the REASON frozen enum. Zero regex / String#includes on
 * formatter prose.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'get-shit-done', 'bin', 'verify-reapply-patches.cjs');
const { REASON } = require(SCRIPT);

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpRoot;
let patchesDir;
let configDir;
let pristineDir;

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function writeBackupMeta(overrides = {}) {
  const meta = { pristine_hashes: {}, ...overrides };
  writeFile(path.join(patchesDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));
}

function resetFixture() {
  for (const dir of [patchesDir, configDir, pristineDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(patchesDir);
  fs.mkdirSync(configDir);
  fs.mkdirSync(pristineDir);
}

/** Runs the verifier with --json. Returns { status, report }. */
function runVerifier({ pristine = true } = {}) {
  const args = [
    SCRIPT,
    '--patches-dir', patchesDir,
    '--config-dir',  configDir,
    ...(pristine ? ['--pristine-dir', pristineDir] : []),
    '--json',
  ];
  const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8' });
  return {
    status: r.status,
    report: r.stdout && r.stdout.length ? JSON.parse(r.stdout) : null,
  };
}

before(() => {
  tmpRoot    = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3657-'));
  patchesDir = path.join(tmpRoot, 'patches');
  configDir  = path.join(tmpRoot, 'installed');
  pristineDir = path.join(tmpRoot, 'pristine');
  resetFixture();
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Bug #3657: pristine-drift does not produce false FAIL_USER_LINES_MISSING', () => {

  /**
   * Core regression: the user has one real customisation line.  The pristine
   * snapshot on disk is a NEWER version that removed a line that was in the
   * backup (v_old pristine).  Without the fix, the removed-upstream line
   * appears as a "user-added line" that is missing from the installed file,
   * causing a spurious failure.  With the fix, the verifier detects hash
   * mismatch and skips the stale pristine, so only the real user line is
   * checked — which IS present — and the run exits 0.
   */
  test('exits 0 with reason=OK_PRISTINE_DRIFT_DETECTED when on-disk pristine hash does not match recorded hash', () => {
    resetFixture();

    const FILE = 'agents/gsd-executor.md';

    // v_old pristine: the file as it existed when the backup was made.
    const oldPristineContent =
      'line present in old pristine and also in backup\n' +
      'another stock line that was present in old pristine\n';

    // The user added one customisation line on top of v_old pristine.
    const backupContent =
      oldPristineContent +
      'model: sonnet in frontmatter — the user customisation to preserve\n';

    // The installer later refreshed gsd-pristine/ to v_new.
    // The upstream update removed the second stock line entirely.
    const newPristineContent =
      'line present in old pristine and also in backup\n' +
      'brand-new upstream line added in the newer version here\n';

    // After reapply-patches, the installed file has the new upstream content
    // PLUS the user's real customisation.
    const installedContent =
      newPristineContent +
      'model: sonnet in frontmatter — the user customisation to preserve\n';

    // backup-meta.json records the SHA-256 of the OLD pristine content.
    writeBackupMeta({ pristine_hashes: { [FILE]: sha256(oldPristineContent) } });
    writeFile(path.join(patchesDir, FILE), backupContent);
    writeFile(path.join(configDir, FILE), installedContent);
    // The pristine dir has the NEW (mismatched) version.
    writeFile(path.join(pristineDir, FILE), newPristineContent);

    const { status, report } = runVerifier();

    // Must exit 0: drift detected, file skipped with diagnostic code rather
    // than false-failing. The user's real line cannot be verified without the
    // correct baseline, but the gate must not halt on a false alarm.
    assert.equal(status, 0, `expected exit 0 (no failures); got ${status}; report=${JSON.stringify(report)}`);
    assert.equal(report.failures, 0, `expected 0 failures; got ${report.failures}`);
    const r0 = report.results[0];
    assert.equal(r0.status, 'ok');
    assert.equal(r0.reason, REASON.OK_PRISTINE_DRIFT_DETECTED,
      `expected OK_PRISTINE_DRIFT_DETECTED; got ${r0.reason}`);
    assert.deepEqual(r0.missing, []);
  });

  /**
   * Counter-test (anti-false-positive): when pristine on-disk MATCHES the
   * recorded hash (no drift), a real user-added line that was dropped from
   * the installed file must still be caught as FAIL_USER_LINES_MISSING.
   * The hash-mismatch guard must not suppress legitimate failures.
   */
  test('still catches FAIL_USER_LINES_MISSING when pristine matches recorded hash', () => {
    resetFixture();

    const FILE = 'agents/gsd-executor.md';

    const pristineContent =
      'stock line one that is long enough to be significant\n' +
      'stock line two that is also long enough to matter\n';

    const droppedLine = 'model: sonnet in frontmatter — the user customisation that was lost';
    const backupContent = pristineContent + droppedLine + '\n';

    // Installed file is missing the user's line — a real failure.
    const installedContent = pristineContent;

    // backup-meta records hash of the SAME pristine currently on disk (no drift).
    writeBackupMeta({ pristine_hashes: { [FILE]: sha256(pristineContent) } });
    writeFile(path.join(patchesDir, FILE), backupContent);
    writeFile(path.join(configDir, FILE), installedContent);
    writeFile(path.join(pristineDir, FILE), pristineContent);

    const { status, report } = runVerifier();

    assert.equal(status, 1, 'expected exit 1 (real failure should be caught)');
    assert.equal(report.failures, 1);
    const r0 = report.results[0];
    assert.equal(r0.status, 'fail');
    assert.equal(r0.reason, REASON.FAIL_USER_LINES_MISSING);
    assert.ok(
      r0.missing.includes(droppedLine),
      `dropped user line must appear in .missing[]; got ${JSON.stringify(r0.missing)}`,
    );
  });

  /**
   * Counter-test (pristine present but no backup-meta.json): behaviour must
   * be unchanged from the pre-fix code — use whatever pristine is on disk
   * without hash validation (backup-meta is absent so no recorded hash).
   */
  test('uses on-disk pristine normally when backup-meta.json is absent (no hash to check)', () => {
    resetFixture();
    // No backup-meta.json written — simulate older installer that never recorded hashes.

    const FILE = 'workflow.md';
    const pristineContent = 'stock line that is long enough to be significant in the file\n';
    const droppedLine = 'user line that was added but dropped from the merged install';
    const backupContent = pristineContent + droppedLine + '\n';
    const installedContent = pristineContent; // user line was dropped

    writeFile(path.join(patchesDir, FILE), backupContent);
    writeFile(path.join(configDir, FILE), installedContent);
    writeFile(path.join(pristineDir, FILE), pristineContent);

    const { status, report } = runVerifier();

    // Should still catch the dropped user line via normal pristine diff.
    assert.equal(status, 1);
    assert.equal(report.failures, 1);
    assert.equal(report.results[0].reason, REASON.FAIL_USER_LINES_MISSING);
    assert.ok(report.results[0].missing.includes(droppedLine));
  });

  /**
   * Counter-test (pristine matches AND user line present): clean run must
   * report 0 failures — no false positives even with hash-validation active.
   */
  test('reports 0 failures when pristine matches recorded hash and user line is present', () => {
    resetFixture();

    const FILE = 'skills/custom/SKILL.md';
    const pristineContent = 'stock line one with sufficient length to be significant\n';
    const userLine = 'user custom instruction that the user intentionally added here';
    const backupContent = pristineContent + userLine + '\n';
    const installedContent = backupContent; // user line survived

    writeBackupMeta({ pristine_hashes: { [FILE]: sha256(pristineContent) } });
    writeFile(path.join(patchesDir, FILE), backupContent);
    writeFile(path.join(configDir, FILE), installedContent);
    writeFile(path.join(pristineDir, FILE), pristineContent);

    const { status, report } = runVerifier();

    assert.equal(status, 0);
    assert.equal(report.failures, 0);
    assert.equal(report.results[0].status, 'ok');
  });

  /**
   * Multi-file regression: two files; one with hash drift (should not false-fail),
   * one with no drift but a real dropped line (should catch it).
   * Verifies that per-file hash checking is independent.
   */
  test('handles mixed drift + real-failure across multiple files independently', () => {
    resetFixture();

    const DRIFT_FILE  = 'agents/gsd-executor.md';
    const CLEAN_FILE  = 'workflows/update.md';

    const driftOldPristine  = 'old upstream line that was removed in newer pristine version\n';
    const driftNewPristine  = 'brand-new upstream replacement line in the refreshed snapshot\n';
    const driftUserLine     = 'model: sonnet — the user customisation that survived reapply';
    const driftBackup       = driftOldPristine + driftUserLine + '\n';
    const driftInstalled    = driftNewPristine + driftUserLine + '\n';

    const cleanPristine     = 'stock workflow line long enough to pass significance threshold\n';
    const cleanDroppedLine  = 'user workflow customisation that was lost in the merge operation';
    const cleanBackup       = cleanPristine + cleanDroppedLine + '\n';
    const cleanInstalled    = cleanPristine; // dropped

    writeBackupMeta({
      pristine_hashes: {
        [DRIFT_FILE]: sha256(driftOldPristine),
        [CLEAN_FILE]: sha256(cleanPristine),
      },
    });

    writeFile(path.join(patchesDir, DRIFT_FILE), driftBackup);
    writeFile(path.join(configDir,  DRIFT_FILE), driftInstalled);
    writeFile(path.join(pristineDir, DRIFT_FILE), driftNewPristine); // hash mismatch

    writeFile(path.join(patchesDir, CLEAN_FILE), cleanBackup);
    writeFile(path.join(configDir,  CLEAN_FILE), cleanInstalled);
    writeFile(path.join(pristineDir, CLEAN_FILE), cleanPristine); // hash matches

    const { status, report } = runVerifier();

    // Exactly 1 failure (the clean file with the genuinely dropped line).
    assert.equal(report.failures, 1, `expected 1 failure; got ${report.failures}; report=${JSON.stringify(report, null, 2)}`);
    assert.equal(status, 1);

    const driftResult = report.results.find(
      (r) => r.file.replace(/\\/g, '/') === DRIFT_FILE,
    );
    const cleanResult = report.results.find(
      (r) => r.file.replace(/\\/g, '/') === CLEAN_FILE,
    );

    assert.ok(driftResult, 'drift file result must be present in report');
    assert.ok(cleanResult, 'clean file result must be present in report');

    assert.equal(driftResult.status, 'ok', 'drift file must not false-fail');
    assert.equal(driftResult.reason, REASON.OK_PRISTINE_DRIFT_DETECTED,
      `drift file must report OK_PRISTINE_DRIFT_DETECTED; got ${driftResult.reason}`);
    assert.equal(cleanResult.status, 'fail', 'clean file with dropped line must fail');
    assert.equal(cleanResult.reason, REASON.FAIL_USER_LINES_MISSING);
    assert.ok(cleanResult.missing.includes(cleanDroppedLine));
  });

  /**
   * REASON enum shape-lock: the #3657 fix adds OK_PRISTINE_DRIFT_DETECTED.
   * This assertion locks the updated documented set of stable codes.
   * Any further additions require updating this assertion.
   */
  test('REASON enum includes OK_PRISTINE_DRIFT_DETECTED added by the #3657 fix', () => {
    assert.deepEqual(
      Object.keys(REASON).sort(),
      [
        'FAIL_INSTALLED_MISSING',
        'FAIL_INSTALLED_NOT_REGULAR_FILE',
        'FAIL_READ_ERROR',
        'FAIL_USER_LINES_MISSING',
        'OK_NO_SIGNIFICANT_BACKUP_LINES',
        'OK_NO_USER_LINES_VS_PRISTINE',
        'OK_PRISTINE_DRIFT_DETECTED',
      ],
    );
  });

  // ---------------------------------------------------------------------------
  // Finding 1 (BLOCKER) — drifted_files report shape
  // Asserts that the JSON report top-level carries `drifted` count +
  // `drifted_files` array so that workflow Step 5a has structured data to gate
  // on.  Per-file shape is unchanged (backward compat).
  // ---------------------------------------------------------------------------

  /**
   * Single drifted file: the top-level `drifted` count must be 1 and
   * `drifted_files` must contain the relative path of the drifted file.
   * The `failures` count must remain 0 (drift ≠ failure).
   */
  test('Finding 1: JSON report includes top-level drifted count and drifted_files when drift is detected', () => {
    resetFixture();

    const FILE = 'agents/gsd-executor.md';
    const oldPristineContent = 'old pristine line that was present when backup was captured\n';
    const newPristineContent = 'new upstream line in the refreshed pristine snapshot version\n';
    const userLine = 'user customisation line that should be preserved across updates';
    const backupContent = oldPristineContent + userLine + '\n';
    const installedContent = newPristineContent + userLine + '\n';

    writeBackupMeta({ pristine_hashes: { [FILE]: sha256(oldPristineContent) } });
    writeFile(path.join(patchesDir, FILE), backupContent);
    writeFile(path.join(configDir, FILE), installedContent);
    writeFile(path.join(pristineDir, FILE), newPristineContent); // hash mismatch → drift

    const { status, report } = runVerifier();

    // Script exits 0 — drift is not a failure.
    assert.equal(status, 0, `expected exit 0; got ${status}`);
    assert.equal(report.failures, 0, 'failures must be 0 — drift is not a failure');

    // Finding 1: top-level drifted fields must be present and accurate.
    assert.equal(typeof report.drifted, 'number', 'report.drifted must be a number');
    assert.equal(report.drifted, 1, `expected drifted=1; got ${report.drifted}`);
    assert.ok(Array.isArray(report.drifted_files), 'report.drifted_files must be an array');
    assert.equal(report.drifted_files.length, 1, `expected 1 drifted_files entry; got ${report.drifted_files.length}`);
    // Normalize path separator so test passes on Windows worktrees too.
    assert.equal(
      report.drifted_files[0].replace(/\\/g, '/'),
      FILE,
      `drifted_files[0] must equal the drifted file path; got ${report.drifted_files[0]}`,
    );

    // Per-file shape is unchanged for backward compat.
    const r0 = report.results.find((r) => r.file.replace(/\\/g, '/') === FILE);
    assert.ok(r0, 'per-file result must be present');
    assert.equal(r0.status, 'ok');
    assert.equal(r0.reason, REASON.OK_PRISTINE_DRIFT_DETECTED);
  });

  /**
   * Multi-file drift: two files drifted, one clean pass. Asserts that the
   * `drifted` count is 2 and `drifted_files` lists both relative paths.
   * Confirms `failures` stays at 0.
   */
  test('Finding 1: drifted count and drifted_files aggregate correctly across multiple drifted files', () => {
    resetFixture();

    const FILE_A = 'agents/gsd-executor.md';
    const FILE_B = 'workflows/update.md';
    const FILE_C = 'skills/custom/SKILL.md';

    const oldPristineA = 'old pristine content for file A that was captured at backup time\n';
    const newPristineA = 'refreshed upstream content for file A in the newer GSD snapshot\n';
    const oldPristineB = 'old pristine content for file B that was captured at backup time\n';
    const newPristineB = 'refreshed upstream content for file B in the newer GSD snapshot\n';
    const pristineC   = 'stable pristine for file C — this one did not drift between versions\n';
    const userLineC   = 'user customisation for file C that survived the merge successfully';

    writeBackupMeta({
      pristine_hashes: {
        [FILE_A]: sha256(oldPristineA),
        [FILE_B]: sha256(oldPristineB),
        [FILE_C]: sha256(pristineC),
      },
    });

    // FILE_A: drifted (hash mismatch)
    writeFile(path.join(patchesDir, FILE_A), oldPristineA + 'user line A\n');
    writeFile(path.join(configDir,  FILE_A), newPristineA + 'user line A\n');
    writeFile(path.join(pristineDir, FILE_A), newPristineA); // mismatch

    // FILE_B: drifted (hash mismatch)
    writeFile(path.join(patchesDir, FILE_B), oldPristineB + 'user line B\n');
    writeFile(path.join(configDir,  FILE_B), newPristineB + 'user line B\n');
    writeFile(path.join(pristineDir, FILE_B), newPristineB); // mismatch

    // FILE_C: clean (hash matches, user line present)
    writeFile(path.join(patchesDir, FILE_C), pristineC + userLineC + '\n');
    writeFile(path.join(configDir,  FILE_C), pristineC + userLineC + '\n');
    writeFile(path.join(pristineDir, FILE_C), pristineC); // matches

    const { status, report } = runVerifier();

    assert.equal(status, 0, `expected exit 0; got ${status}`);
    assert.equal(report.failures, 0, 'failures must be 0');
    assert.equal(report.drifted, 2, `expected drifted=2; got ${report.drifted}`);
    assert.ok(Array.isArray(report.drifted_files), 'drifted_files must be an array');
    assert.equal(report.drifted_files.length, 2);
    const normalised = report.drifted_files.map((f) => f.replace(/\\/g, '/'));
    assert.ok(normalised.includes(FILE_A), `drifted_files must include ${FILE_A}`);
    assert.ok(normalised.includes(FILE_B), `drifted_files must include ${FILE_B}`);
    assert.ok(!normalised.includes(FILE_C), `drifted_files must NOT include the clean file ${FILE_C}`);
  });

  /**
   * No-drift baseline: when no files have hash mismatch, the top-level
   * `drifted` field must be 0 and `drifted_files` must be an empty array.
   * Verifies the additive fields are always present (not omitted on clean runs).
   */
  test('Finding 1: drifted=0 and drifted_files=[] when no files have pristine drift', () => {
    resetFixture();

    const FILE = 'skills/custom/SKILL.md';
    const pristineContent = 'stable pristine content that did not change between versions\n';
    const userLine = 'user customisation that survived correctly into the merged file';
    const backupContent = pristineContent + userLine + '\n';
    const installedContent = backupContent; // user line survived

    writeBackupMeta({ pristine_hashes: { [FILE]: sha256(pristineContent) } });
    writeFile(path.join(patchesDir, FILE), backupContent);
    writeFile(path.join(configDir,  FILE), installedContent);
    writeFile(path.join(pristineDir, FILE), pristineContent);

    const { status, report } = runVerifier();

    assert.equal(status, 0);
    assert.equal(report.failures, 0);
    assert.equal(report.drifted, 0, `expected drifted=0 on clean run; got ${report.drifted}`);
    assert.ok(Array.isArray(report.drifted_files), 'drifted_files must always be an array');
    assert.equal(report.drifted_files.length, 0, 'drifted_files must be empty on clean run');
  });

  // ---------------------------------------------------------------------------
  // Finding 2 (WARNING) — workflow Step 5a drift-check structural test
  // Asserts that the workflow markdown source now contains the drift-check
  // section that gates on `DRIFTED_COUNT > 0`.  Treating the .md source as
  // the product per allow-test-rule:source-text-is-the-product.
  // ---------------------------------------------------------------------------

  /**
   * Structural assertion: the workflow source must now contain the drift-check
   * block that Step 5a uses to halt on drifted files.  This guarantees that the
   * workflow consumer gate exists and uses the structured `drifted` / `drifted_files`
   * fields that Finding 1 added to the JSON report.
   */
  test('Finding 2: workflow Step 5a source contains drift-check section for DRIFTED_COUNT gate', () => {
    const workflowPath = path.join(ROOT, 'get-shit-done', 'workflows', 'reapply-patches.md');
    const workflowSource = fs.readFileSync(workflowPath, 'utf8');

    // The drift-check block must be present in Step 5a.
    assert.ok(
      workflowSource.includes('Step 5a: drift check'),
      'workflow must contain "Step 5a: drift check" heading',
    );

    // Must gate on the drifted count field from the JSON report.
    assert.ok(
      workflowSource.includes('DRIFTED_COUNT'),
      'workflow must reference DRIFTED_COUNT so it gates on the structured drifted field',
    );

    // Must reference drifted_files so the halt message names each drifted path.
    assert.ok(
      workflowSource.includes('drifted_files'),
      'workflow must reference drifted_files to name each drifted path in the halt message',
    );

    // Must instruct the user to resolve drift before re-running.
    assert.ok(
      workflowSource.includes('DRIFT_DETECTED'),
      'workflow must set DRIFT_DETECTED flag when drift is found (signals halt to subsequent steps)',
    );

    // The drift check must appear BEFORE the VERIFY_STATUS non-zero check.
    // (Drift can be present even when exit code is 0.)
    const driftCheckPos    = workflowSource.indexOf('Step 5a: drift check');
    const verifyStatusPos  = workflowSource.indexOf('If `VERIFY_STATUS` is non-zero');
    assert.ok(
      driftCheckPos < verifyStatusPos,
      'drift-check block must appear before the VERIFY_STATUS non-zero check in Step 5a',
    );
  });
});
