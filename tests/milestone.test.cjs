// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * GSD Tools Tests - Milestone
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('milestone complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] User auth\n- [ ] Dashboard\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Set up project infrastructure\n---\n# Summary\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP Foundation', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.version, 'v1.0');
    assert.strictEqual(output.phases, 1);
    assert.ok(output.archived.roadmap, 'roadmap should be archived');
    assert.ok(output.archived.requirements, 'requirements should be archived');

    // Verify archive files exist
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-ROADMAP.md')),
      'archived roadmap should exist'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md')),
      'archived requirements should exist'
    );

    // Verify MILESTONES.md created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created'
    );
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v1.0 MVP Foundation'), 'milestone entry should contain name');
    assert.ok(milestones.includes('Set up project infrastructure'), 'accomplishments should be listed');
  });

  test('prepends to existing MILESTONES.md (reverse chronological)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v0.9 Alpha (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Beta', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v0.9 Alpha'), 'existing entry should be preserved');
    assert.ok(milestones.includes('v1.0 Beta'), 'new entry should be present');
    // New entry should appear BEFORE old entry (reverse chronological)
    const newIdx = milestones.indexOf('v1.0 Beta');
    const oldIdx = milestones.indexOf('v0.9 Alpha');
    assert.ok(newIdx < oldIdx, 'new entry should appear before old entry (reverse chronological)');
  });

  test('three sequential completions maintain reverse-chronological order', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v1.0 First (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.1\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    let result = runGsdTools('milestone complete v1.1 --name Second', tmpDir);
    assert.ok(result.success, `v1.1 failed: ${result.error}`);

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.2\n`
    );

    result = runGsdTools('milestone complete v1.2 --name Third', tmpDir);
    assert.ok(result.success, `v1.2 failed: ${result.error}`);

    const milestones = fs.readFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8'
    );

    const idx10 = milestones.indexOf('v1.0 First');
    const idx11 = milestones.indexOf('v1.1 Second');
    const idx12 = milestones.indexOf('v1.2 Third');

    assert.ok(idx10 !== -1, 'v1.0 should be present');
    assert.ok(idx11 !== -1, 'v1.1 should be present');
    assert.ok(idx12 !== -1, 'v1.2 should be present');
    assert.ok(idx12 < idx11, 'v1.2 should appear before v1.1');
    assert.ok(idx11 < idx10, 'v1.1 should appear before v1.0');
  });

  test('archives phase directories with --archive-phases flag', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Set up project infrastructure\n---\n# Summary\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP --archive-phases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archived.phases, true, 'phases should be archived');

    // Phase directory moved to milestones/v1.0-phases/
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases', '01-foundation')),
      'archived phase directory should exist in milestones/v1.0-phases/'
    );

    // Original phase directory no longer exists
    assert.ok(
      !fs.existsSync(p1),
      'original phase directory should no longer exist'
    );
  });

  test('archived REQUIREMENTS.md contains archive header', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] **TEST-01**: core.cjs has tests\n- [ ] **TEST-02**: more tests\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const archivedReq = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md'), 'utf-8'
    );
    assert.ok(archivedReq.includes('Requirements Archive: v1.0'), 'should contain archive version');
    assert.ok(archivedReq.includes('SHIPPED'), 'should contain SHIPPED status');
    assert.ok(archivedReq.includes('Archived:'), 'should contain Archived: date line');
    // Original content preserved after header
    assert.ok(archivedReq.includes('# Requirements'), 'original content should be preserved');
    assert.ok(archivedReq.includes('**TEST-01**'), 'original requirement items should be preserved');
  });

  test('STATE.md gets updated during milestone complete', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_updated, true, 'state_updated should be true');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('v1.0 milestone complete'), 'status should be updated to milestone complete');
    assert.ok(
      state.includes('v1.0 milestone completed and archived'),
      'last activity description should reference milestone completion'
    );
  });

  test('handles missing ROADMAP.md gracefully', () => {
    // Only STATE.md — no ROADMAP.md, no REQUIREMENTS.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name NoRoadmap', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archived.roadmap, false, 'roadmap should not be archived');
    assert.strictEqual(output.archived.requirements, false, 'requirements should not be archived');
    assert.strictEqual(output.milestones_updated, true, 'MILESTONES.md should still be created');

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created even without ROADMAP.md'
    );
  });

  test('scopes stats to current milestone phases only', () => {
    // Set up ROADMAP.md that only references Phase 3 and Phase 4
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.1\n\n### Phase 3: New Feature\n**Goal:** Build it\n\n### Phase 4: Polish\n**Goal:** Ship it\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    // Create phases from PREVIOUS milestone (should be excluded)
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-old-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '---\none-liner: Old setup work\n---\n# Summary\n');
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-old-core');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p2, '02-01-SUMMARY.md'), '---\none-liner: Old core work\n---\n# Summary\n');

    // Create phases for CURRENT milestone (should be included)
    const p3 = path.join(tmpDir, '.planning', 'phases', '03-new-feature');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p3, '03-01-SUMMARY.md'), '---\none-liner: Built new feature\n---\n# Summary\n');
    const p4 = path.join(tmpDir, '.planning', 'phases', '04-polish');
    fs.mkdirSync(p4, { recursive: true });
    fs.writeFileSync(path.join(p4, '04-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p4, '04-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(p4, '04-01-SUMMARY.md'), '---\none-liner: Polished UI\n---\n# Summary\n');

    const result = runGsdTools('milestone complete v1.1 --name "Second Release"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should only count phases 3 and 4, not 1 and 2
    assert.strictEqual(output.phases, 2, 'should count only milestone phases (3, 4)');
    assert.strictEqual(output.plans, 3, 'should count only plans from phases 3 and 4');
    // Accomplishments should only be from phases 3 and 4
    assert.ok(output.accomplishments.includes('Built new feature'), 'should include current milestone accomplishment');
    assert.ok(output.accomplishments.includes('Polished UI'), 'should include current milestone accomplishment');
    assert.ok(!output.accomplishments.includes('Old setup work'), 'should NOT include previous milestone accomplishment');
    assert.ok(!output.accomplishments.includes('Old core work'), 'should NOT include previous milestone accomplishment');
  });

  test('archive-phases only archives current milestone phases', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.1\n\n### Phase 2: Current Work\n**Goal:** Do it\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    // Phase from previous milestone
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-old');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');

    // Phase from current milestone
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-current');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('milestone complete v1.1 --name Test --archive-phases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Phase 2 should be archived
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.1-phases', '02-current')),
      'current milestone phase should be archived'
    );
    // Phase 1 should still be in place (not archived)
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-old')),
      'previous milestone phase should NOT be archived'
    );
  });

  test('phase 1 in roadmap does NOT match directory 10-something (no prefix collision)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      '---\none-liner: Foundation work\n---\n'
    );

    const p10 = path.join(tmpDir, '.planning', 'phases', '10-scaling');
    fs.mkdirSync(p10, { recursive: true });
    fs.writeFileSync(path.join(p10, '10-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(
      path.join(p10, '10-01-SUMMARY.md'),
      '---\none-liner: Scaling work\n---\n'
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1, 'should count only phase 1, not phase 10');
    assert.strictEqual(output.plans, 1, 'should count only plans from phase 1');
    assert.ok(
      output.accomplishments.includes('Foundation work'),
      'should include phase 1 accomplishment'
    );
    assert.ok(
      !output.accomplishments.includes('Scaling work'),
      'should NOT include phase 10 accomplishment'
    );
  });

  test('non-numeric directory is excluded when milestone scoping is active', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Core\n**Goal:** Build core\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-core');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');

    // Non-phase directory — should be excluded
    const misc = path.join(tmpDir, '.planning', 'phases', 'notes');
    fs.mkdirSync(misc, { recursive: true });
    fs.writeFileSync(path.join(misc, 'PLAN.md'), '# Not a phase\n');

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1, 'non-numeric dir should not be counted as a phase');
    assert.strictEqual(output.plans, 1, 'plans from non-numeric dir should not be counted');
  });

  test('large phase numbers (456, 457) scope correctly', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.49\n\n### Phase 456: DACP\n**Goal:** Ship DACP\n\n### Phase 457: Integration\n**Goal:** Integrate\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p456 = path.join(tmpDir, '.planning', 'phases', '456-dacp');
    fs.mkdirSync(p456, { recursive: true });
    fs.writeFileSync(path.join(p456, '456-01-PLAN.md'), '# Plan\n');

    const p457 = path.join(tmpDir, '.planning', 'phases', '457-integration');
    fs.mkdirSync(p457, { recursive: true });
    fs.writeFileSync(path.join(p457, '457-01-PLAN.md'), '# Plan\n');

    // Phase 45 from prior milestone — should not match
    const p45 = path.join(tmpDir, '.planning', 'phases', '45-old');
    fs.mkdirSync(p45, { recursive: true });
    fs.writeFileSync(path.join(p45, 'PLAN.md'), '# Plan\n');

    const result = runGsdTools('milestone complete v1.49 --name DACP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 2, 'should count only phases 456 and 457');
  });

  test('counts tasks from **Tasks:** N in summary body', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Built the foundation\n---\n\n# Phase 1: Foundation Summary\n\n**Built the foundation**\n\n## Performance\n\n- **Duration:** 28 min\n- **Tasks:** 7\n- **Files modified:** 12\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.tasks, 7, 'should count tasks from **Tasks:** N field');
  });

  test('extracts one-liner from body when not in frontmatter', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    // No one-liner in frontmatter, but present in body as bold line
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\nphase: "01"\n---\n\n# Phase 1: Foundation Summary\n\n**JWT auth with refresh rotation using jose library**\n\n## Performance\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.accomplishments.includes('JWT auth with refresh rotation using jose library'),
      'should extract one-liner from body bold line'
    );
  });

  test('updates STATE.md with plain format fields', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\nStatus: In progress\nLast Activity: 2025-01-01\nLast Activity Description: Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('v1.0 milestone complete'), 'plain Status field should be updated');
  });

  test('handles empty phases directory', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );
    // phases directory exists but is empty (from createTempProject)

    const result = runGsdTools('milestone complete v1.0 --name EmptyPhases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 0, 'phase count should be 0');
    assert.strictEqual(output.plans, 0, 'plan count should be 0');
    assert.strictEqual(output.tasks, 0, 'task count should be 0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phases clear command
// ─────────────────────────────────────────────────────────────────────────────

describe('phases clear command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('deletes normal phase directories when --confirm is passed', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('phases clear --confirm', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.cleared, 1, 'should have cleared 1 directory');
    assert.ok(!fs.existsSync(p1), '01-setup should be deleted');
  });

  test('requires --confirm when phase directories exist', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });

    const result = runGsdTools('phases clear', tmpDir);
    assert.ok(!result.success, 'should fail without --confirm');
  });

  test('preserves 999.x backlog phase directories during clear (#1853)', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    const p999a = path.join(tmpDir, '.planning', 'phases', '999.1-some-idea');
    const p999b = path.join(tmpDir, '.planning', 'phases', '999.2-another-idea');

    fs.mkdirSync(p1, { recursive: true });
    fs.mkdirSync(p999a, { recursive: true });
    fs.mkdirSync(p999b, { recursive: true });

    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p999a, 'PLAN.md'), '# Backlog idea\n');
    fs.writeFileSync(path.join(p999b, 'PLAN.md'), '# Another backlog idea\n');

    const result = runGsdTools('phases clear --confirm', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.cleared, 1, 'should have cleared only 1 directory (not backlog)');
    assert.ok(!fs.existsSync(p1), '01-setup should be deleted');
    assert.ok(fs.existsSync(p999a), '999.1-some-idea should be preserved');
    assert.ok(fs.existsSync(p999b), '999.2-another-idea should be preserved');
  });

  test('reports 0 cleared when only backlog phases exist', () => {
    const p999a = path.join(tmpDir, '.planning', 'phases', '999.1-idea');
    fs.mkdirSync(p999a, { recursive: true });

    const result = runGsdTools('phases clear --confirm', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.cleared, 0, 'cleared should be 0 when only backlog phases exist');
    assert.ok(fs.existsSync(p999a), '999.1-idea should be preserved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requirements mark-complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('requirements mark-complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ─── helpers ──────────────────────────────────────────────────────────────

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

  // ─── tests ────────────────────────────────────────────────────────────────

  test('marks single requirement complete (checkbox + table)', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);
    assert.ok(output.marked_complete.includes('TEST-01'), 'TEST-01 should be marked complete');

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'checkbox should be checked');
    assert.ok(content.includes('| TEST-01 | Phase 1 | Complete |'), 'table row should be Complete');
    // Other checkboxes unchanged
    assert.ok(content.includes('- [ ] **TEST-02**'), 'TEST-02 should remain unchecked');
  });

  test('handles mixed prefixes in single call (TEST-XX, REG-XX, INFRA-XX)', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,REG-01,INFRA-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 3, 'should mark 3 requirements complete');
    assert.ok(output.marked_complete.includes('TEST-01'));
    assert.ok(output.marked_complete.includes('REG-01'));
    assert.ok(output.marked_complete.includes('INFRA-01'));

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'TEST-01 checkbox should be checked');
    assert.ok(content.includes('- [x] **REG-01**'), 'REG-01 checkbox should be checked');
    assert.ok(content.includes('- [x] **INFRA-01**'), 'INFRA-01 checkbox should be checked');
    assert.ok(content.includes('| TEST-01 | Phase 1 | Complete |'), 'TEST-01 table should be Complete');
    assert.ok(content.includes('| REG-01 | Phase 1 | Complete |'), 'REG-01 table should be Complete');
    assert.ok(content.includes('| INFRA-01 | Phase 6 | Complete |'), 'INFRA-01 table should be Complete');
  });

  test('accepts space-separated IDs', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01 TEST-02', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 2, 'should mark 2 requirements complete');

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'TEST-01 should be checked');
    assert.ok(content.includes('- [x] **TEST-02**'), 'TEST-02 should be checked');
  });

  test('accepts bracket-wrapped IDs [REQ-01, REQ-02]', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete [TEST-01,TEST-02]', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 2, 'should mark 2 requirements complete');

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'TEST-01 should be checked');
    assert.ok(content.includes('- [x] **TEST-02**'), 'TEST-02 should be checked');
  });

  test('returns not_found for invalid IDs while updating valid ones', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,FAKE-99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'should still update valid IDs');
    assert.ok(output.marked_complete.includes('TEST-01'), 'TEST-01 should be marked complete');
    assert.ok(output.not_found.includes('FAKE-99'), 'FAKE-99 should be in not_found');
    assert.strictEqual(output.total, 2, 'total should reflect all IDs attempted');
  });

  test('idempotent — re-marking already-complete requirement does not corrupt', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    // TEST-03 already has [x] and Complete in the fixture
    const result = runGsdTools('requirements mark-complete TEST-03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.already_complete.includes('TEST-03'), 'already-complete ID should be in already_complete');
    assert.deepStrictEqual(output.not_found, [], 'should not appear in not_found');

    const content = readRequirements(tmpDir);
    // File should not be corrupted — no [xx] or doubled markers
    assert.ok(content.includes('- [x] **TEST-03**'), 'existing [x] should remain intact');
    assert.ok(!content.includes('[xx]'), 'should not have doubled x markers');
    assert.ok(!content.includes('- [x] [x]'), 'should not have duplicate checkbox');
  });

  test('returns already_complete for idempotent calls on completed requirements', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    // TEST-03 is already [x] in the fixture
    const result = runGsdTools('requirements mark-complete TEST-03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.already_complete, ['TEST-03'],
      'should report TEST-03 as already_complete');
    assert.deepStrictEqual(output.not_found, [],
      'should not report already-complete IDs as not_found');
  });

  test('mixed: updates pending, reports already-complete, and flags missing', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,TEST-03,FAKE-99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.marked_complete, ['TEST-01'],
      'should mark TEST-01 complete');
    assert.deepStrictEqual(output.already_complete, ['TEST-03'],
      'should report TEST-03 as already_complete');
    assert.deepStrictEqual(output.not_found, ['FAKE-99'],
      'should report FAKE-99 as not_found');
  });

  test('missing REQUIREMENTS.md returns expected error structure', () => {
    // createTempProject does not create REQUIREMENTS.md — so it's already missing

    const result = runGsdTools('requirements mark-complete TEST-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.strictEqual(output.reason, 'REQUIREMENTS.md not found', 'should report file not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// new-milestone workflow verification gate (#1269)
// ─────────────────────────────────────────────────────────────────────────────

describe('new-milestone workflow verification gate', () => {
  test('new-milestone workflow has verification step before writing PROJECT.md', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-milestone.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    // Must have a verification step between goal gathering and PROJECT.md writing
    assert.ok(
      content.includes('Verify Milestone Understanding'),
      'workflow must have a "Verify Milestone Understanding" step'
    );

    // Verification must come before Step 4 (Update PROJECT.md)
    const verifyIdx = content.indexOf('Verify Milestone Understanding');
    const updateIdx = content.indexOf('## 4. Update PROJECT.md');
    assert.ok(verifyIdx > 0, 'verification step must exist');
    assert.ok(updateIdx > 0, 'Update PROJECT.md step must exist');
    assert.ok(
      verifyIdx < updateIdx,
      'verification step must appear before Update PROJECT.md step'
    );
  });

  test('verification step uses AskUserQuestion with adjust loop', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-milestone.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    // Extract the section between 3.5 and 4
    const sectionStart = content.indexOf('## 3.5');
    const sectionEnd = content.indexOf('## 4.');
    const section = content.slice(sectionStart, sectionEnd);

    assert.ok(section.includes('AskUserQuestion'), 'verification must use AskUserQuestion');
    assert.ok(section.includes('Adjust'), 'verification must offer Adjust option');
    assert.ok(section.includes('Looks good'), 'verification must offer Looks good option');
    assert.ok(
      section.includes('Loop until') || section.includes('loop until') || section.includes('re-present'),
      'verification must loop until user approves'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate consistency command
// ─────────────────────────────────────────────────────────────────────────────

