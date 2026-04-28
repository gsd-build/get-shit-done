/**
 * Regression test for bug #2788
 *
 * `gsd-sdk query audit-uat` returned total_items: 0 for VERIFICATION.md
 * files where human-needed items were encoded in the frontmatter
 * `human_verification:` YAML array (the format written by gsd-verifier),
 * or where the body section heading used `## human_verification` (underscore)
 * instead of `## Human Verification` (space).
 *
 * Root cause:
 * 1. parseVerificationItems only searched the body for "## Human Verification"
 *    (space, case-insensitive) — never read frontmatter.
 * 2. The body-section regex did not accept underscore in the heading name.
 *
 * Fix: parseVerificationItems now reads the frontmatter human_verification:
 * array first (via extractFrontmatter). Falls back to body-section scan
 * with a relaxed regex that accepts underscore and parenthetical suffixes.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createTempProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');

function runAuditUat(projectDir) {
  const argv = ['query', 'audit-uat', '--project-dir', projectDir];
  let stdout = '';
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
  }
  let json = null;
  try { json = JSON.parse(stdout.trim()); } catch { /* ok */ }
  return { exitCode, json };
}

/** Set up a project with a ROADMAP.md milestone and a phase VERIFICATION.md */
function setupProject(tmpDir, verificationContent) {
  const planningDir = path.join(tmpDir, '.planning');
  const phaseDir = path.join(planningDir, 'phases', '03-invoicing');
  fs.mkdirSync(phaseDir, { recursive: true });

  // Write a minimal ROADMAP.md so getMilestonePhaseFilter works
  fs.writeFileSync(
    path.join(planningDir, 'ROADMAP.md'),
    [
      '# Roadmap',
      '',
      '## v1.0 — MVP',
      '',
      '### Phase 3: Invoicing',
    ].join('\n')
  );

  // Write STATE.md with current milestone
  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    [
      '---',
      'version: "v1.0"',
      '---',
      '# State',
    ].join('\n')
  );

  fs.writeFileSync(
    path.join(phaseDir, '03-invoicing-VERIFICATION.md'),
    verificationContent
  );
}

describe('bug-2788: audit-uat reads frontmatter human_verification array', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-test-2788-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('frontmatter human_verification: array items are reported', () => {
    // This is the format gsd-verifier writes; before fix total_items was 0
    const content = [
      '---',
      'phase: 03-invoicing',
      'status: human_needed',
      'human_verification:',
      '  - test: "Manual frontend smoke — /invoices, /invoices/new"',
      '    expected: "All four routes render correctly"',
      '    why_human: "Visual rendering cannot be verified by static code inspection"',
      '  - test: "Run integration test suite against a real Postgres"',
      '    expected: "105 currently-skipped tests pass green"',
      '    why_human: "Docker not installed locally"',
      '---',
      '',
      '# Phase 3 Verification Report',
      '',
      'No body Human Verification section here.',
    ].join('\n');

    setupProject(tmpDir, content);
    const result = runAuditUat(tmpDir);

    assert.strictEqual(result.exitCode, 0, 'should exit 0');
    assert.ok(result.json !== null, 'should emit JSON');
    assert.ok(
      result.json.summary.total_items >= 2,
      `total_items should be >= 2, got ${result.json.summary.total_items}`
    );
  });

  test('body ## human_verification (underscore) heading is parsed', () => {
    const content = [
      '---',
      'phase: 03-invoicing',
      'status: human_needed',
      '---',
      '',
      '# Phase 3 Verification Report',
      '',
      '## human_verification (action required by Sammy)',
      '',
      '- Manual frontend smoke — /invoices, /invoices/new: verify all four routes render',
      '- Run integration test suite against a real Postgres database',
    ].join('\n');

    setupProject(tmpDir, content);
    const result = runAuditUat(tmpDir);

    assert.strictEqual(result.exitCode, 0, 'should exit 0');
    assert.ok(result.json !== null, 'should emit JSON');
    assert.ok(
      result.json.summary.total_items >= 2,
      `total_items should be >= 2, got ${result.json.summary.total_items}`
    );
  });

  test('body ## Human Verification (space) heading still works', () => {
    const content = [
      '---',
      'phase: 03-invoicing',
      'status: human_needed',
      '---',
      '',
      '# Phase 3 Verification Report',
      '',
      '## Human Verification',
      '',
      '- Manual frontend smoke test — verify all four routes render correctly or describe what breaks',
      '- Run integration test suite: 105 tests must pass green',
    ].join('\n');

    setupProject(tmpDir, content);
    const result = runAuditUat(tmpDir);

    assert.strictEqual(result.exitCode, 0, 'should exit 0');
    assert.ok(result.json?.summary.total_items >= 2, `total_items should be >= 2`);
  });
});
