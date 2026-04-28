/**
 * Regression test for bug #2796
 *
 * roadmap.update-plan-progress used positional-only arg destructuring:
 * `const phaseNum = args[0]`. When called with the flag form documented in
 * execute-phase.md:228 (`--phase "TEST" --plan "01" --status "complete"`),
 * args[0] was the literal string "--phase", which was passed to findPhase().
 * findPhase found no phase named "--phase" and returned `updated: false` with
 * `reason: "no matching checkbox found"`, silently no-oping. ROADMAP.md plan
 * checkboxes never advanced.
 *
 * The stateBeginPhase handler already uses parseNamedArgs and is NOT affected.
 *
 * Fix: roadmap-update-plan-progress.ts now checks for --phase <value> before
 * falling back to positional arg[0] (filtering out flag tokens).
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
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim(), json };
}

/** Create a minimal ROADMAP.md with a phase checkbox */
function createRoadmap(projectDir, phaseNum, planLabel) {
  const planningDir = path.join(projectDir, '.planning');
  fs.mkdirSync(path.join(planningDir, 'phases'), { recursive: true });

  const roadmap = [
    '# My Project Roadmap',
    '',
    '## v1.0 — MVP',
    '',
    `### Phase ${phaseNum}: Test Phase`,
    '',
    `**Plans:** 1/1 plans complete`,
    '',
    `| # | Phase | Plans | Status | Date |`,
    `|---|-------|-------|--------|------|`,
    `| ${phaseNum} | Test Phase | 0/1 | Planned | |`,
    '',
    `- [ ] ${planLabel}: Do the thing`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmap);

  // Create the phase directory so findPhase finds it
  const phaseDir = path.join(
    planningDir, 'phases',
    `${String(phaseNum).padStart(2, '0')}-test-phase`
  );
  fs.mkdirSync(phaseDir, { recursive: true });

  // Create a plan file and a summary so progress = 1/1
  fs.writeFileSync(path.join(phaseDir, `${planLabel}-PLAN.md`), '# Plan\n');
  fs.writeFileSync(path.join(phaseDir, `${planLabel}-SUMMARY.md`), '# Summary\n');

  return phaseDir;
}

describe('bug-2796: roadmap update-plan-progress accepts --phase flag', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-test-2796-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('flag form --phase <N> resolves the correct phase (not literal "--phase")', () => {
    createRoadmap(tmpDir, '9', '01');

    // Flag form: this is the form execute-phase.md:228 uses
    const result = runSdkQuery(
      'roadmap.update-plan-progress',
      ['--phase', '9'],
      tmpDir
    );

    // Before fix: exitCode=1 with "phase --phase not found" or updated:false
    // After fix: should succeed with phase="9" and updated:true
    assert.strictEqual(result.exitCode, 0, `should exit 0; stderr: ${result.stderr}`);
    assert.ok(result.json !== null, 'should emit JSON');
    assert.ok(result.json.updated === true, 'updated should be true');
    assert.strictEqual(String(result.json.phase), '9', 'phase should be "9", not "--phase"');
  });

  test('positional form still works (backward compat)', () => {
    createRoadmap(tmpDir, '9', '01');

    const result = runSdkQuery(
      'roadmap.update-plan-progress',
      ['9'],
      tmpDir
    );

    assert.strictEqual(result.exitCode, 0, `should exit 0; stderr: ${result.stderr}`);
    assert.ok(result.json?.updated === true, 'updated should be true');
    assert.strictEqual(String(result.json.phase), '9', 'phase should be "9"');
  });

  test('flag form does not pass "--phase" as the phase value to findPhase', () => {
    // Before fix: findPhase("--phase") returned found:false, causing updated:false
    // This test confirms the phase value is not the flag name itself.
    createRoadmap(tmpDir, '5', '01');

    const result = runSdkQuery(
      'roadmap.update-plan-progress',
      ['--phase', '5'],
      tmpDir
    );

    // If the phase was "--phase", we'd get an error like "Phase --phase not found"
    assert.ok(
      !result.stderr.includes('--phase not found'),
      'stderr must not say "--phase not found"'
    );
    assert.ok(
      !result.stderr.includes('"--phase"'),
      'stderr must not treat "--phase" as the phase value'
    );
  });
});
