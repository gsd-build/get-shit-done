/**
 * Regression tests for bug #2684:
 *   `gsd-sdk query milestone.complete <version>` always fails with
 *   GSDError: version required for phases archive.
 *
 * Root cause: milestoneComplete extracted version from args[0] but passed
 * [] instead of args (or [version]) to phasesArchive, so phasesArchive
 * never received the version string and threw immediately.
 *
 * Fix: pass args (or [version]) when delegating to phasesArchive.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const SDK_CLI = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');
const { execFileSync } = require('child_process');

function runSdkQuery(args, cwd) {
  try {
    const result = execFileSync(process.execPath, [SDK_CLI, 'query', ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result.trim());
    return { success: true, data: parsed };
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || '';
    const stdout = err.stdout?.toString().trim() || '';
    // If the output is JSON despite non-zero exit, parse it
    try {
      const parsed = JSON.parse(stdout);
      return { success: true, data: parsed };
    } catch {
      /* not JSON */
    }
    return { success: false, error: stderr || err.message };
  }
}

describe('bug #2684: milestone.complete forwards version to phases.archive', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('milestone.complete v1.0 does not throw version required error', () => {
    // Minimal project: ROADMAP.md so milestone filter can run, one phase dir
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runSdkQuery(['milestone.complete', 'v1.0'], tmpDir);

    assert.ok(
      result.success,
      `milestone.complete should succeed, got error: ${result.error}`
    );
    assert.ok(
      !result.error || !result.error.includes('version required'),
      `should not throw "version required" — got: ${result.error}`
    );
  });

  test('milestone.complete returns version in response data', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );

    const result = runSdkQuery(['milestone.complete', 'v2.5'], tmpDir);

    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.data.version, 'v2.5', 'version should be echoed in response');
  });

  test('milestone.complete with --archive-phases forwards version correctly', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');

    // With --archive-phases, the version must reach the archive logic
    // Without the fix this would throw "version required for phases archive"
    const result = runSdkQuery(['milestone.complete', 'v1.0', '--archive-phases'], tmpDir);

    assert.ok(result.success, `milestone.complete --archive-phases failed: ${result.error}`);
    assert.strictEqual(result.data.version, 'v1.0');
    // The archive flag should have moved the phase dir
    assert.ok(
      result.data.archived.phases === true,
      'phases should be archived when --archive-phases is passed'
    );
    const archiveDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases');
    assert.ok(fs.existsSync(archiveDir), 'archive directory should exist');
  });

  test('phases.archive v1.0 (direct call, workaround) also works', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runSdkQuery(['phases.archive', 'v1.0'], tmpDir);

    assert.ok(result.success, `phases.archive failed: ${result.error}`);
    assert.strictEqual(result.data.version, 'v1.0');
  });
});
