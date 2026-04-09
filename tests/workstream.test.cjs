/**
 * Workstream Tests — CRUD, env-var routing, collision detection
 */

const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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

function createFailingTtyEnv(tmpDir) {
  const binDir = path.join(tmpDir, 'fake-bin');
  const markerFile = path.join(tmpDir, 'tty-invoked.log');
  const inheritedPath = process.env.PATH || process.env.Path || '';

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    path.join(binDir, 'tty'),
    '#!/bin/sh\nif [ -n "$GSD_TTY_MARKER" ]; then printf "tty\\n" >> "$GSD_TTY_MARKER"; fi\nexit 99\n',
    'utf-8'
  );
  fs.chmodSync(path.join(binDir, 'tty'), 0o755);
  fs.writeFileSync(
    path.join(binDir, 'tty.cmd'),
    '@echo off\r\nif not "%GSD_TTY_MARKER%"=="" echo tty>>"%GSD_TTY_MARKER%"\r\nexit /b 99\r\n',
    'utf-8'
  );

  return {
    markerFile,
    env: {
      PATH: `${binDir}${path.delimiter}${inheritedPath}`,
      GSD_TTY_MARKER: markerFile,
    },
  };
}

function getSessionPointerDir(tmpDir) {
  const planningPath = fs.realpathSync.native(path.join(tmpDir, '.planning'));
  const projectId = crypto
    .createHash('sha1')
    .update(planningPath)
    .digest('hex')
    .slice(0, 16);
  return path.join(os.tmpdir(), 'gsd-workstream-sessions', projectId);
}

function sanitizeSessionToken(value) {
  const token = String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return token ? token.slice(0, 160) : null;
}

