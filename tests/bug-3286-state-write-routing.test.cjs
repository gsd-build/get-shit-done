'use strict';
// Regression tests for issue #3286 — three bugs in state.cjs:
//
// Bug A: cmdStateRecordMetric / cmdStateAddDecision return { recorded: false }
//   with exit code 0 when their target section is absent. gsd-executor treats
//   exit 0 as success, silently losing metrics/decisions across an entire phase.
//   Fix: auto-create the missing section (Bug B subsumes A — silent no-op
//   disappears). When auto-created, JSON must include created: true.
//
// Bug B: A fresh STATE.md without ## Performance Metrics or ## Decisions causes
//   both verbs to silently no-op. DWIM: auto-create the canonical section scaffold
//   and then write the row/entry, matching state begin-phase / advance-plan behavior.
//
// Bug C: state record-metric and add-decision must honor --ws <name>, routing
//   writes to .planning/workstreams/<name>/STATE.md instead of root STATE.md.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal STATE.md with all canonical sections */
function buildFullStateMd() {
  return [
    '# GSD State',
    '',
    '## Configuration',
    'Current Phase: 1',
    'Current Phase Name: bootstrap',
    'Total Plans in Phase: 3',
    'Current Plan: 1',
    'Status: Executing',
    'Last Activity: 2026-01-01',
    '',
    '## Performance Metrics',
    '',
    '| Phase | Plan | Duration | Notes |',
    '|-------|------|----------|-------|',
    '',
    '## Decisions',
    '',
    'None yet.',
    '',
    '### Blockers',
    '',
    'None.',
    '',
  ].join('\n');
}

