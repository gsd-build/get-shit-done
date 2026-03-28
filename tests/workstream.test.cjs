/**
 * Workstream Tests — CRUD, env-var routing, collision detection
 */

const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Helper ──────────────────────────────────────────────────────────────────

function createProjectWithState(tmpDir, roadmap, state) {
  if (roadmap) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap, 'utf-8');
  }
  if (state) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), state, 'utf-8');
  }
}

// ─── planningDir / planningPaths env-var awareness ──────────────────────────

describe('planningDir workstream awareness via env var', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Create workstream structure
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'alpha');
    fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n**Status:** In progress\n**Current Phase:** 1\n');
    fs.writeFileSync(path.join(wsDir, 'ROADMAP.md'), '## Roadmap v1.0: Alpha\n### Phase 1: Setup\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'alpha\n');
  });

  after(() => cleanup(tmpDir));

  test('state json returns workstream-scoped state when GSD_WORKSTREAM is set', () => {
    const result = runGsdTools(['state', 'json', '--raw'], tmpDir, { GSD_WORKSTREAM: 'alpha' });
    assert.ok(result.success, `state json failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.status || data.current_phase !== undefined, 'should return state data');
  });

  test('state json reads from flat .planning when no workstream set', () => {
    // Clear active-workstream so no auto-detection
    try { fs.unlinkSync(path.join(tmpDir, '.planning', 'active-workstream')); } catch {}
    const result = runGsdTools(['state', 'json', '--raw'], tmpDir, { GSD_WORKSTREAM: '' });
    // Should fail or return empty state since flat .planning/ has no STATE.md
    assert.ok(!result.success || result.output.includes('not found') || result.output === '{}',
      'should read from flat .planning/');
    // Restore
    fs.writeFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'alpha\n');
  });

  test('--ws flag overrides GSD_WORKSTREAM env var', () => {
    // Create a second workstream
    const betaDir = path.join(tmpDir, '.planning', 'workstreams', 'beta');
    fs.mkdirSync(path.join(betaDir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(betaDir, 'STATE.md'), '# State\n**Status:** Beta active\n');

    const result = runGsdTools(['state', 'json', '--raw', '--ws', 'beta'], tmpDir, { GSD_WORKSTREAM: 'alpha' });
    assert.ok(result.success, `state json --ws beta failed: ${result.error}`);
  });
});

// ─── Workstream CRUD ────────────────────────────────────────────────────────

describe('workstream create', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n');
  });

  after(() => cleanup(tmpDir));

  test('creates a new workstream in clean project', () => {
    const result = runGsdTools(['workstream', 'create', 'feature-x', '--raw'], tmpDir);
    assert.ok(result.success, `create failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.created, true);
    assert.strictEqual(data.workstream, 'feature-x');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'workstreams', 'feature-x', 'STATE.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'workstreams', 'feature-x', 'phases')));
  });

  test('sets created workstream as active', () => {
    const active = fs.readFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'utf-8').trim();
    assert.strictEqual(active, 'feature-x');
  });

  test('rejects duplicate workstream', () => {
    const result = runGsdTools(['workstream', 'create', 'feature-x', '--raw'], tmpDir);
    assert.ok(result.success); // returns success with error field
    const data = JSON.parse(result.output);
    assert.strictEqual(data.created, false);
    assert.strictEqual(data.error, 'already_exists');
  });

  test('creates second workstream', () => {
    const result = runGsdTools(['workstream', 'create', 'feature-y', '--raw'], tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.created, true);
    assert.strictEqual(data.workstream, 'feature-y');
  });
});

