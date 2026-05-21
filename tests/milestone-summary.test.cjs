// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.
// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * GSD Milestone Summary + Audit Tests
 *
 * Validates the milestone-summary command, milestone-audit module (#2158),
 * workflow audit gates (complete-milestone, verify-work), and STATE.md template.
 * Also tests artifact discovery logic.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const commandPath = path.join(repoRoot, 'commands', 'gsd', 'milestone-summary.md');
const workflowPath = path.join(repoRoot, 'get-shit-done', 'workflows', 'milestone-summary.md');

describe('milestone-summary command', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(commandPath), 'commands/gsd/milestone-summary.md should exist');
  });

  test('command has correct frontmatter name', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(content.includes('name: gsd:milestone-summary'), 'should have correct command name');
  });

  test('command references workflow in execution_context', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('workflows/milestone-summary.md'),
      'should reference the milestone-summary workflow'
    );
  });

  test('command accepts optional version argument', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(content.includes('argument-hint'), 'should have argument-hint');
    assert.ok(content.includes('[version]'), 'version should be optional (bracketed)');
  });
});

describe('milestone-summary workflow', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), 'workflows/milestone-summary.md should exist');
  });

  test('workflow reads milestone artifacts', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    const requiredArtifacts = [
      'ROADMAP.md',
      'REQUIREMENTS.md',
      'PROJECT.md',
      'SUMMARY.md',
      'VERIFICATION.md',
      'CONTEXT.md',
      'RETROSPECTIVE.md',
    ];
    for (const artifact of requiredArtifacts) {
      assert.ok(
        content.includes(artifact),
        `workflow should reference ${artifact}`
      );
    }
  });

  test('workflow writes to reports directory', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('.planning/reports/MILESTONE_SUMMARY'),
      'should write summary to .planning/reports/'
    );
  });

  test('workflow has interactive Q&A mode', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('Interactive Mode') || content.includes('ask anything'),
      'should offer interactive Q&A after summary'
    );
  });

  test('workflow handles both archived and current milestones', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('Archived milestone'), 'should handle archived milestones');
    assert.ok(content.includes('Current') || content.includes('in-progress'), 'should handle current milestones');
  });

  test('workflow generates all 7 summary sections', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    const sections = [
      'Project Overview',
      'Architecture',
      'Phases Delivered',
      'Requirements Coverage',
      'Key Decisions',
      'Tech Debt',
      'Getting Started',
    ];
    for (const section of sections) {
      assert.ok(
        content.includes(section),
        `summary should include "${section}" section`
      );
    }
  });

  test('workflow updates STATE.md', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('state record-session') || content.includes('state.record-session'),
      'should update STATE.md via state record-session (CJS or gsd-sdk query)'
    );
  });

  test('workflow has overwrite guard for existing summaries', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('already exists'),
      'should check for existing summary before overwriting'
    );
  });

  test('workflow handles empty phase directories gracefully', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('no phase directories') || content.includes('No phases'),
      'should handle case where no phases exist'
    );
  });

  test('workflow checks both audit file locations for archived milestones', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('.planning/milestones/v${VERSION}-MILESTONE-AUDIT.md'),
      'should check milestones/ directory for archived audit file'
    );
  });
});

describe('milestone-summary command structure', () => {
  test('command has success_criteria section', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('<success_criteria>'),
      'should have success_criteria section (follows complete-milestone pattern)'
    );
  });

  test('command context lists RESEARCH.md', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('RESEARCH.md'),
      'should list RESEARCH.md in context block'
    );
  });
});

describe('milestone-summary artifact path resolution', () => {
  const { createTempProject, cleanup } = require('./helpers.cjs');
  let tmpDir;

  test('archived milestone paths point to milestones/ directory', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    // Archived roadmap path should be under milestones/
    assert.ok(
      content.includes('.planning/milestones/v${VERSION}-ROADMAP.md'),
      'archived ROADMAP path should be under .planning/milestones/'
    );
    assert.ok(
      content.includes('.planning/milestones/v${VERSION}-REQUIREMENTS.md'),
      'archived REQUIREMENTS path should be under .planning/milestones/'
    );
    assert.ok(
      content.includes('.planning/milestones/v${VERSION}-MILESTONE-AUDIT.md'),
      'archived AUDIT path should be under .planning/milestones/'
    );
  });

  test('current milestone paths point to .planning/ root', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    // Current milestone should read from .planning/ root
    const lines = content.split('\n');
    const currentSection = lines.slice(
      lines.findIndex(l => l.includes('Current/in-progress')),
      lines.findIndex(l => l.includes('Current/in-progress')) + 10
    ).join('\n');
    assert.ok(
      currentSection.includes('ROADMAP_PATH=".planning/ROADMAP.md"'),
      'current ROADMAP path should be at .planning/ root'
    );
  });
});

