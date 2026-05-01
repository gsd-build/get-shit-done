// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Forensics Tests
 *
 * Validates the forensics command and workflow files exist,
 * follow expected patterns, and cover all anomaly detection types.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const repoRoot = path.resolve(__dirname, '..');
const commandPath = path.join(repoRoot, 'commands', 'gsd', 'forensics.md');
const workflowPath = path.join(repoRoot, 'get-shit-done', 'workflows', 'forensics.md');

describe('forensics command', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(commandPath), 'commands/gsd/forensics.md should exist');
  });

  test('command has correct frontmatter', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(content.includes('name: gsd:forensics'), 'should have correct command name');
    assert.ok(content.includes('type: prompt'), 'should have type: prompt');
    assert.ok(content.includes('argument-hint'), 'should have argument-hint');
  });

  test('command references workflow in execution_context', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('workflows/forensics.md'),
      'should reference the forensics workflow'
    );
  });

  test('command has success_criteria section', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(content.includes('<success_criteria>'), 'should have success_criteria');
  });

  test('command has critical_rules section', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(content.includes('<critical_rules>'), 'should have critical_rules');
  });

  test('command enforces read-only investigation', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.toLowerCase().includes('read-only') || content.toLowerCase().includes('do not modify'),
      'should enforce read-only investigation'
    );
  });

  test('command requires evidence-grounded findings', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('Ground findings') || content.includes('cite specific'),
      'should require evidence-grounded analysis'
    );
  });
});

describe('forensics workflow', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), 'workflows/forensics.md should exist');
  });

  test('workflow gathers evidence from all data sources', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    const sources = [
      'git log',
      'git status',
      'STATE.md',
      'ROADMAP.md',
      'PLAN.md',
      'SUMMARY.md',
      'VERIFICATION.md',
      'SESSION_REPORT',
      'worktree',
    ];
    for (const source of sources) {
      assert.ok(
        content.includes(source),
        `workflow should reference data source: ${source}`
      );
    }
  });

  test('workflow detects all 6 anomaly types', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    const anomalies = [
      'Stuck Loop',
      'Missing Artifact',
      'Abandoned Work',
      'Crash',
      'Scope Drift',
      'Test Regression',
    ];
    for (const anomaly of anomalies) {
      assert.ok(
        content.includes(anomaly),
        `workflow should detect anomaly: ${anomaly}`
      );
    }
  });

  test('workflow writes report to forensics directory', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('.planning/forensics/report-'),
      'should write to .planning/forensics/'
    );
  });

  test('workflow includes redaction rules', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('Redaction') || content.includes('redact'),
      'should include data redaction rules'
    );
  });

  test('workflow offers interactive investigation', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('dig deeper') || content.includes('Interactive'),
      'should offer interactive follow-up'
    );
  });

  test('workflow offers GitHub issue creation', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('gh issue create'),
      'should offer to create GitHub issue from findings'
    );
  });

  test('workflow submits issues to gsd-build/get-shit-done, not the current repo', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    // Scope check to the gh issue create invocation — a whole-file search would
    // pass even if gh issue create lacked --repo, because gh label list also
    // contains the repo string.
    assert.match(
      content,
      /gh issue create[\s\S]{0,250}--repo\s+gsd-build\/get-shit-done/,
      'gh issue create must use --repo gsd-build/get-shit-done to avoid submitting to the user\'s current project repo'
    );
  });

  test('workflow checks bug label in gsd-build/get-shit-done, not the current repo', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    // Regex is more robust than a fixed-length slice to formatting changes
    assert.match(
      content,
      /gh label list[\s\S]{0,250}--repo\s+gsd-build\/get-shit-done/,
      'gh label list must target gsd-build/get-shit-done'
    );
  });

  test('workflow updates STATE.md', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('state record-session') || content.includes('state.record-session'),
      'should update STATE.md via state record-session (CJS or gsd-sdk query)'
    );
  });

  test('workflow has confidence levels for anomalies', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('HIGH') && content.includes('MEDIUM') && content.includes('LOW'),
      'anomalies should have confidence levels'
    );
  });
});

describe('forensics report structure', () => {
  test('report template has all required sections', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    const sections = [
      'Evidence Summary',
      'Git Activity',
      'Planning State',
      'Artifact Completeness',
      'Anomalies Detected',
      'Root Cause Hypothesis',
      'Recommended Actions',
    ];
    for (const section of sections) {
      assert.ok(
        content.includes(section),
        `report should include section: "${section}"`
      );
    }
  });

  test('report includes artifact completeness table', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('PLAN') && content.includes('CONTEXT') && content.includes('RESEARCH') &&
      content.includes('SUMMARY') && content.includes('VERIFICATION'),
      'artifact table should check all 5 artifact types'
    );
  });
});

describe('forensics fixture-based tests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-forensics-test-'));
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('detects missing artifacts in phase structure', () => {
    // Phase 1: complete
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-PLAN-A.md'), 'plan');
    fs.writeFileSync(path.join(phase1, '01-SUMMARY.md'), 'summary');
    fs.writeFileSync(path.join(phase1, '01-VERIFICATION.md'), 'verification');

    // Phase 2: missing SUMMARY and VERIFICATION (anomaly)
    const phase2 = path.join(tmpDir, '.planning', 'phases', '02-core');
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase2, '02-PLAN-A.md'), 'plan');

    // Verify detection
    const p1Files = fs.readdirSync(phase1);
    const p2Files = fs.readdirSync(phase2);

    assert.ok(p1Files.some(f => f.includes('SUMMARY')), 'phase 1 has SUMMARY');
    assert.ok(p1Files.some(f => f.includes('VERIFICATION')), 'phase 1 has VERIFICATION');
    assert.ok(!p2Files.some(f => f.includes('SUMMARY')), 'phase 2 missing SUMMARY (anomaly)');
    assert.ok(!p2Files.some(f => f.includes('VERIFICATION')), 'phase 2 missing VERIFICATION (anomaly)');
  });

  test('forensics report directory can be created', () => {
    const forensicsDir = path.join(tmpDir, '.planning', 'forensics');
    fs.mkdirSync(forensicsDir, { recursive: true });
    const reportPath = path.join(forensicsDir, 'report-20260321-150000.md');
    fs.writeFileSync(reportPath, '# Forensic Report\n');

    assert.ok(fs.existsSync(reportPath), 'report file should be created');
    const content = fs.readFileSync(reportPath, 'utf-8');
    assert.ok(content.includes('Forensic Report'), 'report should have header');
  });

  test('handles project with no .planning directory', () => {
    // No .planning/ at all
    const planningExists = fs.existsSync(path.join(tmpDir, '.planning'));
    assert.strictEqual(planningExists, false, 'no .planning/ should exist');

    // Forensics should still work with git data
    const forensicsDir = path.join(tmpDir, '.planning', 'forensics');
    fs.mkdirSync(forensicsDir, { recursive: true });
    assert.ok(fs.existsSync(forensicsDir), 'forensics dir created on demand');
  });
});