describe('workstream create with migration', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n');
    // Existing flat-mode work
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '## Roadmap v1.0: Existing\n### Phase 1: A\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n**Status:** In progress\n');
  });

  after(() => cleanup(tmpDir));

  test('migrates existing flat work to named workstream', () => {
    const result = runGsdTools(['workstream', 'create', 'new-feature', '--migrate-name', 'existing-work', '--raw'], tmpDir);
    assert.ok(result.success, `create with migration failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.created, true);
    assert.ok(data.migration, 'should include migration info');
    assert.strictEqual(data.migration.workstream, 'existing-work');
    // Old flat files moved to workstream dir
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'workstreams', 'existing-work', 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'workstreams', 'existing-work', 'STATE.md')));
    // Shared files stay
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md')));
  });
});

describe('workstream list', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Create two workstreams
    for (const ws of ['alpha', 'beta']) {
      const wsDir = path.join(tmpDir, '.planning', 'workstreams', ws);
      fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'STATE.md'), `# State\n**Status:** Working on ${ws}\n**Current Phase:** 1\n`);
    }
  });

  after(() => cleanup(tmpDir));

  test('lists all workstreams', () => {
    const result = runGsdTools(['workstream', 'list', '--raw'], tmpDir);
    assert.ok(result.success, `list failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.mode, 'workstream');
    assert.strictEqual(data.count, 2);
    const names = data.workstreams.map(w => w.name).sort();
    assert.deepStrictEqual(names, ['alpha', 'beta']);
  });

  describe('flat mode', () => {
    let flatDir;

    beforeEach(() => {
      flatDir = createTempProject();
    });

    afterEach(() => {
      cleanup(flatDir);
    });

    test('reports flat mode when no workstreams exist', () => {
      const result = runGsdTools(['workstream', 'list', '--raw'], flatDir);
      assert.ok(result.success);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'flat');
    });
  });
});

describe('workstream status', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'alpha');
    fs.mkdirSync(path.join(wsDir, 'phases', '01-setup'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'phases', '01-setup', 'PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n**Status:** In progress\n**Current Phase:** 1 — Setup\n');
    fs.writeFileSync(path.join(wsDir, 'ROADMAP.md'), '## Roadmap\n');
  });

  after(() => cleanup(tmpDir));

  test('returns detailed status for workstream', () => {
    const result = runGsdTools(['workstream', 'status', 'alpha', '--raw'], tmpDir);
    assert.ok(result.success, `status failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.found, true);
    assert.strictEqual(data.workstream, 'alpha');
    assert.strictEqual(data.files.roadmap, true);
    assert.strictEqual(data.files.state, true);
    assert.strictEqual(data.phase_count, 1);
  });

  test('returns not found for missing workstream', () => {
    const result = runGsdTools(['workstream', 'status', 'nonexistent', '--raw'], tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.found, false);
  });
});

describe('workstream complete', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'done-ws');
    fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n**Status:** Complete\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'done-ws\n');
  });

  after(() => cleanup(tmpDir));

  test('archives workstream to milestones/', () => {
    const result = runGsdTools(['workstream', 'complete', 'done-ws', '--raw'], tmpDir);
    assert.ok(result.success, `complete failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.completed, true);
    assert.ok(data.archived_to.startsWith('.planning/milestones/ws-done-ws'));
    // Workstream dir should be gone
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'workstreams', 'done-ws')));
  });

  test('clears active-workstream when completing active one', () => {
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'active-workstream')));
  });
});

describe('workstream set/get', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    for (const ws of ['ws-a', 'ws-b']) {
      const wsDir = path.join(tmpDir, '.planning', 'workstreams', ws);
      fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n');
    }
  });

  after(() => cleanup(tmpDir));

  test('sets active workstream', () => {
    const result = runGsdTools(['workstream', 'set', 'ws-a', '--raw'], tmpDir);
    assert.ok(result.success);
    assert.strictEqual(result.output, 'ws-a');
  });

  test('gets active workstream', () => {
    const result = runGsdTools(['workstream', 'get', '--raw'], tmpDir);
    assert.ok(result.success);
    assert.strictEqual(result.output, 'ws-a');
  });
});

// ─── Collision Detection ────────────────────────────────────────────────────

describe('getOtherActiveWorkstreams', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Create 3 workstreams: alpha (active), beta (active), gamma (completed)
    for (const ws of ['alpha', 'beta', 'gamma']) {
      const wsDir = path.join(tmpDir, '.planning', 'workstreams', ws);
      fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
    }
    fs.writeFileSync(path.join(tmpDir, '.planning', 'workstreams', 'alpha', 'STATE.md'),
      '# State\n**Status:** In progress\n**Current Phase:** 3\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'workstreams', 'beta', 'STATE.md'),
      '# State\n**Status:** In progress\n**Current Phase:** 5\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'workstreams', 'gamma', 'STATE.md'),
      '# State\n**Status:** Milestone complete\n');
  });

  after(() => cleanup(tmpDir));

  test('workstream list excludes completed workstreams from active count', () => {
    const result = runGsdTools(['workstream', 'list', '--raw'], tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.count, 3); // all listed
    const activeWs = data.workstreams.filter(w =>
      !w.status.toLowerCase().includes('milestone complete'));
    assert.strictEqual(activeWs.length, 2); // alpha and beta active
  });
});

describe('workstream progress', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'feature');
    fs.mkdirSync(path.join(wsDir, 'phases', '01-init'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'phases', '01-init', 'PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(wsDir, 'phases', '01-init', 'SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n**Status:** In progress\n**Current Phase:** 2\n');
    fs.writeFileSync(path.join(wsDir, 'ROADMAP.md'), '## Roadmap\n### Phase 1: Init\n### Phase 2: Build\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'feature\n');
  });

  after(() => cleanup(tmpDir));

  test('returns progress summary', () => {
    const result = runGsdTools(['workstream', 'progress', '--raw'], tmpDir);
    assert.ok(result.success, `progress failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.mode, 'workstream');
    assert.strictEqual(data.count, 1);
    assert.strictEqual(data.workstreams[0].name, 'feature');
    assert.strictEqual(data.workstreams[0].active, true);
    assert.strictEqual(data.workstreams[0].progress_percent, 50);
  });
});