function getSessionPointerFileName(envKey, value) {
  const token = sanitizeSessionToken(value);
  return `${envKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${token}`;
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

describe('session-scoped active workstream routing', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();

    for (const [ws, status] of [['alpha', 'Alpha active'], ['beta', 'Beta active']]) {
      const wsDir = path.join(tmpDir, '.planning', 'workstreams', ws);
      fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'STATE.md'), `# State\n**Status:** ${status}\n`);
    }
  });

  after(() => cleanup(tmpDir));

  test('stores active workstream per session instead of mutating shared pointer', () => {
    const alphaSet = runGsdTools(['workstream', 'set', 'alpha', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const betaSet = runGsdTools(['workstream', 'set', 'beta', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    assert.ok(alphaSet.success, `alpha set failed: ${alphaSet.error}`);
    assert.ok(betaSet.success, `beta set failed: ${betaSet.error}`);
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'active-workstream')),
      'shared active-workstream file should not be used when session keys are available');
  });

  test('different sessions resolve different active workstreams without --ws', () => {
    const alpha = runGsdTools(['workstream', 'get', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const beta = runGsdTools(['workstream', 'get', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    assert.ok(alpha.success, `alpha get failed: ${alpha.error}`);
    assert.ok(beta.success, `beta get failed: ${beta.error}`);
    assert.strictEqual(alpha.output, 'alpha');
    assert.strictEqual(beta.output, 'beta');
  });

  test('session-scoped pointer ignores legacy shared active-workstream file', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'beta\n');

    const alpha = runGsdTools(['workstream', 'get', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const shared = runGsdTools(['workstream', 'get', '--raw'], tmpDir);

    assert.ok(alpha.success, `session-scoped get failed: ${alpha.error}`);
    assert.ok(shared.success, `legacy get failed: ${shared.error}`);
    assert.strictEqual(alpha.output, 'alpha');
    assert.strictEqual(shared.output, 'beta');
  });

  test('state commands route to the session-scoped workstream automatically', () => {
    const alpha = runGsdTools(['state', 'json', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const beta = runGsdTools(['state', 'json', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    assert.ok(alpha.success, `alpha state failed: ${alpha.error}`);
    assert.ok(beta.success, `beta state failed: ${beta.error}`);
    const alphaState = JSON.parse(alpha.output);
    const betaState = JSON.parse(beta.output);
    assert.strictEqual(alphaState.status, 'Alpha active');
    assert.strictEqual(betaState.status, 'Beta active');
  });

  test('clearing one session does not clear another session pointer', () => {
    const clearAlpha = runGsdTools(['workstream', 'set', '--clear', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const alpha = runGsdTools(['workstream', 'get'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const beta = runGsdTools(['workstream', 'get', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    assert.ok(clearAlpha.success, `clear alpha failed: ${clearAlpha.error}`);
    assert.ok(alpha.success, `alpha get after clear failed: ${alpha.error}`);
    assert.ok(beta.success, `beta get after alpha clear failed: ${beta.error}`);

    const cleared = JSON.parse(alpha.output);
    assert.strictEqual(cleared.active, null);
    assert.strictEqual(beta.output, 'beta');
  });
});

describe('session resolution hardening', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();

    for (const [ws, status] of [['alpha', 'Alpha active'], ['beta', 'Beta active']]) {
      const wsDir = path.join(tmpDir, '.planning', 'workstreams', ws);
      fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'STATE.md'), `# State\n**Status:** ${status}\n`);
    }
  });

  afterEach(() => cleanup(tmpDir));

  test('headless runs skip tty probing and use the shared active-workstream fallback', () => {
    const { markerFile, env } = createFailingTtyEnv(tmpDir);
    const set = runGsdTools(['workstream', 'set', 'alpha', '--raw'], tmpDir, env);
    const get = runGsdTools(['workstream', 'get', '--raw'], tmpDir, env);

    assert.ok(set.success, `headless set failed: ${set.error}`);
    assert.ok(get.success, `headless get failed: ${get.error}`);
    assert.ok(!fs.existsSync(markerFile), 'headless fallback should not invoke the tty subprocess');
    assert.strictEqual(get.output, 'alpha');
    assert.strictEqual(
      fs.readFileSync(path.join(tmpDir, '.planning', 'active-workstream'), 'utf-8').trim(),
      'alpha'
    );
    assert.ok(!fs.existsSync(getSessionPointerDir(tmpDir)), 'headless fallback should not create session tmp pointers');
  });

  test('explicit runtime session ids outrank tty-derived identities', () => {
    const set = runGsdTools(['workstream', 'set', 'alpha', '--raw'], tmpDir, {
      GSD_SESSION_KEY: 'shared-session',
      TTY: '/dev/pts/42',
    });
    const get = runGsdTools(['workstream', 'get', '--raw'], tmpDir, {
      GSD_SESSION_KEY: 'shared-session',
      TTY: '/dev/pts/99',
    });

    assert.ok(set.success, `session-key set failed: ${set.error}`);
    assert.ok(get.success, `session-key get failed: ${get.error}`);
    assert.strictEqual(get.output, 'alpha');
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'active-workstream')));
  });

  test('TTY environment variables provide a session-scoped pointer without spawning tty', () => {
    const { markerFile, env } = createFailingTtyEnv(tmpDir);
    const ttyEnv = { ...env, TTY: '/dev/pts/42' };
    const set = runGsdTools(['workstream', 'set', 'beta', '--raw'], tmpDir, ttyEnv);
    const get = runGsdTools(['workstream', 'get', '--raw'], tmpDir, ttyEnv);

    assert.ok(set.success, `TTY set failed: ${set.error}`);
    assert.ok(get.success, `TTY get failed: ${get.error}`);
    assert.ok(!fs.existsSync(markerFile), 'TTY env should be used directly without invoking the tty subprocess');
    assert.strictEqual(get.output, 'beta');
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'active-workstream')));
  });
});

describe('pointer lifecycle hardening', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();

    for (const [ws, status] of [['alpha', 'Alpha active'], ['beta', 'Beta active']]) {
      const wsDir = path.join(tmpDir, '.planning', 'workstreams', ws);
      fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'STATE.md'), `# State\n**Status:** ${status}\n`);
    }
  });

  afterEach(() => cleanup(tmpDir));

  test('clearing one session pointer leaves sibling session pointers intact', () => {
    const sessionDir = getSessionPointerDir(tmpDir);
    const alphaFile = getSessionPointerFileName('GSD_SESSION_KEY', 'session-alpha');
    const betaFile = getSessionPointerFileName('GSD_SESSION_KEY', 'session-beta');

    runGsdTools(['workstream', 'set', 'alpha', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    runGsdTools(['workstream', 'set', 'beta', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    const clearAlpha = runGsdTools(['workstream', 'set', '--clear', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const beta = runGsdTools(['workstream', 'get', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    assert.ok(clearAlpha.success, `clear alpha failed: ${clearAlpha.error}`);
    assert.ok(beta.success, `beta get failed: ${beta.error}`);
    assert.strictEqual(beta.output, 'beta');
    assert.ok(fs.existsSync(sessionDir), 'session tmp directory should remain while a sibling pointer exists');
    assert.deepStrictEqual(fs.readdirSync(sessionDir).sort(), [betaFile]);
    assert.ok(!fs.existsSync(path.join(sessionDir, alphaFile)));
  });

  test('stale pointers self-clean without deleting sibling session pointers', () => {
    const sessionDir = getSessionPointerDir(tmpDir);
    const betaFile = getSessionPointerFileName('GSD_SESSION_KEY', 'session-beta');

    runGsdTools(['workstream', 'set', 'alpha', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    runGsdTools(['workstream', 'set', 'beta', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });
    fs.rmSync(path.join(tmpDir, '.planning', 'workstreams', 'alpha'), { recursive: true, force: true });

    const alpha = runGsdTools(['workstream', 'get'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });
    const beta = runGsdTools(['workstream', 'get', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-beta' });

    assert.ok(alpha.success, `stale alpha get failed: ${alpha.error}`);
    assert.ok(beta.success, `beta get after stale cleanup failed: ${beta.error}`);
    assert.strictEqual(JSON.parse(alpha.output).active, null);
    assert.strictEqual(beta.output, 'beta');
    assert.ok(fs.existsSync(sessionDir), 'sibling pointer should keep the session tmp directory alive');
    assert.deepStrictEqual(fs.readdirSync(sessionDir).sort(), [betaFile]);
  });

  test('clearing the last session pointer removes the empty session tmp directory', () => {
    const sessionDir = getSessionPointerDir(tmpDir);
    const set = runGsdTools(['workstream', 'set', 'alpha', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });

    assert.ok(set.success, `set alpha failed: ${set.error}`);
    assert.ok(fs.existsSync(sessionDir), 'session tmp directory should exist after storing a session-scoped pointer');

    const clear = runGsdTools(['workstream', 'set', '--clear', '--raw'], tmpDir, { GSD_SESSION_KEY: 'session-alpha' });

    assert.ok(clear.success, `clear alpha failed: ${clear.error}`);
    assert.ok(!fs.existsSync(sessionDir), 'last-pointer cleanup should remove the empty session tmp directory');
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

  test('errors when set called with no name (#1527)', () => {
    const result = runGsdTools(['workstream', 'set', '--raw'], tmpDir);
    assert.ok(!result.success, 'should fail when no name provided');
    assert.ok(result.error.includes('name required'), 'error should mention name required');
  });

  test('--clear explicitly unsets active workstream', () => {
    // First set one
    runGsdTools(['workstream', 'set', 'ws-b', '--raw'], tmpDir);
    // Then clear
    const result = runGsdTools(['workstream', 'set', '--clear', '--raw'], tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.active, null);
    assert.strictEqual(data.cleared, true);
    assert.strictEqual(data.previous, 'ws-b');
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
