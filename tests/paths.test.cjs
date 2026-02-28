/**
 * GSD Tools Tests - paths.cjs
 *
 * Tests for resolvePlanningPaths, setMilestoneOverride, and milestone CLI commands.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const {
  resolvePlanningPaths,
  setMilestoneOverride,
  getMilestoneOverride,
} = require('../get-shit-done/bin/lib/paths.cjs');

// ─── resolvePlanningPaths — legacy mode ─────────────────────────────────────

describe('resolvePlanningPaths — legacy mode', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    setMilestoneOverride(null);
  });

  afterEach(() => {
    setMilestoneOverride(null);
    cleanup(tmpDir);
  });

  test('returns .planning/STATE.md for rel.state when no ACTIVE_MILESTONE', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.rel.state, '.planning/STATE.md');
  });

  test('isMultiMilestone is false', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.isMultiMilestone, false);
  });

  test('milestone is null', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.milestone, null);
  });

  test('abs.state ends with .planning/STATE.md', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.ok(p.abs.state.endsWith(path.join('.planning', 'STATE.md')),
      `expected abs.state to end with .planning/STATE.md, got ${p.abs.state}`);
  });

  test('global.abs.project ends with .planning/PROJECT.md', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.ok(p.global.abs.project.endsWith(path.join('.planning', 'PROJECT.md')),
      `expected global.abs.project to end with .planning/PROJECT.md, got ${p.global.abs.project}`);
  });
});

// ─── resolvePlanningPaths — multi-milestone mode ────────────────────────────

describe('resolvePlanningPaths — multi-milestone mode', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    setMilestoneOverride(null);
    // Create ACTIVE_MILESTONE file with content "v2.0"
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ACTIVE_MILESTONE'), 'v2.0', 'utf-8');
  });

  afterEach(() => {
    setMilestoneOverride(null);
    cleanup(tmpDir);
  });

  test('returns .planning/milestones/v2.0/STATE.md for rel.state', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.rel.state, '.planning/milestones/v2.0/STATE.md');
  });

  test('isMultiMilestone is true', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.isMultiMilestone, true);
  });

  test('milestone is "v2.0"', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.milestone, 'v2.0');
  });

  test('abs.phases ends with .planning/milestones/v2.0/phases', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.ok(
      p.abs.phases.endsWith(path.join('.planning', 'milestones', 'v2.0', 'phases')),
      `expected abs.phases to end with .planning/milestones/v2.0/phases, got ${p.abs.phases}`
    );
  });

  test('global.abs.project still points to .planning/ root', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.ok(
      p.global.abs.project.endsWith(path.join('.planning', 'PROJECT.md')),
      `expected global.abs.project to end with .planning/PROJECT.md, got ${p.global.abs.project}`
    );
    // Should NOT contain milestones subpath
    assert.ok(
      !p.global.abs.project.includes('milestones'),
      'global.abs.project should not contain milestones'
    );
  });

  test('global.abs.milestones still points to .planning/ root', () => {
    const p = resolvePlanningPaths(tmpDir);
    assert.ok(
      p.global.abs.milestones.endsWith(path.join('.planning', 'MILESTONES.md')),
      `expected global.abs.milestones to end with .planning/MILESTONES.md, got ${p.global.abs.milestones}`
    );
  });
});

// ─── resolvePlanningPaths — explicit override ───────────────────────────────

describe('resolvePlanningPaths — explicit override', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    setMilestoneOverride(null);
  });

  afterEach(() => {
    setMilestoneOverride(null);
    cleanup(tmpDir);
  });

  test('milestoneOverride="hotfix" returns milestone-scoped paths regardless of ACTIVE_MILESTONE', () => {
    // Write a different ACTIVE_MILESTONE to prove override takes precedence
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ACTIVE_MILESTONE'), 'v2.0', 'utf-8');

    const p = resolvePlanningPaths(tmpDir, 'hotfix');
    assert.strictEqual(p.rel.state, '.planning/milestones/hotfix/STATE.md');
    assert.strictEqual(p.milestone, 'hotfix');
    assert.strictEqual(p.isMultiMilestone, true);
  });

  test('milestoneOverride="hotfix" works when no ACTIVE_MILESTONE file exists', () => {
    const p = resolvePlanningPaths(tmpDir, 'hotfix');
    assert.strictEqual(p.rel.state, '.planning/milestones/hotfix/STATE.md');
    assert.strictEqual(p.milestone, 'hotfix');
    assert.strictEqual(p.isMultiMilestone, true);
  });
});

// ─── setMilestoneOverride ───────────────────────────────────────────────────

describe('setMilestoneOverride', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    setMilestoneOverride(null);
  });

  afterEach(() => {
    setMilestoneOverride(null);
    cleanup(tmpDir);
  });

  test('setting override causes resolvePlanningPaths to return milestone-scoped paths', () => {
    setMilestoneOverride('v3.0');
    const p = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p.milestone, 'v3.0');
    assert.strictEqual(p.isMultiMilestone, true);
    assert.strictEqual(p.rel.state, '.planning/milestones/v3.0/STATE.md');
    setMilestoneOverride(null);
  });

  test('clearing override restores legacy paths', () => {
    setMilestoneOverride('v3.0');
    const p1 = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p1.milestone, 'v3.0');

    setMilestoneOverride(null);
    const p2 = resolvePlanningPaths(tmpDir);
    assert.strictEqual(p2.milestone, null);
    assert.strictEqual(p2.isMultiMilestone, false);
    assert.strictEqual(p2.rel.state, '.planning/STATE.md');
  });

  test('getMilestoneOverride reflects current value', () => {
    assert.strictEqual(getMilestoneOverride(), null);
    setMilestoneOverride('v3.0');
    assert.strictEqual(getMilestoneOverride(), 'v3.0');
    setMilestoneOverride(null);
    assert.strictEqual(getMilestoneOverride(), null);
  });
});

// ─── milestone create command (via CLI) ─────────────────────────────────────

describe('milestone create command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates milestone directory with STATE.md, ROADMAP.md, config.json, phases/', () => {
    const result = runGsdTools('milestone create v2.0', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.strictEqual(output.name, 'v2.0');

    const milestoneDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    assert.ok(fs.existsSync(path.join(milestoneDir, 'STATE.md')), 'STATE.md should exist');
    assert.ok(fs.existsSync(path.join(milestoneDir, 'ROADMAP.md')), 'ROADMAP.md should exist');
    assert.ok(fs.existsSync(path.join(milestoneDir, 'config.json')), 'config.json should exist');
    assert.ok(fs.existsSync(path.join(milestoneDir, 'phases')), 'phases/ should exist');
  });

  test('writes ACTIVE_MILESTONE file', () => {
    runGsdTools('milestone create v2.0', tmpDir);

    const activeMilestone = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ACTIVE_MILESTONE'), 'utf-8'
    ).trim();
    assert.strictEqual(activeMilestone, 'v2.0');
  });
});

// ─── milestone switch command ───────────────────────────────────────────────

describe('milestone switch command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create two milestones
    runGsdTools('milestone create v1.0', tmpDir);
    runGsdTools('milestone create v2.0', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('switches between milestones and updates ACTIVE_MILESTONE', () => {
    // After creating v2.0, it should be active
    let active = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ACTIVE_MILESTONE'), 'utf-8'
    ).trim();
    assert.strictEqual(active, 'v2.0');

    // Switch to v1.0
    const result = runGsdTools('milestone switch v1.0', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.switched, true);
    assert.strictEqual(output.name, 'v1.0');

    active = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ACTIVE_MILESTONE'), 'utf-8'
    ).trim();
    assert.strictEqual(active, 'v1.0');
  });

  test('switch back to second milestone', () => {
    runGsdTools('milestone switch v1.0', tmpDir);
    const result = runGsdTools('milestone switch v2.0', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const active = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ACTIVE_MILESTONE'), 'utf-8'
    ).trim();
    assert.strictEqual(active, 'v2.0');
  });
});

// ─── milestone list command ─────────────────────────────────────────────────

describe('milestone list command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    runGsdTools('milestone create v1.0', tmpDir);
    runGsdTools('milestone create v2.0', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('lists both milestones with correct active flag', () => {
    const result = runGsdTools('milestone list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should have 2 milestones');

    // Find milestones by name (note: may also include auto-migrated 'initial')
    const names = output.milestones.map(m => m.name);
    assert.ok(names.includes('v1.0'), 'v1.0 should be listed');
    assert.ok(names.includes('v2.0'), 'v2.0 should be listed');

    // v2.0 was created last, so it should be active
    const v2 = output.milestones.find(m => m.name === 'v2.0');
    assert.strictEqual(v2.active, true, 'v2.0 should be active');

    const v1 = output.milestones.find(m => m.name === 'v1.0');
    assert.strictEqual(v1.active, false, 'v1.0 should not be active');
  });
});

// ─── milestone status command ───────────────────────────────────────────────

describe('milestone status command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports legacy mode when no active milestone', () => {
    const result = runGsdTools('milestone status', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, null);
    assert.strictEqual(output.is_multi_milestone, false);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
  });

  test('reports active milestone name when one is set', () => {
    runGsdTools('milestone create v2.0', tmpDir);

    const result = runGsdTools('milestone status', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, 'v2.0');
    assert.strictEqual(output.is_multi_milestone, true);
    assert.strictEqual(output.state_path, '.planning/milestones/v2.0/STATE.md');
  });
});

// ─── --milestone flag integration ───────────────────────────────────────────

describe('--milestone flag integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create a milestone so the directory exists
    runGsdTools('milestone create v2.0', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state load --milestone v2.0 reads from milestone-scoped directory', () => {
    const result = runGsdTools('state load --milestone v2.0', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // The state should be loaded (state_exists depends on whether the milestone has a STATE.md)
    // Since milestone create writes STATE.md, it should exist
    assert.strictEqual(output.state_exists, true, 'state should exist in milestone directory');
  });

  test('milestone status --milestone v2.0 shows v2.0 paths', () => {
    // Switch away from v2.0 first
    runGsdTools('milestone create v3.0', tmpDir);

    const result = runGsdTools('milestone status --milestone v2.0', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/milestones/v2.0/STATE.md');
  });
});
