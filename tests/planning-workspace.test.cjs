const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createPlanningWorkspace,
  createMemoryPointerAdapter,
  planningDir,
  planningPaths,
  withPlanningLock,
  getActiveWorkstream,
  setActiveWorkstream,
} = require('../get-shit-done/bin/lib/planning-workspace.cjs');

const core = require('../get-shit-done/bin/lib/core.cjs');

describe('planning-workspace: planningDir/planningPaths parity', () => {
  const cwd = '/fake/repo';
  let savedProject;
  let savedWorkstream;

  beforeEach(() => {
    savedProject = process.env.GSD_PROJECT;
    savedWorkstream = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_PROJECT;
    delete process.env.GSD_WORKSTREAM;
  });

  afterEach(() => {
    if (savedProject !== undefined) process.env.GSD_PROJECT = savedProject;
    else delete process.env.GSD_PROJECT;
    if (savedWorkstream !== undefined) process.env.GSD_WORKSTREAM = savedWorkstream;
    else delete process.env.GSD_WORKSTREAM;
  });

  test('matches expected path resolution', () => {
    assert.strictEqual(planningDir(cwd, null, null), path.join(cwd, '.planning'));
    assert.strictEqual(planningDir(cwd, 'feature-x', null), path.join(cwd, '.planning', 'workstreams', 'feature-x'));
    assert.strictEqual(planningDir(cwd, 'feature-x', 'my-app'), path.join(cwd, '.planning', 'my-app', 'workstreams', 'feature-x'));

    const paths = planningPaths(cwd, 'feature-x');
    assert.strictEqual(paths.planning, path.join(cwd, '.planning', 'workstreams', 'feature-x'));
    assert.strictEqual(paths.state, path.join(cwd, '.planning', 'workstreams', 'feature-x', 'STATE.md'));
    assert.strictEqual(paths.config, path.join(cwd, '.planning', 'workstreams', 'feature-x', 'config.json'));
  });

  test('rejects traversal and path separators', () => {
    assert.throws(() => planningDir(cwd, null, '../../etc'), /invalid path characters/);
    assert.throws(() => planningDir(cwd, 'foo/bar', null), /invalid path characters/);
    assert.throws(() => planningDir(cwd, 'foo\\bar', null), /invalid path characters/);
  });
});

describe('planning-workspace: session adapter precedence', () => {
  let savedSession;

  beforeEach(() => {
    savedSession = process.env.GSD_SESSION_KEY;
  });

  afterEach(() => {
    if (savedSession !== undefined) process.env.GSD_SESSION_KEY = savedSession;
    else delete process.env.GSD_SESSION_KEY;
  });

  test('uses session adapter over shared adapter when session key exists', () => {
    process.env.GSD_SESSION_KEY = 'session-123';

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-planning-precedence-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'workstreams', 'session-ws'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.planning', 'workstreams', 'shared-ws'), { recursive: true });

      const session = createMemoryPointerAdapter('session-ws');
      const shared = createMemoryPointerAdapter('shared-ws');
      const workspace = createPlanningWorkspace(tmpDir, {
        activeWorkstreamAdapters: { session, shared },
      });

      assert.strictEqual(workspace.activeWorkstream.get(), 'session-ws');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('planning-workspace: self-heal behavior', () => {
  test('clears invalid pointer names and returns null', () => {
    const adapter = createMemoryPointerAdapter('bad/name');
    const workspace = createPlanningWorkspace('/fake/repo', {
      activeWorkstreamAdapter: adapter,
    });

    assert.strictEqual(workspace.activeWorkstream.get(), null);
    assert.strictEqual(adapter.read(), null);
  });

  test('clears stale pointers when workstream directory is gone', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-planning-workspace-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'workstreams'), { recursive: true });
      const adapter = createMemoryPointerAdapter('ghost');
      const workspace = createPlanningWorkspace(tmpDir, {
        activeWorkstreamAdapter: adapter,
      });

      assert.strictEqual(workspace.activeWorkstream.get(), null);
      assert.strictEqual(adapter.read(), null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('planning-workspace: lock seam', () => {
  test('exports withPlanningLock and acquires/release lock', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-planning-lock-'));
    try {
      const result = withPlanningLock(tmpDir, () => 'ok');
      assert.strictEqual(result, 'ok');
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', '.lock')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('core compatibility adapter: planning workspace functions', () => {
  let savedSession;

  beforeEach(() => {
    savedSession = process.env.GSD_SESSION_KEY;
    delete process.env.GSD_SESSION_KEY;
  });

  afterEach(() => {
    if (savedSession !== undefined) process.env.GSD_SESSION_KEY = savedSession;
    else delete process.env.GSD_SESSION_KEY;
  });

  test('core and planning-workspace expose matching behavior', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-compat-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'workstreams', 'alpha'), { recursive: true });

      core.setActiveWorkstream(tmpDir, 'alpha');
      assert.strictEqual(core.getActiveWorkstream(tmpDir), 'alpha');
      assert.strictEqual(getActiveWorkstream(tmpDir), 'alpha');

      assert.strictEqual(
        core.planningDir(tmpDir, 'feature-x', 'my-project'),
        planningDir(tmpDir, 'feature-x', 'my-project')
      );
      assert.deepStrictEqual(
        core.planningPaths(tmpDir, 'feature-x'),
        planningPaths(tmpDir, 'feature-x')
      );

      setActiveWorkstream(tmpDir, null);
      assert.strictEqual(core.getActiveWorkstream(tmpDir), null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