/** Build a STATE.md WITHOUT Performance Metrics or Decisions sections */
function buildBareboneStateMd() {
  return [
    '# GSD State',
    '',
    '## Configuration',
    'Current Phase: 1',
    'Current Phase Name: bootstrap',
    'Total Plans in Phase: 3',
    'Current Plan: 1',
    'Status: Executing',
    'Last Activity: 2026-01-01',
    '',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group B: auto-create missing sections (DWIM)
// ─────────────────────────────────────────────────────────────────────────────

describe('#3286 Bug B: record-metric auto-creates ## Performance Metrics when missing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('record-metric succeeds when ## Performance Metrics is absent', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '1', '--plan', '1', '--duration', '45min'],
      tmpDir,
    );

    assert.ok(result.success, `record-metric must succeed (exit 0), got: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.recorded, true, `recorded must be true, got: ${JSON.stringify(parsed)}`);
  });

  test('record-metric with created:true when section was auto-created', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '1', '--plan', '1', '--duration', '45min'],
      tmpDir,
    );

    assert.ok(result.success, `record-metric must succeed, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.created, true, `JSON must include created:true when section was auto-created`);
  });

  test('record-metric appends row into auto-created section — verifiable via state snapshot', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '1', '--plan', '2', '--duration', '30min', '--tasks', '5'],
      tmpDir,
    );
    assert.ok(result.success, `record-metric must succeed, got: ${result.error}`);

    // Verify the metric appeared in the file by calling state get to read the section
    const getResult = runGsdTools(['state', 'get', 'Performance Metrics'], tmpDir);
    assert.ok(getResult.success, `state get must succeed, got: ${getResult.error}`);

    // Parse JSON to check structural content (no .includes on raw file)
    const sectionContent = JSON.parse(getResult.output);
    const sectionText = sectionContent['Performance Metrics'] || '';
    // Must contain a row referencing Phase 1 P2
    assert.ok(
      sectionText.includes('Phase 1 P2') || sectionText.includes('| Phase 1 P2'),
      `Performance Metrics section must contain the appended row. Got section: ${sectionText}`,
    );
  });

  test('record-metric on state with existing section still works (no regression)', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildFullStateMd());

    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '2', '--plan', '1', '--duration', '1h'],
      tmpDir,
    );
    assert.ok(result.success, `record-metric must succeed on existing section, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.recorded, true, `recorded must be true`);
    // created should be absent or false when section already existed
    assert.ok(!parsed.created, `created must be absent/false when section existed`);
  });
});

describe('#3286 Bug B: add-decision auto-creates ## Decisions when missing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('add-decision succeeds when ## Decisions is absent', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '1', '--summary', 'Use TypeScript for type safety'],
      tmpDir,
    );

    assert.ok(result.success, `add-decision must succeed (exit 0), got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.added, true, `added must be true, got: ${JSON.stringify(parsed)}`);
  });

  test('add-decision with created:true when section was auto-created', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '1', '--summary', 'Use Redis for caching'],
      tmpDir,
    );

    assert.ok(result.success, `add-decision must succeed, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.created, true, `JSON must include created:true when Decisions section auto-created`);
  });

  test('add-decision appended entry is visible in state get', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const summary = 'Adopt PostgreSQL over MySQL for JSONB support';
    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '2', '--summary', summary],
      tmpDir,
    );
    assert.ok(result.success, `add-decision must succeed, got: ${result.error}`);

    // Verify via state get (structured), not raw file grep
    const getResult = runGsdTools(['state', 'get', 'Decisions'], tmpDir);
    assert.ok(getResult.success, `state get Decisions must succeed, got: ${getResult.error}`);

    const sectionContent = JSON.parse(getResult.output);
    const sectionText = sectionContent['Decisions'] || '';
    assert.ok(
      sectionText.includes(summary),
      `Decisions section must contain the appended decision. Got: ${sectionText}`,
    );
  });

  test('add-decision on state with existing Decisions section works (no regression)', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildFullStateMd());

    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '1', '--summary', 'Use monorepo layout'],
      tmpDir,
    );
    assert.ok(result.success, `add-decision must succeed on existing section, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.added, true, `added must be true`);
    assert.ok(!parsed.created, `created must be absent/false when section already existed`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group A: exit code contract (covered by Bug B fix — no silent no-op)
// ─────────────────────────────────────────────────────────────────────────────

describe('#3286 Bug A: record-metric / add-decision never silently no-op', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('record-metric always has recorded:true (never silent false)', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    // Minimal state — no Performance Metrics section
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '1', '--plan', '1', '--duration', '20min'],
      tmpDir,
    );

    // Must exit 0 AND recorded must be true (auto-created or found)
    assert.ok(result.success, `record-metric must exit 0, got stderr: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(
      parsed.recorded,
      true,
      `recorded must be true — section auto-create should prevent silent false. Got: ${JSON.stringify(parsed)}`,
    );
  });

  test('add-decision always has added:true (never silent false)', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '1', '--summary', 'Prefer composition over inheritance'],
      tmpDir,
    );

    assert.ok(result.success, `add-decision must exit 0, got stderr: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(
      parsed.added,
      true,
      `added must be true — section auto-create should prevent silent false. Got: ${JSON.stringify(parsed)}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group C: workstream routing — writes go to workstream STATE.md, not root
// ─────────────────────────────────────────────────────────────────────────────

describe('#3286 Bug C: record-metric / add-decision honor --ws routing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();

    // Create root STATE.md with Performance Metrics + Decisions sections
    const rootStatePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(rootStatePath, buildFullStateMd());

    // Create workstream foo with its own STATE.md (full sections)
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'foo');
    fs.mkdirSync(wsDir, { recursive: true });
    const wsStatePath = path.join(wsDir, 'STATE.md');
    fs.writeFileSync(wsStatePath, buildFullStateMd());
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('record-metric --ws foo writes to workstream STATE.md, not root', () => {
    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '1', '--plan', '1', '--duration', '10min', '--ws', 'foo'],
      tmpDir,
    );

    assert.ok(result.success, `record-metric --ws foo must succeed, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.recorded, true, `recorded must be true`);

    // Workstream STATE.md should have the row; root STATE.md should NOT
    const rootGet = runGsdTools(['state', 'get', 'Performance Metrics'], tmpDir);
    assert.ok(rootGet.success, `state get root must succeed, got: ${rootGet.error}`);
    const rootContent = JSON.parse(rootGet.output)['Performance Metrics'] || '';
    assert.ok(
      !rootContent.includes('Phase 1 P1'),
      `Root STATE.md must NOT have the metric row. Got: ${rootContent}`,
    );

    const wsGet = runGsdTools(['state', 'get', 'Performance Metrics', '--ws', 'foo'], tmpDir);
    assert.ok(wsGet.success, `state get --ws foo must succeed, got: ${wsGet.error}`);
    const wsContent = JSON.parse(wsGet.output)['Performance Metrics'] || '';
    assert.ok(
      wsContent.includes('Phase 1 P1'),
      `Workstream foo STATE.md must have the metric row. Got: ${wsContent}`,
    );
  });

  test('add-decision --ws foo writes to workstream STATE.md, not root', () => {
    const summary = 'Adopt event-sourcing for audit trail';
    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '1', '--summary', summary, '--ws', 'foo'],
      tmpDir,
    );

    assert.ok(result.success, `add-decision --ws foo must succeed, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.added, true, `added must be true`);

    // Root STATE.md must NOT have the decision
    const rootGet = runGsdTools(['state', 'get', 'Decisions'], tmpDir);
    assert.ok(rootGet.success, `state get root must succeed, got: ${rootGet.error}`);
    const rootContent = JSON.parse(rootGet.output)['Decisions'] || '';
    assert.ok(
      !rootContent.includes(summary),
      `Root STATE.md must NOT have the decision. Got: ${rootContent}`,
    );

    // Workstream STATE.md must have the decision
    const wsGet = runGsdTools(['state', 'get', 'Decisions', '--ws', 'foo'], tmpDir);
    assert.ok(wsGet.success, `state get --ws foo must succeed, got: ${wsGet.error}`);
    const wsContent = JSON.parse(wsGet.output)['Decisions'] || '';
    assert.ok(
      wsContent.includes(summary),
      `Workstream foo STATE.md must have the decision. Got: ${wsContent}`,
    );
  });

  test('record-metric --ws foo auto-creates section in workstream STATE.md when missing', () => {
    // Create a workstream without Performance Metrics section
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'bar');
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), buildBareboneStateMd());

    const result = runGsdTools(
      ['state', 'record-metric', '--phase', '1', '--plan', '1', '--duration', '5min', '--ws', 'bar'],
      tmpDir,
    );

    assert.ok(result.success, `record-metric --ws bar must succeed, got: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.recorded, true, `recorded must be true`);
    assert.strictEqual(parsed.created, true, `created must be true when section auto-created in workstream`);

    // Root STATE.md must remain untouched
    const rootGet = runGsdTools(['state', 'get', 'Performance Metrics'], tmpDir);
    assert.ok(rootGet.success);
    const rootContent = JSON.parse(rootGet.output)['Performance Metrics'] || '';
    assert.ok(
      !rootContent.includes('Phase 1 P1'),
      `Root STATE.md must not be written when --ws bar is used`,
    );
  });
});
