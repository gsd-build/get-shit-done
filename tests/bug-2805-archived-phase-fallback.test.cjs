/**
 * Regression test for bug #2805
 *
 * `gsd-sdk query init.plan-phase <N>` returned the archived prior-milestone
 * directory when the current milestone had a phase with the same number but
 * no directory yet. getPhaseInfoWithFallback did not treat an archived hit as
 * "not yet created" when the current ROADMAP listed the phase.
 *
 * Root cause: findPhase searches archived milestones as a fallback. When the
 * archive matched (found:true, archived:"vX"), getPhaseInfoWithFallback
 * treated it as a valid disk match and never consulted the current ROADMAP.
 *
 * Fix: in getPhaseInfoWithFallback, when phaseInfo.archived is set AND
 * roadmapPhase.found is true, discard the archived hit and fall through to
 * the ROADMAP-based fallback (directory:null, current phase metadata).
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createTempGitProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');

function runSdkQuery(subcommand, args, projectDir) {
  const argv = ['query', subcommand, ...args, '--project-dir', projectDir];
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  try {
    stdout = execFileSync(process.execPath, [SDK_CLI, ...argv], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GSD_SESSION_KEY: '' },
    });
  } catch (err) {
    exitCode = err.status ?? 1;
    stdout = err.stdout?.toString() ?? '';
    stderr = err.stderr?.toString() ?? '';
  }
  let json = null;
  try { json = JSON.parse(stdout.trim()); } catch { /* ok */ }
  return { exitCode, json, stderr: stderr.trim() };
}

/**
 * Create a project with:
 * - An archived prior milestone vX with a phase 02
 * - A current milestone vX+1 with phase 02 in ROADMAP.md but NO directory yet
 */
function setupArchivedAndCurrent(tmpDir) {
  const planningDir = path.join(tmpDir, '.planning');

  // Archived prior milestone phase 02
  const archivePhaseDir = path.join(
    planningDir, 'milestones', 'v1.0-phases', '02-auth'
  );
  fs.mkdirSync(archivePhaseDir, { recursive: true });
  fs.writeFileSync(path.join(archivePhaseDir, '01-PLAN.md'), '# Plan\n');

  // Current milestone ROADMAP.md with phase 02 (no directory yet)
  const roadmap = [
    '# My Project Roadmap',
    '',
    '## v2.0 — Phase 2',
    '',
    '### Phase 2: New Auth Refactor',
    '',
    '**Requirements:** REQ-010, REQ-011',
    '',
    '| # | Phase | Plans | Status | Date |',
    '|---|-------|-------|--------|------|',
    '| 2 | New Auth Refactor | 0/3 | Planned | |',
    '',
  ].join('\n');
  fs.mkdirSync(path.join(planningDir, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmap);

  // STATE.md pointing at v2.0
  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    [
      '---',
      'version: "v2.0"',
      '---',
      '# State',
    ].join('\n')
  );
}

describe('bug-2805: init.plan-phase prefers current ROADMAP over archived dir', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-test-2805-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phase_dir is null (not archived dir) when current milestone has the phase', () => {
    setupArchivedAndCurrent(tmpDir);

    const result = runSdkQuery('init.plan-phase', ['2'], tmpDir);

    assert.strictEqual(result.exitCode, 0, `should exit 0; stderr: ${result.stderr}`);
    assert.ok(result.json !== null, 'should emit JSON');

    // Before fix: phase_dir was ".planning/milestones/v1.0-phases/02-auth"
    // After fix: phase_dir must be null (no directory yet for current milestone)
    assert.strictEqual(
      result.json.phase_dir,
      null,
      `phase_dir should be null (current milestone has no dir yet), got: ${result.json.phase_dir}`
    );
  });

  test('phase_found is true (phase exists in ROADMAP) even without a disk directory', () => {
    setupArchivedAndCurrent(tmpDir);

    const result = runSdkQuery('init.plan-phase', ['2'], tmpDir);

    assert.ok(result.json?.phase_found === true, 'phase_found should be true (ROADMAP has it)');
  });

  test('phase_name comes from current ROADMAP, not archived dir name', () => {
    setupArchivedAndCurrent(tmpDir);

    const result = runSdkQuery('init.plan-phase', ['2'], tmpDir);

    // Archived dir is named "02-auth"; current ROADMAP says "New Auth Refactor"
    // Assert the exact value from the ROADMAP fixture to fully protect the regression.
    assert.strictEqual(
      result.json?.phase_name,
      'New Auth Refactor',
      `phase_name should come from ROADMAP ("New Auth Refactor"), not the archived dir slug "02-auth", got: "${result.json?.phase_name}"`
    );
  });
});
