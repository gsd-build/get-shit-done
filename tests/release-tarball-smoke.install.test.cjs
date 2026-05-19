// allow-test-rule: integration-test-input
// The script under test (scripts/release-tarball-smoke.cjs) is the system
// under test. We exercise it via its exported pure function, not by reading
// source text. The tarball fixture is produced by npm pack in before().

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { cleanup, createTempDir, runNpm } = require('./helpers.cjs');
const { SMOKE, runSmoke } = require('../scripts/release-tarball-smoke.cjs');

const PKG_PATH = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));

describe('release-tarball-smoke', () => {
  // Shared fixture state: pack the tarball once, install it once, reuse for all tests.
  let packDir;
  let installPrefix;
  let tarballPath;
  // fixtureDir for lifecycle / init tests; created once in before(), cleaned in after().
  let fixtureDir;

  before(async () => {
    // Pack once into a temp dir.
    packDir = createTempDir('gsd-smoke-pack-');
    installPrefix = createTempDir('gsd-smoke-prefix-');
    fixtureDir = createTempDir('gsd-smoke-fixture-');

    const packOutput = runNpm(
      ['pack', '--pack-destination', packDir],
      { cwd: path.join(__dirname, '..') },
    );

    // npm pack prints the filename as the last line of stdout.
    const lines = packOutput.split(/\r?\n/).filter(Boolean);
    const tgzName = lines[lines.length - 1];
    tarballPath = path.join(packDir, tgzName);
    if (!fs.existsSync(tarballPath)) {
      const found = fs.readdirSync(packDir).find((f) => f.endsWith('.tgz'));
      if (!found) throw new Error(`npm pack produced no .tgz in ${packDir}; output: ${packOutput}`);
      tarballPath = path.join(packDir, found);
    }

    // Install once into installPrefix. All tests share this install.
    runNpm(['install', '-g', '--prefix', installPrefix, tarballPath]);
  });

  after(() => {
    cleanup(packDir);
    cleanup(installPrefix);
    cleanup(fixtureDir);
  });

  // ── Test A — happy path ────────────────────────────────────────────────────
  test('A: happy path — installed version matches package.json', () => {
    const result = runSmoke({
      tarballPath,
      installPrefix,
      expectedVersion: pkg.version,
      fixtureDir,
    });

    assert.equal(result.code, SMOKE.OK);
    assert.equal(result.details.version, pkg.version);
  });

  // ── Test B — version mismatch detected ────────────────────────────────────
  test('B: version mismatch detected — returns VERSION_MISMATCH', () => {
    const result = runSmoke({
      tarballPath,
      installPrefix,
      expectedVersion: '99.99.99',
      fixtureDir,
    });

    assert.equal(result.code, SMOKE.VERSION_MISMATCH);
  });

  // ── Test C — happy lifecycle ───────────────────────────────────────────────
  // Verifies that the installed package has all expected command .md files and
  // that each command resolves a workflow .md file that also exists.
  // Also verifies that `get-shit-done-cc --local --claude` (init) succeeds in
  // the fixtureDir and creates the expected .claude/ directories.
  test('C: happy lifecycle — command + workflow files resolve OK', () => {
    const result = runSmoke({
      tarballPath,
      installPrefix,
      expectedVersion: pkg.version,
      fixtureDir,
      lifecycleCommands: ['init', 'discuss-phase', 'plan-phase'],
    });

    assert.equal(result.code, SMOKE.OK);

    // Each non-init command must be in lifecycleResolved with both paths populated
    const resolved = result.details.lifecycleResolved;
    assert.ok(Array.isArray(resolved));

    for (const entry of resolved) {
      assert.ok(
        typeof entry.commandPath === 'string' && entry.commandPath.length > 0,
        `expected commandPath for ${entry.command}`,
      );
      assert.ok(
        fs.existsSync(entry.commandPath) && fs.statSync(entry.commandPath).isFile(),
        `commandPath must be an existing file: ${entry.commandPath}`,
      );
      assert.ok(
        typeof entry.workflowPath === 'string' && entry.workflowPath.length > 0,
        `expected workflowPath for ${entry.command}`,
      );
      assert.ok(
        fs.existsSync(entry.workflowPath) && fs.statSync(entry.workflowPath).isFile(),
        `workflowPath must be an existing file: ${entry.workflowPath}`,
      );
    }
  });

  // ── Test D — missing command detected ─────────────────────────────────────
  // Passes a nonexistent command name; expects the smoke to detect the missing
  // command .md file and return COMMAND_FILE_MISSING with the right details.
  test('D: missing command detected — returns COMMAND_FILE_MISSING', () => {
    const result = runSmoke({
      tarballPath,
      installPrefix,
      expectedVersion: pkg.version,
      fixtureDir,
      lifecycleCommands: ['init', 'nonexistent-phase-xyz'],
    });

    assert.equal(result.code, SMOKE.COMMAND_FILE_MISSING);
    assert.equal(result.details.command, 'nonexistent-phase-xyz');
    assert.ok(typeof result.details.path === 'string' && result.details.path.length > 0);
  });

  // ── Test E — SDK binary callable ──────────────────────────────────────────
  // Verifies that `gsd-sdk query state.json` exits 0 and returns parseable JSON.
  // This is the primary guard for SDK_BINARY_NOT_CALLABLE regressions.
  test('E: sdk binary callable — gsd-sdk query produces parseable JSON', () => {
    const result = runSmoke({
      tarballPath,
      installPrefix,
      expectedVersion: pkg.version,
      fixtureDir,
      lifecycleCommands: [], // skip lifecycle checks; isolate SDK check
    });

    // If the binary can't be called, code would be SDK_BINARY_NOT_CALLABLE
    assert.notEqual(result.code, SMOKE.SDK_BINARY_NOT_CALLABLE);
    assert.equal(result.details.sdkQueryParsed, true);
  });

  // ── Test F — workflow-body checks run (informational) ─────────────────────
  // Asserts that the workflow-body scanning machinery ran (structural assertion).
  // Does NOT assert colonLeakCount or missingFallbackCount are zero — they will
  // be non-zero against current main per #3668 and the /gsd: leak backlog.
  // When those issues are fixed, this test continues to pass unchanged.
  test('F: workflow-body checks run — scan counts are present integers', () => {
    const result = runSmoke({
      tarballPath,
      installPrefix,
      expectedVersion: pkg.version,
      fixtureDir,
      lifecycleCommands: [],
    });

    // Structural: the scan ran and populated the counters
    assert.ok(
      Number.isInteger(result.details.workflowsScanned) && result.details.workflowsScanned >= 1,
      `expected workflowsScanned >= 1, got ${result.details.workflowsScanned}`,
    );
    assert.ok(
      Number.isInteger(result.details.colonLeakCount),
      `expected colonLeakCount to be an integer, got ${result.details.colonLeakCount}`,
    );
    assert.ok(
      Number.isInteger(result.details.missingFallbackCount),
      `expected missingFallbackCount to be an integer, got ${result.details.missingFallbackCount}`,
    );
  });
});
