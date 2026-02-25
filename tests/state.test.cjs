/**
 * GSD Tools Tests - State
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('state-snapshot command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing STATE.md returns error', () => {
    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'STATE.md not found', 'should report missing file');
  });

  test('extracts basic fields from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Current Phase Name:** API Layer
**Total Phases:** 6
**Current Plan:** 03-02
**Total Plans in Phase:** 3
**Status:** In progress
**Progress:** 45%
**Last Activity:** 2024-01-15
**Last Activity Description:** Completed 03-01-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '03', 'current phase extracted');
    assert.strictEqual(output.current_phase_name, 'API Layer', 'phase name extracted');
    assert.strictEqual(output.total_phases, 6, 'total phases extracted');
    assert.strictEqual(output.current_plan, '03-02', 'current plan extracted');
    assert.strictEqual(output.total_plans_in_phase, 3, 'total plans extracted');
    assert.strictEqual(output.status, 'In progress', 'status extracted');
    assert.strictEqual(output.progress_percent, 45, 'progress extracted');
    assert.strictEqual(output.last_activity, '2024-01-15', 'last activity date extracted');
  });

  test('extracts decisions table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 01

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01 | Use Prisma | Better DX than raw SQL |
| 02 | JWT auth | Stateless authentication |
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 2, 'should have 2 decisions');
    assert.strictEqual(output.decisions[0].phase, '01', 'first decision phase');
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'first decision summary');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than raw SQL', 'first decision rationale');
  });

  test('extracts blockers list', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Blockers

- Waiting for API credentials
- Need design review for dashboard
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.blockers, [
      'Waiting for API credentials',
      'Need design review for dashboard',
    ], 'blockers extracted');
  });

  test('extracts session continuity info', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Session

**Last Date:** 2024-01-15
**Stopped At:** Phase 3, Plan 2, Task 1
**Resume File:** .planning/phases/03-api/03-02-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.session.last_date, '2024-01-15', 'session date extracted');
    assert.strictEqual(output.session.stopped_at, 'Phase 3, Plan 2, Task 1', 'stopped at extracted');
    assert.strictEqual(output.session.resume_file, '.planning/phases/03-api/03-02-PLAN.md', 'resume file extracted');
  });

  test('handles paused_at field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Paused At:** Phase 3, Plan 1, Task 2 - mid-implementation
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, 'Phase 3, Plan 1, Task 2 - mid-implementation', 'paused_at extracted');
  });

  test('supports --cwd override when command runs outside project root', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Session State

**Current Phase:** 03
**Status:** Ready to plan
`
    );
    const outsideDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-outside-'));

    try {
      const result = runGsdTools(`state-snapshot --cwd "${tmpDir}"`, outsideDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.current_phase, '03', 'should read STATE.md from overridden cwd');
      assert.strictEqual(output.status, 'Ready to plan', 'should parse status from overridden cwd');
    } finally {
      cleanup(outsideDir);
    }
  });

  test('returns error for invalid --cwd path', () => {
    const invalid = path.join(tmpDir, 'does-not-exist');
    const result = runGsdTools(`state-snapshot --cwd "${invalid}"`, tmpDir);
    assert.ok(!result.success, 'should fail for invalid --cwd');
    assert.ok(result.error.includes('Invalid --cwd'), 'error should mention invalid --cwd');
  });
});

describe('state mutation commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('add-decision preserves dollar amounts without corrupting Decisions section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
No decisions yet.

## Blockers
None
`
    );

    const result = runGsdTools(
      "state add-decision --phase 11-01 --summary 'Benchmark prices moved from $0.50 to $2.00 to $5.00' --rationale 'track cost growth'",
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(
      state,
      /- \[Phase 11-01\]: Benchmark prices moved from \$0\.50 to \$2\.00 to \$5\.00 — track cost growth/,
      'decision entry should preserve literal dollar values'
    );
    assert.strictEqual((state.match(/^## Decisions$/gm) || []).length, 1, 'Decisions heading should not be duplicated');
    assert.ok(!state.includes('No decisions yet.'), 'placeholder should be removed');
  });

  test('add-blocker preserves dollar strings without corrupting Blockers section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
None

## Blockers
None
`
    );

    const result = runGsdTools("state add-blocker --text 'Waiting on vendor quote $1.00 before approval'", tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(state, /- Waiting on vendor quote \$1\.00 before approval/, 'blocker entry should preserve literal dollar values');
    assert.strictEqual((state.match(/^## Blockers$/gm) || []).length, 1, 'Blockers heading should not be duplicated');
  });

  test('add-decision supports file inputs to preserve shell-sensitive dollar text', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
No decisions yet.

## Blockers
None
`
    );

    const summaryPath = path.join(tmpDir, 'decision-summary.txt');
    const rationalePath = path.join(tmpDir, 'decision-rationale.txt');
    fs.writeFileSync(summaryPath, 'Price tiers: $0.50, $2.00, else $5.00\n');
    fs.writeFileSync(rationalePath, 'Keep exact currency literals for budgeting\n');

    const result = runGsdTools(
      `state add-decision --phase 11-02 --summary-file "${summaryPath}" --rationale-file "${rationalePath}"`,
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(
      state,
      /- \[Phase 11-02\]: Price tiers: \$0\.50, \$2\.00, else \$5\.00 — Keep exact currency literals for budgeting/,
      'file-based decision input should preserve literal dollar values'
    );
  });

  test('add-blocker supports --text-file for shell-sensitive text', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
None

## Blockers
None
`
    );

    const blockerPath = path.join(tmpDir, 'blocker.txt');
    fs.writeFileSync(blockerPath, 'Vendor quote updated from $1.00 to $2.00 pending approval\n');

    const result = runGsdTools(`state add-blocker --text-file "${blockerPath}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(state, /- Vendor quote updated from \$1\.00 to \$2\.00 pending approval/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stateExtractField and stateReplaceField helpers
// ─────────────────────────────────────────────────────────────────────────────

const { stateExtractField, stateReplaceField } = require('../get-shit-done/bin/lib/state.cjs');

describe('stateExtractField and stateReplaceField helpers', () => {
  // stateExtractField tests

  test('extracts simple field value', () => {
    const content = '# State\n\n**Status:** In progress\n';
    const result = stateExtractField(content, 'Status');
    assert.strictEqual(result, 'In progress', 'should extract simple field value');
  });

  test('extracts field with colon in value', () => {
    const content = '# State\n\n**Last Activity:** 2024-01-15 — Completed plan\n';
    const result = stateExtractField(content, 'Last Activity');
    assert.strictEqual(result, '2024-01-15 — Completed plan', 'should return full value after field pattern');
  });

  test('returns null for missing field', () => {
    const content = '# State\n\n**Phase:** 03\n';
    const result = stateExtractField(content, 'Status');
    assert.strictEqual(result, null, 'should return null when field not present');
  });

  test('is case-insensitive on field name', () => {
    const content = '# State\n\n**status:** Active\n';
    const result = stateExtractField(content, 'Status');
    assert.strictEqual(result, 'Active', 'should match field name case-insensitively');
  });

  // stateReplaceField tests

  test('replaces field value', () => {
    const content = '# State\n\n**Status:** Old\n';
    const result = stateReplaceField(content, 'Status', 'New');
    assert.ok(result !== null, 'should return updated content, not null');
    assert.ok(result.includes('**Status:** New'), 'output should contain updated field value');
    assert.ok(!result.includes('**Status:** Old'), 'output should not contain old field value');
  });

  test('returns null when field not found', () => {
    const content = '# State\n\n**Phase:** 03\n';
    const result = stateReplaceField(content, 'Status', 'New');
    assert.strictEqual(result, null, 'should return null when field not present');
  });

  test('preserves surrounding content', () => {
    const content = [
      '# Project State',
      '',
      '**Phase:** 03',
      '**Status:** Old',
      '**Last Activity:** 2024-01-15',
      '',
      '## Notes',
      'Some notes here.',
    ].join('\n');

    const result = stateReplaceField(content, 'Status', 'New');
    assert.ok(result !== null, 'should return updated content');
    assert.ok(result.includes('**Phase:** 03'), 'Phase line should be unchanged');
    assert.ok(result.includes('**Status:** New'), 'Status should be updated');
    assert.ok(result.includes('**Last Activity:** 2024-01-15'), 'Last Activity line should be unchanged');
    assert.ok(result.includes('## Notes'), 'Notes heading should be unchanged');
    assert.ok(result.includes('Some notes here.'), 'Notes content should be unchanged');
  });

  test('round-trip: extract then replace then extract', () => {
    const content = '# State\n\n**Phase:** 3\n';
    const extracted = stateExtractField(content, 'Phase');
    assert.strictEqual(extracted, '3', 'initial extract should return "3"');

    const updated = stateReplaceField(content, 'Phase', '4');
    assert.ok(updated !== null, 'replace should succeed');

    const reExtracted = stateExtractField(updated, 'Phase');
    assert.strictEqual(reExtracted, '4', 'extract after replace should return "4"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateLoad, cmdStateGet, cmdStatePatch, cmdStateUpdate CLI tests
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateLoad (state load)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns config and state when STATE.md exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_exists, true, 'state_exists should be true');
    assert.strictEqual(output.config_exists, true, 'config_exists should be true');
    assert.strictEqual(output.roadmap_exists, true, 'roadmap_exists should be true');
    assert.ok(output.state_raw.includes('**Status:** Active'), 'state_raw should contain STATE.md content');
  });

  test('returns state_exists false when STATE.md missing', () => {
    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_exists, false, 'state_exists should be false');
    assert.strictEqual(output.state_raw, '', 'state_raw should be empty string');
  });

  test('returns raw key=value format with --raw flag', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' })
    );

    const result = runGsdTools('state load --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(result.output.includes('state_exists=true'), 'raw output should include state_exists=true');
    assert.ok(result.output.includes('config_exists=true'), 'raw output should include config_exists=true');
  });
});

describe('cmdStateGet (state get)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns full content when no section specified', () => {
    const stateContent = '# Project State\n\n**Status:** Active\n**Phase:** 03\n';
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = runGsdTools('state get', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.content !== undefined, 'output should have content field');
    assert.ok(output.content.includes('**Status:** Active'), 'content should include full STATE.md text');
  });

  test('extracts bold field value', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state get Status', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output['Status'], 'Active', 'should extract Status field value');
  });

  test('extracts markdown section content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n\n## Blockers\n\n- item1\n- item2\n'
    );

    const result = runGsdTools('state get Blockers', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output['Blockers'] !== undefined, 'should have Blockers key in output');
    assert.ok(output['Blockers'].includes('item1'), 'section content should include item1');
    assert.ok(output['Blockers'].includes('item2'), 'section content should include item2');
  });

  test('returns error for nonexistent field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state get Missing', tmpDir);
    assert.ok(result.success, `Command should exit 0 even for missing field: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.toLowerCase().includes('not found'), 'error should mention "not found"');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state get Status', tmpDir);
    assert.ok(!result.success, 'command should fail when STATE.md is missing');
    assert.ok(
      result.error.includes('STATE.md') || result.output.includes('STATE.md'),
      'error message should mention STATE.md'
    );
  });
});

describe('cmdStatePatch and cmdStateUpdate (state patch, state update)', () => {
  let tmpDir;
  const stateMd = [
    '# Project State',
    '',
    '**Current Phase:** 03',
    '**Status:** In progress',
    '**Last Activity:** 2024-01-15',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state patch updates multiple fields at once', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state patch --Status Complete --"Current Phase" 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Status:** Complete'), 'Status should be updated to Complete');
    assert.ok(updated.includes('**Last Activity:** 2024-01-15'), 'Last Activity should be unchanged');
  });

  test('state patch reports failed fields that do not exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state patch --Status Done --Missing value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.updated), 'updated should be an array');
    assert.ok(output.updated.includes('Status'), 'Status should be in updated list');
    assert.ok(Array.isArray(output.failed), 'failed should be an array');
    assert.ok(output.failed.includes('Missing'), 'Missing should be in failed list');
  });

  test('state update changes a single field', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state update Status "Phase complete"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'updated should be true');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Status:** Phase complete'), 'Status should be updated');
    assert.ok(updated.includes('**Current Phase:** 03'), 'Current Phase should be unchanged');
    assert.ok(updated.includes('**Last Activity:** 2024-01-15'), 'Last Activity should be unchanged');
  });

  test('state update reports field not found', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state update Missing value', tmpDir);
    assert.ok(result.success, `Command should exit 0 for not-found field: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.ok(output.reason !== undefined, 'should include a reason');
  });

  test('state update returns error when STATE.md missing', () => {
    const result = runGsdTools('state update Status value', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.ok(
      output.reason.includes('STATE.md'),
      'reason should mention STATE.md'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateAdvancePlan, cmdStateRecordMetric, cmdStateUpdateProgress
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateAdvancePlan (state advance-plan)', () => {
  let tmpDir;

  const advanceFixture = [
    '# Project State',
    '',
    '**Current Plan:** 1',
    '**Total Plans in Phase:** 3',
    '**Status:** Executing',
    '**Last Activity:** 2024-01-10',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('advances plan counter when not on last plan', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), advanceFixture);

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, true, 'advanced should be true');
    assert.strictEqual(output.previous_plan, 1, 'previous_plan should be 1');
    assert.strictEqual(output.current_plan, 2, 'current_plan should be 2');
    assert.strictEqual(output.total_plans, 3, 'total_plans should be 3');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Current Plan:** 2'), 'Current Plan should be updated to 2');
    assert.ok(updated.includes('**Status:** Ready to execute'), 'Status should be Ready to execute');
    const today = new Date().toISOString().split('T')[0];
    assert.ok(updated.includes(`**Last Activity:** ${today}`), 'Last Activity should be updated to today');
  });

  test('marks phase complete on last plan', () => {
    const lastPlanFixture = advanceFixture.replace('**Current Plan:** 1', '**Current Plan:** 3');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), lastPlanFixture);

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, false, 'advanced should be false');
    assert.strictEqual(output.reason, 'last_plan', 'reason should be last_plan');
    assert.strictEqual(output.status, 'ready_for_verification', 'status should be ready_for_verification');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('Phase complete'), 'Status should contain Phase complete');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });

  test('returns error when plan fields not parseable', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.toLowerCase().includes('cannot parse'), 'error should mention Cannot parse');
  });
});

describe('cmdStateRecordMetric (state record-metric)', () => {
  let tmpDir;

  const metricsFixture = [
    '# Project State',
    '',
    '## Performance Metrics',
    '',
    '| Plan | Duration | Tasks | Files |',
    '|------|----------|-------|-------|',
    '| Phase 1 P1 | 3min | 2 tasks | 3 files |',
    '',
    '## Session Continuity',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends metric row to existing table', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), metricsFixture);

    const result = runGsdTools('state record-metric --phase 2 --plan 1 --duration 5min --tasks 3 --files 4', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'recorded should be true');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('| Phase 2 P1 | 5min | 3 tasks | 4 files |'), 'new row should be present');
    assert.ok(updated.includes('| Phase 1 P1 | 3min | 2 tasks | 3 files |'), 'existing row should still be present');
  });

  test('replaces None yet placeholder with first metric', () => {
    const noneYetFixture = [
      '# Project State',
      '',
      '## Performance Metrics',
      '',
      '| Plan | Duration | Tasks | Files |',
      '|------|----------|-------|-------|',
      'None yet',
      '',
      '## Session Continuity',
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), noneYetFixture);

    const result = runGsdTools('state record-metric --phase 1 --plan 1 --duration 2min --tasks 1 --files 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(!updated.includes('None yet'), 'None yet placeholder should be removed');
    assert.ok(updated.includes('| Phase 1 P1 | 2min | 1 tasks | 2 files |'), 'new row should be present');
  });

  test('returns error when required fields missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), metricsFixture);

    const result = runGsdTools('state record-metric --phase 1', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(
      output.error.includes('phase') || output.error.includes('plan') || output.error.includes('duration'),
      'error should mention missing required fields'
    );
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state record-metric --phase 1 --plan 1 --duration 2min', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });
});

describe('cmdStateUpdateProgress (state update-progress)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('calculates progress from plan/summary counts', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Progress:** [░░░░░░░░░░] 0%\n'
    );

    // Phase 01: 1 PLAN + 1 SUMMARY = completed
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.writeFileSync(path.join(phase01Dir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase01Dir, '01-01-SUMMARY.md'), '# Summary\n');

    // Phase 02: 1 PLAN only = not completed
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02');
    fs.mkdirSync(phase02Dir, { recursive: true });
    fs.writeFileSync(path.join(phase02Dir, '02-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'updated should be true');
    assert.strictEqual(output.percent, 50, 'percent should be 50');
    assert.strictEqual(output.completed, 1, 'completed should be 1');
    assert.strictEqual(output.total, 2, 'total should be 2');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('50%'), 'STATE.md Progress should contain 50%');
  });

  test('handles zero plans gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Progress:** [░░░░░░░░░░] 0%\n'
    );

    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.percent, 0, 'percent should be 0 when no plans found');
  });

  test('returns error when Progress field missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.ok(output.reason !== undefined, 'should have a reason');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// summary-extract command
// ─────────────────────────────────────────────────────────────────────────────