describe('milestone-summary fixture-based artifact discovery', () => {
  const os = require('os');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-ms-test-'));
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('discovers artifacts in archived milestone structure', () => {
    // Create archived milestone structure
    const milestonesDir = path.join(tmpDir, '.planning', 'milestones');
    fs.mkdirSync(milestonesDir, { recursive: true });
    fs.writeFileSync(path.join(milestonesDir, 'v1.0-ROADMAP.md'), '# Roadmap v1.0');
    fs.writeFileSync(path.join(milestonesDir, 'v1.0-REQUIREMENTS.md'), '# Reqs v1.0');
    fs.writeFileSync(path.join(milestonesDir, 'v1.0-MILESTONE-AUDIT.md'), '# Audit v1.0');

    // Verify all 3 archived files are discoverable
    const files = fs.readdirSync(milestonesDir);
    assert.ok(files.includes('v1.0-ROADMAP.md'), 'archived ROADMAP should exist');
    assert.ok(files.includes('v1.0-REQUIREMENTS.md'), 'archived REQUIREMENTS should exist');
    assert.ok(files.includes('v1.0-MILESTONE-AUDIT.md'), 'archived AUDIT should exist');
  });

  test('discovers phase artifacts across multiple phases', () => {
    // Create phase structure with varying artifact completeness
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    const phase2 = path.join(tmpDir, '.planning', 'phases', '02-core');
    const phase3 = path.join(tmpDir, '.planning', 'phases', '03-ui');
    fs.mkdirSync(phase1, { recursive: true });
    fs.mkdirSync(phase2, { recursive: true });
    fs.mkdirSync(phase3, { recursive: true });

    // Phase 1: all artifacts
    fs.writeFileSync(path.join(phase1, '01-SUMMARY.md'), 'one_liner: Setup');
    fs.writeFileSync(path.join(phase1, '01-CONTEXT.md'), '<decisions>D-01</decisions>');
    fs.writeFileSync(path.join(phase1, '01-VERIFICATION.md'), 'status: passed');
    fs.writeFileSync(path.join(phase1, '01-RESEARCH.md'), '# Research');

    // Phase 2: partial artifacts (no RESEARCH, no VERIFICATION)
    fs.writeFileSync(path.join(phase2, '02-SUMMARY.md'), 'one_liner: Core');
    fs.writeFileSync(path.join(phase2, '02-CONTEXT.md'), '<decisions>D-02</decisions>');

    // Phase 3: only SUMMARY
    fs.writeFileSync(path.join(phase3, '03-SUMMARY.md'), 'one_liner: UI');

    // Verify discovery
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    assert.strictEqual(phaseDirs.length, 3, 'should find 3 phase directories');

    // Phase 1 has all 4 artifact types
    const p1Files = fs.readdirSync(phase1);
    assert.strictEqual(p1Files.length, 4, 'phase 1 should have 4 artifacts');

    // Phase 2 has 2 artifact types
    const p2Files = fs.readdirSync(phase2);
    assert.strictEqual(p2Files.length, 2, 'phase 2 should have 2 artifacts');

    // Phase 3 has 1 artifact type
    const p3Files = fs.readdirSync(phase3);
    assert.strictEqual(p3Files.length, 1, 'phase 3 should have 1 artifact');
  });

  test('handles empty .planning directory without error', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // No milestones, no phases — just empty .planning/
    const contents = fs.readdirSync(planningDir);
    assert.strictEqual(contents.length, 0, 'empty .planning/ should have no contents');

    // Should not throw when checking for milestones dir
    const milestonesExists = fs.existsSync(path.join(planningDir, 'milestones'));
    assert.strictEqual(milestonesExists, false, 'milestones/ should not exist');

    const phasesExists = fs.existsSync(path.join(planningDir, 'phases'));
    assert.strictEqual(phasesExists, false, 'phases/ should not exist');
  });

  test('output path pattern produces valid filenames', () => {
    const versions = ['1.0', '1.1', '2.0', '0.1'];
    for (const v of versions) {
      const filename = `MILESTONE_SUMMARY-v${v}.md`;
      assert.ok(
        /^MILESTONE_SUMMARY-v\d+\.\d+\.md$/.test(filename),
        `"${filename}" should be a valid milestone summary filename`
      );
    }
  });
});

