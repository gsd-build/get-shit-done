'use strict';
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

describe('audit.cjs module (#2158)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('audit-test');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('auditOpenArtifacts returns structured result with counts', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    const result = auditOpenArtifacts(tmpDir);
    assert.ok(typeof result === 'object', 'result must be object');
    assert.ok(typeof result.counts === 'object', 'result must have counts');
    assert.ok(typeof result.counts.total === 'number', 'counts.total must be number');
    assert.ok(typeof result.has_open_items === 'boolean', 'has_open_items must be boolean');
  });

  test('auditOpenArtifacts handles missing planning directories gracefully', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    // tmpDir has .planning/ but no debug/ or threads/ subdirs
    const result = auditOpenArtifacts(tmpDir);
    assert.strictEqual(result.counts.total, 0, 'empty project should have 0 open items');
    assert.strictEqual(result.has_open_items, false);
  });

  test('auditOpenArtifacts detects open debug sessions', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    // Create a fake debug session
    const debugDir = path.join(tmpDir, '.planning', 'debug');
    fs.mkdirSync(debugDir, { recursive: true });
    fs.writeFileSync(path.join(debugDir, 'test-bug.md'), [
      '---',
      'status: investigating',
      'trigger: login fails',
      'updated: 2026-04-10',
      '---',
      '# Debug: test-bug',
    ].join('\n'));

    const result = auditOpenArtifacts(tmpDir);
    assert.strictEqual(result.counts.debug_sessions, 1);
    assert.ok(result.has_open_items);
  });

  test('auditOpenArtifacts ignores resolved debug sessions', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    const resolvedDir = path.join(tmpDir, '.planning', 'debug', 'resolved');
    fs.mkdirSync(resolvedDir, { recursive: true });
    fs.writeFileSync(path.join(resolvedDir, 'old-bug.md'), [
      '---',
      'status: resolved',
      '---',
      '# Resolved',
    ].join('\n'));

    const result = auditOpenArtifacts(tmpDir);
    assert.strictEqual(result.counts.debug_sessions, 0);
  });

  test('formatAuditReport returns string with header', () => {
    const { auditOpenArtifacts, formatAuditReport } = require('../get-shit-done/bin/lib/audit.cjs');
    const result = auditOpenArtifacts(tmpDir);
    const report = formatAuditReport(result);
    assert.ok(typeof report === 'string');
    assert.ok(report.includes('Artifact Audit') || report.includes('artifact audit') || report.includes('All artifact'));
  });

  test('formatAuditReport shows all clear when no open items', () => {
    const { auditOpenArtifacts, formatAuditReport } = require('../get-shit-done/bin/lib/audit.cjs');
    const result = auditOpenArtifacts(tmpDir);
    const report = formatAuditReport(result);
    assert.ok(report.includes('clear') || report.includes('0 items') || report.includes('no open'),
      'clean report should indicate all clear');
  });
});

describe('complete-milestone workflow has pre-close audit gate (#2158)', () => {
  const completeMilestoneContent = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'workflows', 'complete-milestone.md'),
    'utf8'
  );

  test('complete-milestone has pre_close_artifact_audit step', () => {
    assert.ok(
      completeMilestoneContent.includes('pre_close_artifact_audit') ||
      completeMilestoneContent.includes('audit-open'),
      'missing pre-close audit gate'
    );
  });

  test('complete-milestone surfaces deferred items to STATE.md', () => {
    assert.ok(completeMilestoneContent.includes('Deferred Items'),
      'missing Deferred Items carry-forward logic');
  });

  test('complete-milestone has security note for audit output', () => {
    assert.ok(
      completeMilestoneContent.includes('sanitiz') || completeMilestoneContent.includes('SECURITY'),
      'missing security note in milestone audit gate'
    );
  });
});

describe('verify-work workflow has phase artifact check (#2157)', () => {
  const verifyWorkContent = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md'),
    'utf8'
  );

  test('verify-work has scan_phase_artifacts step', () => {
    assert.ok(
      verifyWorkContent.includes('scan_phase_artifacts') || verifyWorkContent.includes('audit-open'),
      'missing phase artifact scan step'
    );
  });

  test('verify-work prompts user on open UAT gaps', () => {
    assert.ok(
      verifyWorkContent.includes('gaps') && verifyWorkContent.includes('Proceed'),
      'missing user prompt for open gaps'
    );
  });
});

describe('state.md template has Deferred Items section (#2158)', () => {
  const stateTemplate = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'templates', 'state.md'),
    'utf8'
  );

  test('state.md template includes Deferred Items section', () => {
    assert.ok(stateTemplate.includes('Deferred Items'),
      'state.md template missing Deferred Items section');
  });
});

describe('audit-open CLI command — ReferenceError regression (#2236)', () => {
  // The audit-open case in gsd-tools.cjs called bare output() instead of
  // core.output(), crashing with ReferenceError: output is not defined
  // on every invocation. These tests exercise the CLI dispatch directly so
  // a regression at the call site is caught even if the lib tests all pass.
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('audit-open-cli-test');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('audit-open exits without error on an empty project', () => {
    const result = runGsdTools(['audit-open'], tmpDir);
    assert.ok(result.success, `audit-open crashed: ${result.error}`);
  });

  test('audit-open --json exits without error and returns valid JSON', () => {
    const result = runGsdTools(['audit-open', '--json'], tmpDir);
    assert.ok(result.success, `audit-open --json crashed: ${result.error}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.output); }, 'output must be valid JSON');
    assert.ok(typeof parsed === 'object', 'parsed output must be an object');
    assert.ok(typeof parsed.counts === 'object', 'JSON output must include counts');
  });

  test('audit-open error is not ReferenceError: output is not defined', () => {
    // Even if the command fails for some other reason, it must not throw the
    // specific ReferenceError that was the bug in #2236.
    const result = runGsdTools(['audit-open'], tmpDir);
    assert.ok(
      !String(result.error).includes('output is not defined'),
      `ReferenceError regression: ${result.error}`
    );
  });
});
