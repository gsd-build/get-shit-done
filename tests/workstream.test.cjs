/**
 * Workstream Tests
 *
 * Tests for workstream CRUD, path resolution, migration, active workstream
 * management, and multi-workstream isolation.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, runGsdToolsWithEnv, createTempProject, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Workstream Create
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream create', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create PROJECT.md (required by workstream create)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates a new workstream directory structure', () => {
    const result = runGsdTools('workstream create my-feature', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.strictEqual(output.workstream, 'my-feature');
    assert.ok(output.path.includes('workstreams/my-feature'));
    assert.strictEqual(output.active, true);

    // Verify directory structure on disk
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'my-feature');
    assert.ok(fs.existsSync(wsDir), 'workstream dir should exist');
    assert.ok(fs.existsSync(path.join(wsDir, 'STATE.md')), 'STATE.md should exist');
    assert.ok(fs.existsSync(path.join(wsDir, 'phases')), 'phases/ should exist');
  });

  test('slugifies workstream name', () => {
    const result = runGsdTools('workstream create "My Feature Branch!"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.workstream, 'my-feature-branch');
  });

  test('reports already_exists for duplicate workstream', () => {
    runGsdTools('workstream create alpha', tmpDir);
    const result = runGsdTools('workstream create alpha', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, false);
    assert.strictEqual(output.error, 'already_exists');
  });

  test('auto-sets created workstream as active', () => {
    runGsdTools('workstream create feature-a', tmpDir);

    const result = runGsdTools('workstream get', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, 'feature-a');
  });

  test('migrates flat mode files on first workstream create', () => {
    // Set up flat mode with existing work
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Status:** In progress\n'
    );

    const result = runGsdTools('workstream create new-work', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.ok(output.migration, 'should have migration info');
    assert.strictEqual(output.migration.migrated, true);
    assert.ok(output.migration.files_moved.length > 0, 'should have moved files');

    // Original flat files should be gone
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'ROADMAP.md')),
      'flat ROADMAP.md should be moved');
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'STATE.md')),
      'flat STATE.md should be moved');

    // Migrated workstream should have them
    const migratedWs = output.migration.workstream;
    const migratedDir = path.join(tmpDir, '.planning', 'workstreams', migratedWs);
    assert.ok(fs.existsSync(path.join(migratedDir, 'ROADMAP.md')),
      'migrated workstream should have ROADMAP.md');
  });

  test('errors without name', () => {
    const result = runGsdTools('workstream create', tmpDir);
    assert.strictEqual(result.success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workstream List
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream list', () => {
  let tmpDir;

  beforeEach(() => {
    // Create minimal .planning/ without phases/ to avoid migration on first create
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports flat mode when no workstreams exist', () => {
    const result = runGsdTools('workstream list', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.mode, 'flat');
    assert.strictEqual(output.workstreams.length, 0);
  });

  test('lists created workstreams', () => {
    runGsdTools('workstream create alpha', tmpDir);
    runGsdTools('workstream create beta', tmpDir);

    const result = runGsdTools('workstream list', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.mode, 'workstream');
    assert.strictEqual(output.count, 2);

    const names = output.workstreams.map(w => w.name).sort();
    assert.deepStrictEqual(names, ['alpha', 'beta']);
  });

  test('includes phase and status info per workstream', () => {
    runGsdTools('workstream create alpha', tmpDir);

    // Add a phase dir with a plan
    const phaseDir = path.join(tmpDir, '.planning', 'workstreams', 'alpha', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('workstream list', tmpDir);
    const output = JSON.parse(result.output);

    const alpha = output.workstreams.find(w => w.name === 'alpha');
    assert.ok(alpha, 'alpha should be listed');
    assert.strictEqual(alpha.phase_count, 1);
    assert.ok(alpha.has_state, 'should have STATE.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workstream Status
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream status', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    runGsdTools('workstream create alpha', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns detailed status for existing workstream', () => {
    const result = runGsdTools('workstream status alpha', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true);
    assert.strictEqual(output.workstream, 'alpha');
    assert.ok(output.files);
    assert.strictEqual(output.files.state, true);
  });

  test('reports not_found for nonexistent workstream', () => {
    const result = runGsdTools('workstream status nonexistent', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false);
  });

  test('counts phases correctly', () => {
    const wsPhases = path.join(tmpDir, '.planning', 'workstreams', 'alpha', 'phases');

    // Add completed phase (has plan + summary)
    const p1 = path.join(wsPhases, '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    // Add in-progress phase (has plan, no summary)
    const p2 = path.join(wsPhases, '02-api');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('workstream status alpha', tmpDir);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_count, 2);
    assert.strictEqual(output.completed_phases, 1);

    const phases = output.phases;
    assert.strictEqual(phases[0].status, 'complete');
    assert.strictEqual(phases[1].status, 'in_progress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workstream Set / Get (Active Workstream)
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream set/get', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    runGsdTools('workstream create alpha', tmpDir);
    runGsdTools('workstream create beta', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('sets active workstream', () => {
    runGsdTools('workstream set alpha', tmpDir);

    const result = runGsdTools('workstream get', tmpDir);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, 'alpha');
    assert.strictEqual(output.mode, 'workstream');
  });

  test('switches between workstreams', () => {
    runGsdTools('workstream set alpha', tmpDir);
    runGsdTools('workstream set beta', tmpDir);

    const result = runGsdTools('workstream get', tmpDir);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, 'beta');
  });

  test('clears active workstream when no name given', () => {
    runGsdTools('workstream set alpha', tmpDir);
    runGsdTools('workstream set', tmpDir);

    const result = runGsdTools('workstream get', tmpDir);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, null);
  });

  test('reports not_found for nonexistent workstream', () => {
    const result = runGsdTools('workstream set nonexistent', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'not_found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workstream Complete (Archive)
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream complete', () => {
  let tmpDir;

  beforeEach(() => {
    // Create minimal .planning/ without phases/ to avoid migration
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    runGsdTools('workstream create alpha', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('archives workstream to milestones/', () => {
    const result = runGsdTools('workstream complete alpha', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true);
    assert.strictEqual(output.workstream, 'alpha');
    assert.ok(output.archived_to.includes('milestones/'));

    // Workstream dir should be gone
    assert.ok(!fs.existsSync(
      path.join(tmpDir, '.planning', 'workstreams', 'alpha')
    ), 'workstream dir should be removed');

    // Archive should exist
    const archivePath = path.join(tmpDir, output.archived_to);
    assert.ok(fs.existsSync(archivePath), 'archive should exist');
    assert.ok(fs.existsSync(path.join(archivePath, 'STATE.md')),
      'archived STATE.md should exist');
  });

  test('clears active workstream when completing the active one', () => {
    runGsdTools('workstream set alpha', tmpDir);
    runGsdTools('workstream complete alpha', tmpDir);

    const result = runGsdTools('workstream get', tmpDir);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, null);
  });

  test('reverts to flat mode when last workstream is completed', () => {
    const result = runGsdTools('workstream complete alpha', tmpDir);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.reverted_to_flat, true);
    assert.strictEqual(output.remaining_workstreams, 0);

    // workstreams/ dir should be gone
    assert.ok(!fs.existsSync(
      path.join(tmpDir, '.planning', 'workstreams')
    ), 'workstreams dir should be removed');
  });

  test('keeps workstreams/ when other workstreams remain', () => {
    runGsdTools('workstream create beta', tmpDir);
    const result = runGsdTools('workstream complete alpha', tmpDir);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.reverted_to_flat, false);
    assert.strictEqual(output.remaining_workstreams, 1);

    // beta should still exist
    assert.ok(fs.existsSync(
      path.join(tmpDir, '.planning', 'workstreams', 'beta')
    ));
  });

  test('reports not_found for nonexistent workstream', () => {
    const result = runGsdTools('workstream complete nonexistent', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, false);
    assert.strictEqual(output.error, 'not_found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workstream Progress
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream progress', () => {
  let tmpDir;

  beforeEach(() => {
    // Create minimal .planning/ without phases/ to avoid migration
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports flat mode when no workstreams', () => {
    const result = runGsdTools('workstream progress', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.mode, 'flat');
  });

  test('reports progress across workstreams', () => {
    runGsdTools('workstream create alpha', tmpDir);
    runGsdTools('workstream create beta', tmpDir);
    runGsdTools('workstream set alpha', tmpDir);

    // Add completed phase to alpha
    const p1 = path.join(tmpDir, '.planning', 'workstreams', 'alpha', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('workstream progress', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.mode, 'workstream');
    assert.strictEqual(output.active, 'alpha');
    assert.strictEqual(output.count, 2);

    const alpha = output.workstreams.find(w => w.name === 'alpha');
    assert.ok(alpha.active, 'alpha should be marked active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Path Resolution with --ws flag
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream path resolution via --ws', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2)
    );
    // Create a workstream
    runGsdTools('workstream create feature-x', tmpDir);
    // Add roadmap to workstream
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'feature-x', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Init\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init returns workstream-scoped paths with --ws', () => {
    const result = runGsdTools('init progress --ws feature-x', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_path.includes('workstreams/feature-x'),
      `state_path should be scoped: ${output.state_path}`);
    assert.ok(output.roadmap_path.includes('workstreams/feature-x'),
      `roadmap_path should be scoped: ${output.roadmap_path}`);
  });

  test('init returns flat paths without --ws in flat mode', () => {
    // Create a fresh project without workstreams
    const flatDir = createTempProject();
    fs.writeFileSync(
      path.join(flatDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    fs.writeFileSync(
      path.join(flatDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2)
    );

    try {
      const result = runGsdTools('init progress', flatDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.ok(!output.state_path.includes('workstreams'),
        `state_path should be flat: ${output.state_path}`);
    } finally {
      cleanup(flatDir);
    }
  });

  test('init auto-detects active workstream when --ws not specified', () => {
    // feature-x was auto-set as active on creation
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_path.includes('workstreams/feature-x'),
      `should auto-detect active workstream: ${output.state_path}`);
  });

  test('workstream field in init output reflects active workstream', () => {
    const result = runGsdTools('init progress --ws feature-x', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.workstream, 'feature-x');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-workstream Isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('multi-workstream isolation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2)
    );
    runGsdTools('workstream create ws-a', tmpDir);
    runGsdTools('workstream create ws-b', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('workstreams have isolated phases directories', () => {
    const phasesA = path.join(tmpDir, '.planning', 'workstreams', 'ws-a', 'phases');
    const phasesB = path.join(tmpDir, '.planning', 'workstreams', 'ws-b', 'phases');

    // Add phase only to ws-a
    const p1 = path.join(phasesA, '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan A');

    // ws-a should have 1 phase
    const statusA = JSON.parse(runGsdTools('workstream status ws-a', tmpDir).output);
    assert.strictEqual(statusA.phase_count, 1);

    // ws-b should have 0 phases
    const statusB = JSON.parse(runGsdTools('workstream status ws-b', tmpDir).output);
    assert.strictEqual(statusB.phase_count, 0);
  });

  test('workstreams have isolated STATE.md', () => {
    const stateA = path.join(tmpDir, '.planning', 'workstreams', 'ws-a', 'STATE.md');
    const stateB = path.join(tmpDir, '.planning', 'workstreams', 'ws-b', 'STATE.md');

    // Both should have independent STATE.md
    assert.ok(fs.existsSync(stateA));
    assert.ok(fs.existsSync(stateB));

    const contentA = fs.readFileSync(stateA, 'utf-8');
    const contentB = fs.readFileSync(stateB, 'utf-8');

    assert.ok(contentA.includes('ws-a'), 'STATE.md should reference ws-a');
    assert.ok(contentB.includes('ws-b'), 'STATE.md should reference ws-b');
  });

  test('shared files remain at .planning/ level', () => {
    // PROJECT.md and config.json should NOT be in workstream dirs
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md')),
      'PROJECT.md should be at .planning/ level');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'config.json')),
      'config.json should be at .planning/ level');

    assert.ok(!fs.existsSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-a', 'PROJECT.md')
    ), 'PROJECT.md should NOT be in workstream');
  });

  test('--ws flag routes to correct workstream state', () => {
    // Write different state to each workstream
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-a', 'STATE.md'),
      '# State\n\n**Current Phase:** 03\n**Status:** In progress\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-b', 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n**Status:** Ready to plan\n'
    );

    // Add roadmaps
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-a', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 3: API\n**Goal:** Build\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-b', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Init\n'
    );

    const resultA = runGsdTools('init progress --ws ws-a', tmpDir);
    const resultB = runGsdTools('init progress --ws ws-b', tmpDir);

    assert.ok(resultA.success);
    assert.ok(resultB.success);

    const outA = JSON.parse(resultA.output);
    const outB = JSON.parse(resultB.output);

    // Verify they return different workstream-scoped paths
    assert.ok(outA.state_path.includes('ws-a'), `ws-a state: ${outA.state_path}`);
    assert.ok(outB.state_path.includes('ws-b'), `ws-b state: ${outB.state_path}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase Complete with --ws (the original user scenario)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete does not bleed across workstreams', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2)
    );

    // Create two workstreams
    runGsdTools('workstream create feature-a', tmpDir);
    runGsdTools('workstream create feature-b', tmpDir);

    // Feature-A has phases 1-3
    const wsA = path.join(tmpDir, '.planning', 'workstreams', 'feature-a');
    fs.writeFileSync(path.join(wsA, 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '- [ ] Phase 1: Auth',
      '- [ ] Phase 2: Dashboard',
      '- [ ] Phase 3: Deploy',
      '',
      '### Phase 1: Auth',
      '**Goal:** Add auth',
      '**Plans:** 1 plans',
      '',
      '### Phase 2: Dashboard',
      '**Goal:** Build dashboard',
      '**Plans:** 1 plans',
      '',
      '### Phase 3: Deploy',
      '**Goal:** Deploy',
      '**Plans:** 1 plans',
    ].join('\n'));
    fs.writeFileSync(path.join(wsA, 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );
    for (let i = 1; i <= 3; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(wsA, 'phases', `${padded}-phase-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
      if (i === 1) {
        fs.writeFileSync(path.join(phaseDir, `${padded}-01-SUMMARY.md`), '# Summary');
      }
    }

    // Feature-B has phases 4-6
    const wsB = path.join(tmpDir, '.planning', 'workstreams', 'feature-b');
    fs.writeFileSync(path.join(wsB, 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '### Phase 4: API',
      '**Goal:** Build API',
      '**Plans:** 1 plans',
      '',
      '### Phase 5: Integration',
      '**Goal:** Integrate',
      '**Plans:** 1 plans',
      '',
      '### Phase 6: Polish',
      '**Goal:** Polish',
      '**Plans:** 1 plans',
    ].join('\n'));
    fs.writeFileSync(path.join(wsB, 'STATE.md'),
      '# State\n\n**Current Phase:** 04\n**Current Phase Name:** API\n**Status:** In progress\n**Current Plan:** 04-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );
    for (let i = 4; i <= 6; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(wsB, 'phases', `${padded}-phase-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
    }
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phase complete --ws feature-a transitions to next phase within feature-a only', () => {
    const result = runGsdTools('phase complete 1 --ws feature-a', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1');
    assert.strictEqual(output.next_phase, '02');
    assert.strictEqual(output.is_last_phase, false);

    // Next phase should be 02 (feature-a's phase 2), NOT 04 (feature-b)
    assert.ok(output.next_phase !== '04',
      'should NOT jump to feature-b phases');
  });

  test('phase complete --ws feature-a detects last phase within its own roadmap', () => {
    // Complete phases 1 and 2 first (add summaries)
    const wsA = path.join(tmpDir, '.planning', 'workstreams', 'feature-a');
    for (let i = 1; i <= 3; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(wsA, 'phases', `${padded}-phase-${i}`);
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-SUMMARY.md`), '# Summary');
    }

    // Update state to phase 3
    fs.writeFileSync(path.join(wsA, 'STATE.md'),
      '# State\n\n**Current Phase:** 03\n**Current Phase Name:** Deploy\n**Status:** In progress\n**Current Plan:** 03-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );

    const result = runGsdTools('phase complete 3 --ws feature-a', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '3');
    assert.strictEqual(output.is_last_phase, true,
      'should be last phase in feature-a (phase 3 is last in its roadmap)');
    assert.strictEqual(output.next_phase, null,
      'no next phase — should NOT bleed into feature-b phases 4-6');
  });

  test('completing a phase in one workstream does not affect the other', () => {
    const result = runGsdTools('phase complete 1 --ws feature-a', tmpDir);
    assert.ok(result.success);

    // Feature-B state should be untouched
    const wsB = path.join(tmpDir, '.planning', 'workstreams', 'feature-b');
    const stateB = fs.readFileSync(path.join(wsB, 'STATE.md'), 'utf-8');
    assert.ok(stateB.includes('**Current Phase:** 04'),
      'feature-b state should be unchanged');
    assert.ok(stateB.includes('**Status:** In progress'),
      'feature-b status should be unchanged');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Active Workstream Race Condition Awareness
// ─────────────────────────────────────────────────────────────────────────────

describe('active-workstream file behavior', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('last workstream created overwrites active-workstream', () => {
    runGsdTools('workstream create alpha', tmpDir);
    runGsdTools('workstream create beta', tmpDir);

    // Beta was created last, so it should be active
    const result = runGsdTools('workstream get', tmpDir);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.active, 'beta',
      'last created workstream should be active');
  });

  test('explicit --ws overrides active-workstream auto-detection', () => {
    runGsdTools('workstream create alpha', tmpDir);
    runGsdTools('workstream create beta', tmpDir);

    // beta is active, but --ws alpha should override
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'alpha', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Init\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2)
    );

    const result = runGsdTools('init progress --ws alpha', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.ok(output.state_path.includes('workstreams/alpha'),
      `explicit --ws should route to alpha, got: ${output.state_path}`);
    assert.strictEqual(output.workstream, 'alpha');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GSD_WORKSTREAM Environment Variable (instance-scoped workstream)
// ─────────────────────────────────────────────────────────────────────────────

describe('GSD_WORKSTREAM env var for concurrent instances', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2)
    );
    runGsdTools('workstream create ws-one', tmpDir);
    runGsdTools('workstream create ws-two', tmpDir);

    // Add roadmaps so init progress can parse them
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-one', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Init\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'workstreams', 'ws-two', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Init\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('GSD_WORKSTREAM env var routes to specified workstream', () => {
    const result = runGsdToolsWithEnv(
      'init progress',
      tmpDir,
      { GSD_WORKSTREAM: 'ws-one' }
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_path.includes('workstreams/ws-one'),
      `env var should route to ws-one, got: ${output.state_path}`);
    assert.strictEqual(output.workstream, 'ws-one');
  });

  test('GSD_WORKSTREAM overrides active-workstream file', () => {
    // ws-two is active (last created), but env var says ws-one
    const getResult = runGsdTools('workstream get', tmpDir);
    assert.strictEqual(JSON.parse(getResult.output).active, 'ws-two');

    const result = runGsdToolsWithEnv(
      'init progress',
      tmpDir,
      { GSD_WORKSTREAM: 'ws-one' }
    );
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.ok(output.state_path.includes('workstreams/ws-one'),
      `env var should override active-workstream file`);
  });

  test('explicit --ws flag overrides GSD_WORKSTREAM env var', () => {
    const result = runGsdToolsWithEnv(
      'init progress --ws ws-two',
      tmpDir,
      { GSD_WORKSTREAM: 'ws-one' }
    );
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.ok(output.state_path.includes('workstreams/ws-two'),
      `--ws flag should override env var, got: ${output.state_path}`);
    assert.strictEqual(output.workstream, 'ws-two');
  });

  test('two simulated instances use different workstreams via env var', () => {
    // Simulate Instance A with GSD_WORKSTREAM=ws-one
    const resultA = runGsdToolsWithEnv(
      'init progress',
      tmpDir,
      { GSD_WORKSTREAM: 'ws-one' }
    );

    // Simulate Instance B with GSD_WORKSTREAM=ws-two
    const resultB = runGsdToolsWithEnv(
      'init progress',
      tmpDir,
      { GSD_WORKSTREAM: 'ws-two' }
    );

    assert.ok(resultA.success);
    assert.ok(resultB.success);

    const outA = JSON.parse(resultA.output);
    const outB = JSON.parse(resultB.output);

    assert.ok(outA.state_path.includes('ws-one'), `Instance A: ${outA.state_path}`);
    assert.ok(outB.state_path.includes('ws-two'), `Instance B: ${outB.state_path}`);
    assert.strictEqual(outA.workstream, 'ws-one');
    assert.strictEqual(outB.workstream, 'ws-two');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration
// ─────────────────────────────────────────────────────────────────────────────

describe('workstream migration', () => {
  let tmpDir;

  beforeEach(() => {
    // Create minimal .planning/ without phases/ to control migration behavior per-test
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\nTest project.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('migrates ROADMAP.md, STATE.md, REQUIREMENTS.md, and phases/', () => {
    // Set up flat mode with all scoped files
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Reqs');
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('workstream create new-stream', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.ok(output.migration);
    assert.ok(output.migration.files_moved.includes('ROADMAP.md'));
    assert.ok(output.migration.files_moved.includes('STATE.md'));
    assert.ok(output.migration.files_moved.includes('REQUIREMENTS.md'));
    assert.ok(output.migration.files_moved.includes('phases'));

    // Verify migrated files exist in workstream dir
    const migratedDir = path.join(tmpDir, '.planning', 'workstreams', output.migration.workstream);
    assert.ok(fs.existsSync(path.join(migratedDir, 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(migratedDir, 'phases', '01-setup', '01-01-PLAN.md')));
  });

  test('preserves shared files during migration', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' })
    );

    runGsdTools('workstream create new-stream', tmpDir);

    // Shared files should remain at .planning/
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md')),
      'PROJECT.md should stay');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'config.json')),
      'config.json should stay');
  });

  test('skips migration when no existing work in flat mode', () => {
    // Only PROJECT.md exists (no scoped files)
    const result = runGsdTools('workstream create first-ws', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.migration, null, 'no migration when no existing scoped files');
  });
});