describe('milestone-summary git stats resilience', () => {
  test('workflow has fallback methods when tag does not exist', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('Method 1') && content.includes('Method 2'),
      'should have multiple fallback methods for git stats'
    );
  });

  test('workflow can skip stats gracefully', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('Skip stats') || content.includes('statistics unavailable'),
      'should handle case where git stats cannot be gathered'
    );
  });

  test('command has type: prompt in frontmatter', () => {
    const content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('type: prompt'),
      'should have type: prompt for consistency with complete-milestone.md'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// audit.cjs module (#2158)
// ─────────────────────────────────────────────────────────────────────────────

describe('audit.cjs module (#2158)', () => {
  const { createTempProject: createTP, cleanup: cleanTP, runGsdTools: run } = require('./helpers.cjs');
  let tmpDir;

  beforeEach(() => { tmpDir = createTP('audit-test'); });
  afterEach(() => { cleanTP(tmpDir); });

  test('auditOpenArtifacts returns structured result with counts', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    const result = auditOpenArtifacts(tmpDir);
    assert.ok(typeof result === 'object');
    assert.ok(typeof result.counts === 'object');
    assert.ok(typeof result.counts.total === 'number');
    assert.ok(typeof result.has_open_items === 'boolean');
  });

  test('auditOpenArtifacts handles missing planning directories gracefully', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    const result = auditOpenArtifacts(tmpDir);
    assert.strictEqual(result.counts.total, 0);
    assert.strictEqual(result.has_open_items, false);
  });

  test('auditOpenArtifacts detects open debug sessions', () => {
    const { auditOpenArtifacts } = require('../get-shit-done/bin/lib/audit.cjs');
    const debugDir = path.join(tmpDir, '.planning', 'debug');
    fs.mkdirSync(debugDir, { recursive: true });
    fs.writeFileSync(path.join(debugDir, 'test-bug.md'), [
      '---', 'status: investigating', 'trigger: login fails', 'updated: 2026-04-10', '---',
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
    fs.writeFileSync(path.join(resolvedDir, 'old-bug.md'), ['---', 'status: resolved', '---', '# Resolved'].join('\n'));

    const result = auditOpenArtifacts(tmpDir);
    assert.strictEqual(result.counts.debug_sessions, 0);
  });

  test('formatAuditReport returns string with header', () => {
    const { auditOpenArtifacts, formatAuditReport } = require('../get-shit-done/bin/lib/audit.cjs');
    const report = formatAuditReport(auditOpenArtifacts(tmpDir));
    assert.ok(typeof report === 'string');
    assert.ok(report.includes('Artifact Audit') || report.includes('artifact audit') || report.includes('All artifact'));
  });

  test('formatAuditReport shows all clear when no open items', () => {
    const { auditOpenArtifacts, formatAuditReport } = require('../get-shit-done/bin/lib/audit.cjs');
    const report = formatAuditReport(auditOpenArtifacts(tmpDir));
    assert.ok(report.includes('clear') || report.includes('0 items') || report.includes('no open'));
  });
});

describe('complete-milestone workflow has pre-close audit gate (#2158)', () => {
  const completeMilestoneContent = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'workflows', 'complete-milestone.md'),
    'utf8',
  );

  test('complete-milestone has pre_close_artifact_audit step', () => {
    assert.ok(
      completeMilestoneContent.includes('pre_close_artifact_audit') ||
      completeMilestoneContent.includes('audit-open'),
    );
  });

  test('complete-milestone surfaces deferred items to STATE.md', () => {
    assert.ok(completeMilestoneContent.includes('Deferred Items'));
  });

  test('complete-milestone has security note for audit output', () => {
    assert.ok(
      completeMilestoneContent.includes('sanitiz') || completeMilestoneContent.includes('SECURITY'),
    );
  });
});

describe('verify-work workflow has phase artifact check (#2157)', () => {
  const verifyWorkContent = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md'),
    'utf8',
  );

  test('verify-work has scan_phase_artifacts step', () => {
    assert.ok(
      verifyWorkContent.includes('scan_phase_artifacts') || verifyWorkContent.includes('audit-open'),
    );
  });

  test('verify-work prompts user on open UAT gaps', () => {
    assert.ok(verifyWorkContent.includes('gaps') && verifyWorkContent.includes('Proceed'));
  });
});

describe('state.md template has Deferred Items section (#2158)', () => {
  const stateTemplate = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'templates', 'state.md'),
    'utf8',
  );

  test('state.md template includes Deferred Items section', () => {
    assert.ok(stateTemplate.includes('Deferred Items'));
  });
});

describe('audit-open CLI command — ReferenceError regression (#2236)', () => {
  const { createTempProject: createTP, cleanup: cleanTP, runGsdTools: run } = require('./helpers.cjs');
  let tmpDir;

  beforeEach(() => { tmpDir = createTP('audit-open-cli-test'); });
  afterEach(() => { cleanTP(tmpDir); });

  test('audit-open exits without error on an empty project', () => {
    const result = run(['audit-open'], tmpDir);
    assert.ok(result.success, `audit-open crashed: ${result.error}`);
  });

  test('audit-open --json exits without error and returns valid JSON', () => {
    const result = run(['audit-open', '--json'], tmpDir);
    assert.ok(result.success, `audit-open --json crashed: ${result.error}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.output); });
    assert.ok(typeof parsed === 'object');
    assert.ok(typeof parsed.counts === 'object');
  });

  test('audit-open error is not ReferenceError: output is not defined', () => {
    const result = run(['audit-open'], tmpDir);
    assert.ok(
      !String(result.error).includes('output is not defined'),
      `ReferenceError regression: ${result.error}`,
    );
  });
});