// ─── Integration: gsd-tools --ws flag ────────────────────────────────────────

describe('gsd-tools --ws flag integration', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Create a workstream with roadmap
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'test-ws');
    fs.mkdirSync(path.join(wsDir, 'phases', '01-setup'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'ROADMAP.md'),
      '## Roadmap v1.0: Test\n### Phase 1: Setup\nDo setup things.\n');
    fs.writeFileSync(path.join(wsDir, 'STATE.md'),
      '---\nmilestone: v1.0\n---\n# State\n**Status:** In progress\n**Current Phase:** 1 — Setup\n');
    fs.writeFileSync(path.join(wsDir, 'phases', '01-setup', 'PLAN.md'), '# Plan\n');
  });

  after(() => cleanup(tmpDir));

  test('find-phase resolves to workstream-scoped phases via --ws', () => {
    const result = runGsdTools(['find-phase', '1', '--raw', '--ws', 'test-ws'], tmpDir);
    assert.ok(result.success, `find-phase failed: ${result.error}`);
    assert.ok(result.output.includes('workstreams/test-ws'), `path should be workstream-scoped: ${result.output}`);
  });

  test('find-phase returns JSON with workstream path when not raw', () => {
    const result = runGsdTools(['find-phase', '1', '--ws', 'test-ws'], tmpDir);
    assert.ok(result.success, `find-phase failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.found, 'phase should be found');
    assert.ok(data.directory.includes('workstreams/test-ws'), `path should be workstream-scoped: ${data.directory}`);
  });
});

// ─── Path Traversal Rejection ────────────────────────────────────────────────

describe('path traversal rejection', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n');
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'legit');
    fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n');
  });

  after(() => cleanup(tmpDir));

  const maliciousNames = [
    '../../etc',
    '../foo',
    'ws/../../../passwd',
    'a/b',
    'ws name with spaces',
    '..',
    '.',
    'ws..traversal',
  ];

  describe('--ws flag rejects traversal attempts', () => {
    for (const name of maliciousNames) {
      test(`rejects --ws=${name}`, () => {
        const result = runGsdTools(['workstream', 'list', '--raw', '--ws', name], tmpDir);
        assert.ok(!result.success, `should reject --ws=${name}`);
        assert.ok(result.error.includes('Invalid workstream name'), `error should mention invalid name for: ${name}`);
      });
    }
  });

  describe('GSD_WORKSTREAM env var rejects traversal attempts', () => {
    for (const name of maliciousNames) {
      test(`rejects GSD_WORKSTREAM=${name}`, () => {
        const result = runGsdTools(['workstream', 'list', '--raw'], tmpDir, { GSD_WORKSTREAM: name });
        assert.ok(!result.success, `should reject GSD_WORKSTREAM=${name}`);
        assert.ok(result.error.includes('Invalid workstream name'), `error should mention invalid name for: ${name}`);
      });
    }
  });

  describe('cmdWorkstreamSet rejects traversal attempts', () => {
    for (const name of maliciousNames) {
      test(`rejects set ${name}`, () => {
        const result = runGsdTools(['workstream', 'set', name, '--raw'], tmpDir);
        // cmdWorkstreamSet validates the positional arg and returns invalid_name error
        assert.ok(result.success, `command should exit cleanly for: ${name}`);
        const data = JSON.parse(result.output);
        assert.strictEqual(data.error, 'invalid_name', `should return invalid_name error for: ${name}`);
        assert.strictEqual(data.active, null, `active should be null for: ${name}`);
      });
    }
  });

  describe('getActiveWorkstream rejects poisoned active-workstream file', () => {
    for (const name of maliciousNames) {
      test(`rejects poisoned file containing ${name}`, () => {
        // Write malicious name directly to the active-workstream file
        fs.writeFileSync(path.join(tmpDir, '.planning', 'active-workstream'), name + '\n');
        const result = runGsdTools(['workstream', 'get'], tmpDir, { GSD_WORKSTREAM: '' });
        assert.ok(result.success, 'get should succeed');
        const data = JSON.parse(result.output);
        // getActiveWorkstream should return null for invalid names
        assert.strictEqual(data.active, null, `should return null for poisoned name: ${name}`);
      });
    }

    // Cleanup: remove poisoned file
    test('cleanup: remove active-workstream file', () => {
      try { fs.unlinkSync(path.join(tmpDir, '.planning', 'active-workstream')); } catch {}
    });
  });

  describe('setActiveWorkstream rejects invalid names directly', () => {
    const { setActiveWorkstream } = require('../get-shit-done/bin/lib/core.cjs');
    for (const name of maliciousNames) {
      test(`throws for ${name}`, () => {
        assert.throws(
          () => setActiveWorkstream(tmpDir, name),
          { message: /Invalid workstream name/ },
          `should throw for: ${name}`
        );
      });
    }
  });
});
