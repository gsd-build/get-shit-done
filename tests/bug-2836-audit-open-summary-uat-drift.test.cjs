/**
 * Regression tests for bug #2836
 *
 * audit-open had two convention drifts vs the documented workflows:
 *   1. quick-task scanner looked for bare `SUMMARY.md`, but workflows/quick.md
 *      mandates `${quick_id}-SUMMARY.md`. Result: every documented quick task
 *      reported as `status: missing`.
 *   2. UAT terminal-status enum only accepted `complete`, but
 *      workflows/execute-phase.md uses `resolved` post-gap-closure.
 *      Result: gap-closed UATs reported as open.
 *
 * Tests structurally invoke auditOpenArtifacts() against real fixtures on disk
 * and assert the returned items array — never regex on raw file content.
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const auditModule = require('../get-shit-done/bin/lib/audit.cjs');
const { auditOpenArtifacts } = auditModule;

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bug-2836-'));
}

function rmTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

describe('bug #2836: audit-open quick-task summary filename + UAT terminal status', () => {
  // Ensure GSD env vars do not redirect planningDir() away from our fixture.
  let prevProject, prevWorkstream;
  before(() => {
    prevProject = process.env.GSD_PROJECT;
    prevWorkstream = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_PROJECT;
    delete process.env.GSD_WORKSTREAM;
  });
  after(() => {
    if (prevProject !== undefined) process.env.GSD_PROJECT = prevProject;
    if (prevWorkstream !== undefined) process.env.GSD_WORKSTREAM = prevWorkstream;
  });

  test('quick task with ${quick_id}-SUMMARY.md is recognized as complete (not missing)', () => {
    const cwd = mkTmp();
    try {
      const quickId = '260429-test-foo';
      const taskDir = path.join(cwd, '.planning', 'quick', quickId);
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(
        path.join(taskDir, `${quickId}-SUMMARY.md`),
        '---\nstatus: complete\n---\ntest summary\n',
        'utf-8'
      );

      const result = auditOpenArtifacts(cwd);
      const realQuickTasks = result.items.quick_tasks.filter(
        i => !i.scan_error && !i._remainder_count
      );

      assert.equal(
        realQuickTasks.length, 0,
        `quick task with ${quickId}-SUMMARY.md (status: complete) must not appear ` +
        `as an open item; got: ${JSON.stringify(realQuickTasks)}`
      );
      assert.equal(result.counts.quick_tasks, 0);
    } finally {
      rmTmp(cwd);
    }
  });

  test('UAT with status: resolved is treated as terminal (not an open gap)', () => {
    const cwd = mkTmp();
    try {
      const phaseDir = path.join(cwd, '.planning', 'phases', '01-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(
        path.join(phaseDir, '01-UAT.md'),
        '---\nstatus: resolved\n---\nUAT body — gap closed via execute-phase flow.\n',
        'utf-8'
      );

      const result = auditOpenArtifacts(cwd);
      const realUatGaps = result.items.uat_gaps.filter(i => !i.scan_error);

      assert.equal(
        realUatGaps.length, 0,
        `UAT with status: resolved must not appear as an open gap; ` +
        `got: ${JSON.stringify(realUatGaps)}`
      );
      assert.equal(result.counts.uat_gaps, 0);
    } finally {
      rmTmp(cwd);
    }
  });

  test('UAT with status: complete remains terminal (no regression)', () => {
    const cwd = mkTmp();
    try {
      const phaseDir = path.join(cwd, '.planning', 'phases', '02-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(
        path.join(phaseDir, '02-UAT.md'),
        '---\nstatus: complete\n---\nUAT body.\n',
        'utf-8'
      );

      const result = auditOpenArtifacts(cwd);
      const realUatGaps = result.items.uat_gaps.filter(i => !i.scan_error);
      assert.equal(realUatGaps.length, 0);
    } finally {
      rmTmp(cwd);
    }
  });

  test('UAT with status: pending is still flagged as an open gap', () => {
    const cwd = mkTmp();
    try {
      const phaseDir = path.join(cwd, '.planning', 'phases', '03-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(
        path.join(phaseDir, '03-UAT.md'),
        '---\nstatus: pending\n---\nresult: pending\n',
        'utf-8'
      );

      const result = auditOpenArtifacts(cwd);
      const realUatGaps = result.items.uat_gaps.filter(i => !i.scan_error);
      assert.equal(realUatGaps.length, 1, 'pending UAT must still be flagged');
      assert.equal(realUatGaps[0].status, 'pending');
    } finally {
      rmTmp(cwd);
    }
  });

  test('quick task without any SUMMARY file is still flagged as missing', () => {
    const cwd = mkTmp();
    try {
      const quickId = '260429-test-bar';
      const taskDir = path.join(cwd, '.planning', 'quick', quickId);
      fs.mkdirSync(taskDir, { recursive: true });
      // No SUMMARY file at all.

      const result = auditOpenArtifacts(cwd);
      const realQuickTasks = result.items.quick_tasks.filter(
        i => !i.scan_error && !i._remainder_count
      );
      assert.equal(realQuickTasks.length, 1);
      assert.equal(realQuickTasks[0].status, 'missing');
    } finally {
      rmTmp(cwd);
    }
  });
});

describe('bug #2836: workflows/help.md one-liner reconciliation', () => {
  test('help.md quick-task one-liner uses ${quick_id}-SUMMARY.md pattern', () => {
    const helpPath = path.resolve(
      __dirname, '..', 'get-shit-done', 'workflows', 'help.md'
    );
    const content = fs.readFileSync(helpPath, 'utf-8');

    // Locate the documented "Result: Creates ..." quick-task one-liner and
    // assert it references the per-task SUMMARY filename pattern, not bare
    // SUMMARY.md. We parse by line to avoid false positives elsewhere.
    const resultLines = content.split('\n').filter(l =>
      l.includes('Result: Creates') && l.includes('.planning/quick/')
    );
    assert.ok(resultLines.length > 0, 'expected a quick-task Result line in help.md');
    for (const line of resultLines) {
      assert.ok(
        /\$\{quick_id\}-SUMMARY\.md|NNN-slug-SUMMARY\.md/.test(line),
        `help.md quick-task Result line must reference per-task SUMMARY filename ` +
        `(e.g. \${quick_id}-SUMMARY.md); got: ${line}`
      );
    }
  });
});
