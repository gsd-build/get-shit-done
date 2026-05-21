// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * GSD Tools Tests - Milestone
 *
 * Covers: milestone complete command, phases clear command,
 * requirements mark-complete command (regex-global fix), new-milestone
 * workflow verification gate, milestone complete version scoping (#3043).
 */

'use strict';

const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── helpers ─────────────────────────────────────────────────────────────────

function writeState(tmpDir, extra = '') {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n${extra}`,
  );
}

function writeRoadmap(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
}

function mkPhaseDir(tmpDir, name, opts = {}) {
  const p = path.join(tmpDir, '.planning', 'phases', name);
  fs.mkdirSync(p, { recursive: true });
  if (opts.plan) fs.writeFileSync(path.join(p, `${name.split('-')[0]}-01-PLAN.md`), '# Plan\n');
  if (opts.oneLiner) {
    fs.writeFileSync(
      path.join(p, `${name.split('-')[0]}-01-SUMMARY.md`),
      `---\none-liner: ${opts.oneLiner}\n---\n# Summary\n`,
    );
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// milestone complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone complete command', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0 MVP\n\n### Phase 1: Foundation\n**Goal:** Setup\n`);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] User auth\n- [ ] Dashboard\n`,
    );
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-foundation', { oneLiner: 'Set up project infrastructure' });

    const result = runGsdTools('milestone complete v1.0 --name MVP Foundation', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.version, 'v1.0');
    assert.strictEqual(output.phases, 1);
    assert.ok(output.archived.roadmap, 'roadmap should be archived');
    assert.ok(output.archived.requirements, 'requirements should be archived');
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-ROADMAP.md')),
      'archived roadmap should exist',
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md')),
      'archived requirements should exist',
    );
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')));
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v1.0 MVP Foundation'));
    assert.ok(milestones.includes('Set up project infrastructure'));
  });

  test('prepends to existing MILESTONES.md (reverse chronological)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v0.9 Alpha (Shipped: 2025-01-01)\n\n---\n\n`,
    );
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0 --name Beta', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v0.9 Alpha'));
    assert.ok(milestones.includes('v1.0 Beta'));
    assert.ok(milestones.indexOf('v1.0 Beta') < milestones.indexOf('v0.9 Alpha'), 'new entry before old');
  });

  test('three sequential completions maintain reverse-chronological order', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v1.0 First (Shipped: 2025-01-01)\n\n---\n\n`,
    );
    writeRoadmap(tmpDir, `# Roadmap v1.1\n`);
    writeState(tmpDir);

    assert.ok(runGsdTools('milestone complete v1.1 --name Second', tmpDir).success);
    writeRoadmap(tmpDir, `# Roadmap v1.2\n`);
    assert.ok(runGsdTools('milestone complete v1.2 --name Third', tmpDir).success);

    const m = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    const [i10, i11, i12] = ['v1.0 First', 'v1.1 Second', 'v1.2 Third'].map(s => m.indexOf(s));
    assert.ok(i10 !== -1 && i11 !== -1 && i12 !== -1);
    assert.ok(i12 < i11, 'v1.2 before v1.1');
    assert.ok(i11 < i10, 'v1.1 before v1.0');
  });

  test('archives phase directories with --archive-phases flag', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-foundation', { oneLiner: 'Set up project infrastructure' });

    const result = runGsdTools('milestone complete v1.0 --name MVP --archive-phases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archived.phases, true, 'phases should be archived');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases', '01-foundation')));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-foundation')));
  });

  test('archived REQUIREMENTS.md contains archive header', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] **TEST-01**: core.cjs has tests\n- [ ] **TEST-02**: more tests\n`,
    );
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    assert.ok(runGsdTools('milestone complete v1.0 --name MVP', tmpDir).success);

    const archivedReq = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md'), 'utf-8',
    );
    assert.ok(archivedReq.includes('Requirements Archive: v1.0'));
    assert.ok(archivedReq.includes('SHIPPED'));
    assert.ok(archivedReq.includes('Archived:'));
    assert.ok(archivedReq.includes('# Requirements'));
    assert.ok(archivedReq.includes('**TEST-01**'));
  });

  test('STATE.md gets updated during milestone complete', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_updated, true);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('v1.0 milestone complete'));
    assert.ok(state.includes('v1.0 milestone completed and archived'));
  });

  test('normalizes stale STATE.md narrative tails after milestone complete (#3088)', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n\n## Current Position\n\nPhase: 03 — EXECUTING\nPlan: 03-02\nStatus: Executing\nLast activity: 2025-01-01 — Running phase\n\n## Operator Next Steps\n\n- Re-run /gsd:complete-milestone v1.0\n`,
    );

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Phase: Milestone v1.0 complete'));
    assert.ok(state.includes('Status: Awaiting next milestone'));
    assert.ok(!state.includes('Re-run /gsd:complete-milestone'));
    assert.ok(state.includes('/gsd-new-milestone'));
  });

  test('appends canonical narrative sections when STATE.md headings are missing (#3088)', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('## Current Position'));
    assert.ok(state.includes('Phase: Milestone v1.0 complete'));
    assert.ok(state.includes('## Operator Next Steps'));
    assert.ok(state.includes('/gsd-new-milestone'));
  });

  test('handles missing ROADMAP.md gracefully', () => {
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0 --name NoRoadmap', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archived.roadmap, false);
    assert.strictEqual(output.archived.requirements, false);
    assert.strictEqual(output.milestones_updated, true);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')));
  });

  test('scopes stats to current milestone phases only', () => {
    writeRoadmap(tmpDir,
      `# Roadmap v1.1\n\n### Phase 3: New Feature\n**Goal:** Build it\n\n### Phase 4: Polish\n**Goal:** Ship it\n`,
    );
    writeState(tmpDir);

    // Previous milestone phases — must be excluded
    mkPhaseDir(tmpDir, '01-old-setup', { plan: true, oneLiner: 'Old setup work' });
    mkPhaseDir(tmpDir, '02-old-core', { plan: true, oneLiner: 'Old core work' });
    // Current milestone phases
    mkPhaseDir(tmpDir, '03-new-feature', { plan: true, oneLiner: 'Built new feature' });
    const p4 = path.join(tmpDir, '.planning', 'phases', '04-polish');
    fs.mkdirSync(p4, { recursive: true });
    fs.writeFileSync(path.join(p4, '04-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p4, '04-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(p4, '04-01-SUMMARY.md'), '---\none-liner: Polished UI\n---\n# Summary\n');

    const result = runGsdTools('milestone complete v1.1 --name "Second Release"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 2, 'should count only phases 3 and 4');
    assert.strictEqual(output.plans, 3, 'should count only plans from phases 3 and 4');
    assert.ok(output.accomplishments.includes('Built new feature'));
    assert.ok(output.accomplishments.includes('Polished UI'));
    assert.ok(!output.accomplishments.includes('Old setup work'));
    assert.ok(!output.accomplishments.includes('Old core work'));
  });

  test('archive-phases only archives current milestone phases', () => {
    writeRoadmap(tmpDir,
      `# Roadmap v1.1\n\n### Phase 2: Current Work\n**Goal:** Do it\n`,
    );
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-old', { plan: true });
    mkPhaseDir(tmpDir, '02-current', { plan: true });

    assert.ok(runGsdTools('milestone complete v1.1 --name Test --archive-phases', tmpDir).success);

    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.1-phases', '02-current')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-old')));
  });

  test('phase 1 in roadmap does NOT match directory 10-something (no prefix collision)', () => {
    writeRoadmap(tmpDir,
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`,
    );
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-foundation', { plan: true, oneLiner: 'Foundation work' });
    mkPhaseDir(tmpDir, '10-scaling', { plan: true, oneLiner: 'Scaling work' });

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1, 'should count only phase 1, not phase 10');
    assert.strictEqual(output.plans, 1);
    assert.ok(output.accomplishments.includes('Foundation work'));
    assert.ok(!output.accomplishments.includes('Scaling work'));
  });

  test('non-numeric directory is excluded when milestone scoping is active', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n\n### Phase 1: Core\n**Goal:** Build core\n`);
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-core', { plan: true });
    const misc = path.join(tmpDir, '.planning', 'phases', 'notes');
    fs.mkdirSync(misc, { recursive: true });
    fs.writeFileSync(path.join(misc, 'PLAN.md'), '# Not a phase\n');

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1);
    assert.strictEqual(output.plans, 1);
  });

  test('large phase numbers (456, 457) scope correctly', () => {
    writeRoadmap(tmpDir,
      `# Roadmap v1.49\n\n### Phase 456: DACP\n**Goal:** Ship DACP\n\n### Phase 457: Integration\n**Goal:** Integrate\n`,
    );
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '456-dacp', { plan: true });
    mkPhaseDir(tmpDir, '457-integration', { plan: true });
    mkPhaseDir(tmpDir, '45-old', { plan: true });

    const result = runGsdTools('milestone complete v1.49 --name DACP', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).phases, 2);
  });

  test('counts tasks from **Tasks:** N in summary body', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`);
    writeState(tmpDir);
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Built the foundation\n---\n\n# Phase 1: Foundation Summary\n\n**Built the foundation**\n\n## Performance\n\n- **Duration:** 28 min\n- **Tasks:** 7\n- **Files modified:** 12\n`,
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).tasks, 7);
  });

  test('extracts one-liner from body when not in frontmatter', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`);
    writeState(tmpDir);
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\nphase: "01"\n---\n\n# Phase 1: Foundation Summary\n\n**JWT auth with refresh rotation using jose library**\n\n## Performance\n`,
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success);
    assert.ok(JSON.parse(result.output).accomplishments.includes('JWT auth with refresh rotation using jose library'));
  });

  test('updates STATE.md with plain format fields', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\nStatus: In progress\nLast Activity: 2025-01-01\nLast Activity Description: Working\n`,
    );

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success);
    assert.ok(fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8').includes('v1.0 milestone complete'));
  });

  test('handles empty phases directory', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0 --name EmptyPhases', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 0);
    assert.strictEqual(output.plans, 0);
    assert.strictEqual(output.tasks, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phases clear command
// ─────────────────────────────────────────────────────────────────────────────

describe('phases clear command', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('deletes normal phase directories when --confirm is passed', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('phases clear --confirm', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).cleared, 1);
    assert.ok(!fs.existsSync(p1));
  });

  test('requires --confirm when phase directories exist', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    assert.ok(!runGsdTools('phases clear', tmpDir).success);
  });

  test('preserves 999.x backlog phase directories during clear (#1853)', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    const p999a = path.join(tmpDir, '.planning', 'phases', '999.1-some-idea');
    const p999b = path.join(tmpDir, '.planning', 'phases', '999.2-another-idea');
    fs.mkdirSync(p1, { recursive: true });
    fs.mkdirSync(p999a, { recursive: true });
    fs.mkdirSync(p999b, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p999a, 'PLAN.md'), '# Backlog\n');
    fs.writeFileSync(path.join(p999b, 'PLAN.md'), '# Backlog 2\n');

    const result = runGsdTools('phases clear --confirm', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).cleared, 1);
    assert.ok(!fs.existsSync(p1));
    assert.ok(fs.existsSync(p999a));
    assert.ok(fs.existsSync(p999b));
  });

  test('reports 0 cleared when only backlog phases exist', () => {
    const p999a = path.join(tmpDir, '.planning', 'phases', '999.1-idea');
    fs.mkdirSync(p999a, { recursive: true });

    const result = runGsdTools('phases clear --confirm', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).cleared, 0);
    assert.ok(fs.existsSync(p999a));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requirements mark-complete command — regex global-state fix (#milestone-regex-global)
// ─────────────────────────────────────────────────────────────────────────────

describe('requirements mark-complete command', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  function writeRequirements(tmpDir, content) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), content, 'utf-8');
  }

  function readRequirements(tmpDir) {
    return fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
  }

  const STANDARD_REQUIREMENTS = `# Requirements

## Test Coverage
- [ ] **TEST-01**: core.cjs has tests for loadConfig
- [ ] **TEST-02**: core.cjs has tests for resolveModelInternal
- [x] **TEST-03**: core.cjs has tests for escapeRegex (already complete)

## Bug Regressions
- [ ] **REG-01**: Test confirms loadConfig returns model_overrides

## Infrastructure
- [ ] **INFRA-01**: GitHub Actions workflow runs tests

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Complete |
| REG-01 | Phase 1 | Pending |
| INFRA-01 | Phase 6 | Pending |
`;

  test('marks single requirement complete (checkbox + table)', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);
    assert.ok(output.marked_complete.includes('TEST-01'));

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'checkbox should be checked');
    assert.ok(content.includes('| TEST-01 | Phase 1 | Complete |'), 'table row should be Complete');
    assert.ok(content.includes('- [ ] **TEST-02**'), 'TEST-02 should remain unchecked');
  });

  test('handles mixed prefixes in single call (TEST-XX, REG-XX, INFRA-XX)', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,REG-01,INFRA-01', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 3);
    assert.ok(output.marked_complete.includes('TEST-01'));
    assert.ok(output.marked_complete.includes('REG-01'));
    assert.ok(output.marked_complete.includes('INFRA-01'));

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'));
    assert.ok(content.includes('- [x] **REG-01**'));
    assert.ok(content.includes('- [x] **INFRA-01**'));
    assert.ok(content.includes('| TEST-01 | Phase 1 | Complete |'));
    assert.ok(content.includes('| REG-01 | Phase 1 | Complete |'));
    assert.ok(content.includes('| INFRA-01 | Phase 6 | Complete |'));
  });

  test('accepts space-separated IDs', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01 TEST-02', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).marked_complete.length, 2);

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'));
    assert.ok(content.includes('- [x] **TEST-02**'));
  });

  test('accepts bracket-wrapped IDs [REQ-01, REQ-02]', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete [TEST-01,TEST-02]', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).marked_complete.length, 2);

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'));
    assert.ok(content.includes('- [x] **TEST-02**'));
  });

  test('returns not_found for invalid IDs while updating valid ones', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,FAKE-99', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);
    assert.ok(output.marked_complete.includes('TEST-01'));
    assert.ok(output.not_found.includes('FAKE-99'));
    assert.strictEqual(output.total, 2);
  });

  test('idempotent — re-marking already-complete requirement does not corrupt', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-03', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.ok(output.already_complete.includes('TEST-03'));
    assert.deepStrictEqual(output.not_found, []);

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-03**'));
    assert.ok(!content.includes('[xx]'));
    assert.ok(!content.includes('- [x] [x]'));
  });

  test('returns already_complete for idempotent calls on completed requirements', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const output = JSON.parse(runGsdTools('requirements mark-complete TEST-03', tmpDir).output);
    assert.deepStrictEqual(output.already_complete, ['TEST-03']);
    assert.deepStrictEqual(output.not_found, []);
  });

  test('mixed: updates pending, reports already-complete, and flags missing', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const output = JSON.parse(
      runGsdTools('requirements mark-complete TEST-01,TEST-03,FAKE-99', tmpDir).output,
    );
    assert.deepStrictEqual(output.marked_complete, ['TEST-01']);
    assert.deepStrictEqual(output.already_complete, ['TEST-03']);
    assert.deepStrictEqual(output.not_found, ['FAKE-99']);
  });

  test('missing REQUIREMENTS.md returns expected error structure', () => {
    const output = JSON.parse(runGsdTools('requirements mark-complete TEST-01', tmpDir).output);
    assert.strictEqual(output.updated, false);
    assert.strictEqual(output.reason, 'REQUIREMENTS.md not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone.cjs regex global-state fix (structural regression guard)
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone.cjs regex global state fix', () => {
  // allow-test-rule: structural-regression-guard
  // milestone.cjs must use replace()+compare, not test()+replace(), to avoid
  // regex lastIndex corruption with global flags.
  const MILESTONE_SRC = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'milestone.cjs');
  let src;

  before(() => { src = fs.readFileSync(MILESTONE_SRC, 'utf-8'); });

  test('checkbox update uses replace() + compare, not test() + replace()', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete'),
    );
    assert.ok(!funcBody.includes('checkboxPattern.test(reqContent)'));
    assert.ok(
      funcBody.includes('afterCheckbox !== reqContent') ||
      funcBody.includes('afterCheckbox!==reqContent'),
    );
  });

  test('table update uses replace() + compare, not test() + replace()', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete'),
    );
    assert.ok(!funcBody.includes('tablePattern.test(reqContent)'));
    assert.ok(
      funcBody.includes('afterTable !== reqContent') ||
      funcBody.includes('afterTable!==reqContent'),
    );
  });

  test('done-check regexes use non-global flag (only need existence check)', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete'),
    );
    const doneCheckboxMatch = funcBody.match(/doneCheckbox\s*=\s*new RegExp\([^)]+,\s*'([^']+)'\)/);
    const doneTableMatch = funcBody.match(/doneTable\s*=\s*new RegExp\([^)]+,\s*'([^']+)'\)/);
    assert.ok(doneCheckboxMatch, 'doneCheckbox regex should exist');
    assert.ok(doneTableMatch, 'doneTable regex should exist');
    assert.ok(!doneCheckboxMatch[1].includes('g'));
    assert.ok(!doneTableMatch[1].includes('g'));
  });

  test('no duplicate regex construction for the same pattern', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete'),
    );
    const tableConstructions = funcBody.split('\n').filter(
      line => line.includes('tablePattern') && line.includes('new RegExp'),
    );
    assert.ok(tableConstructions.length <= 1, `Expected ≤1 tablePattern construction, got ${tableConstructions.length}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// new-milestone workflow verification gate (#1269)
// ─────────────────────────────────────────────────────────────────────────────

describe('new-milestone workflow verification gate', () => {
  test('new-milestone workflow has verification step before writing PROJECT.md', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-milestone.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('Verify Milestone Understanding'));
    const verifyIdx = content.indexOf('Verify Milestone Understanding');
    const updateIdx = content.indexOf('## 4. Update PROJECT.md');
    assert.ok(verifyIdx > 0);
    assert.ok(updateIdx > 0);
    assert.ok(verifyIdx < updateIdx);
  });

  test('verification step uses AskUserQuestion with adjust loop', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-milestone.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    const section = content.slice(content.indexOf('## 3.5'), content.indexOf('## 4.'));
    assert.ok(section.includes('AskUserQuestion'));
    assert.ok(section.includes('Adjust'));
    assert.ok(section.includes('Looks good'));
    assert.ok(
      section.includes('Loop until') || section.includes('loop until') || section.includes('re-present'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone complete respects explicit version scope (#3043)
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone complete explicit version scope (#3043)', () => {
  test('milestone.complete v3.6 uses v3.6 phases even when STATE milestone is v3.5', () => {
    const tmpDir = createTempProject('gsd-bug-3043-');
    try {
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v3.5\n---\n');
      writeRoadmap(
        tmpDir,
        '# Roadmap\n\n## 🚧 v3.5 Paused\n### Phase 103: old\n### Phase 104: old2\n\n## 🚧 v3.6 Current\n### Phase 108: new\n',
      );
      fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n');

      for (const [dir, liner] of [['103.old', 'old milestone A'], ['104.old', 'old milestone B'], ['108.new', 'new milestone']]) {
        const p = path.join(tmpDir, '.planning', 'phases', dir);
        fs.mkdirSync(p, { recursive: true });
        fs.writeFileSync(path.join(p, 'SUMMARY.md'), `one-liner: ${liner}\n\n## Summary\n${liner.split(' ')[0]}\n`);
      }

      const result = runGsdTools(['milestone', 'complete', 'v3.6', '--raw'], tmpDir);
      assert.equal(result.success, true, result.error || result.output);
      const payload = JSON.parse(result.output);
      assert.equal(payload.version, 'v3.6');
      assert.equal(payload.phases, 1, `expected 1 phase for v3.6, got ${payload.phases}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('milestone.complete fails when explicit milestone version resolves no phases', () => {
    const tmpDir = createTempProject('gsd-bug-3043-empty-');
    try {
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v1.0\n---\n');
      writeRoadmap(tmpDir, '# Roadmap\n\n## 🚧 v1.0\n### Phase 1: foundation\n');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

      const result = runGsdTools(['milestone', 'complete', 'v9.9', '--raw'], tmpDir);
      assert.equal(result.success, false, 'expected command to fail when no phases match explicit version');
      assert.match(result.error || '', /no phases|phase/i);
    } finally {
      cleanup(tmpDir);
    }
  });
});
