'use strict';

/**
 * Tests for get-shit-done/bin/lib/graphify.cjs
 *
 * Covers: config gate on/off (TEST-03), graceful degradation (TEST-04),
 * subprocess helper (FOUND-04), presence detection (FOUND-02),
 * version checking (FOUND-03), and disabled response (FOUND-01).
 */

const { describe, test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { createTempProject, cleanup } = require('./helpers.cjs');

const {
  isGraphifyEnabled,
  disabledResponse,
  execGraphify,
  checkGraphifyInstalled,
  checkGraphifyVersion,
  // Phase 2
  graphifyQuery,
  graphifyStatus,
  graphifyDiff,
  safeReadJson,
  buildAdjacencyMap,
  seedAndExpand,
  applyBudget,
} = require('../get-shit-done/bin/lib/graphify.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function enableGraphify(planningDir) {
  const configPath = path.join(planningDir, 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  config.graphify = { enabled: true };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function writeGraphJson(planningDir, data) {
  const graphsDir = path.join(planningDir, 'graphs');
  fs.mkdirSync(graphsDir, { recursive: true });
  fs.writeFileSync(
    path.join(graphsDir, 'graph.json'),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

function writeSnapshotJson(planningDir, data) {
  const graphsDir = path.join(planningDir, 'graphs');
  fs.mkdirSync(graphsDir, { recursive: true });
  fs.writeFileSync(
    path.join(graphsDir, '.last-build-snapshot.json'),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

const SAMPLE_GRAPH = {
  nodes: [
    { id: 'n1', label: 'AuthService', description: 'Handles user authentication and token validation', type: 'service' },
    { id: 'n2', label: 'UserModel', description: 'User database model for storing credentials', type: 'model' },
    { id: 'n3', label: 'SessionManager', description: 'Manages active user sessions', type: 'service' },
    { id: 'n4', label: 'EmailService', description: 'Sends notification emails', type: 'service' },
    { id: 'n5', label: 'Logger', description: 'Centralized logging utility', type: 'utility' },
  ],
  edges: [
    { source: 'n1', target: 'n2', label: 'reads_from', confidence: 'EXTRACTED' },
    { source: 'n1', target: 'n3', label: 'creates', confidence: 'INFERRED' },
    { source: 'n2', target: 'n3', label: 'triggers', confidence: 'AMBIGUOUS' },
    { source: 'n3', target: 'n4', label: 'notifies', confidence: 'INFERRED' },
    { source: 'n4', target: 'n5', label: 'logs_via', confidence: 'EXTRACTED' },
  ],
  hyperedges: [],
};

// ─── isGraphifyEnabled (TEST-03, FOUND-01) ──────────────────────────────────

describe('isGraphifyEnabled', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns false when no config.json exists', () => {
    // Remove config.json if createTempProject wrote one
    const configPath = path.join(planningDir, 'config.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    assert.strictEqual(isGraphifyEnabled(planningDir), false);
  });

  test('returns false when graphify key is not set', () => {
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
      'utf8'
    );
    assert.strictEqual(isGraphifyEnabled(planningDir), false);
  });

  test('returns false when graphify.enabled is false', () => {
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ graphify: { enabled: false } }),
      'utf8'
    );
    assert.strictEqual(isGraphifyEnabled(planningDir), false);
  });

  test('returns true when graphify.enabled is true', () => {
    enableGraphify(planningDir);
    assert.strictEqual(isGraphifyEnabled(planningDir), true);
  });

  test('returns false when config.json is malformed', () => {
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      'not json',
      'utf8'
    );
    assert.strictEqual(isGraphifyEnabled(planningDir), false);
  });
});

// ─── disabledResponse (FOUND-01) ────────────────────────────────────────────

describe('disabledResponse', () => {
  test('returns disabled:true with enable instructions', () => {
    const result = disabledResponse();
    assert.strictEqual(result.disabled, true);
    assert.ok(result.message.includes('gsd-tools config-set graphify.enabled true'));
  });
});

// ─── execGraphify (FOUND-04) ────────────────────────────────────────────────

describe('execGraphify', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('returns structured output on success', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: '{"nodes": 42}',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = execGraphify('/tmp', ['build']);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '{"nodes": 42}');
    assert.strictEqual(result.stderr, '');
  });

  test('returns exitCode 127 when graphify not on PATH', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: null,
      stdout: '',
      stderr: '',
      error: { code: 'ENOENT' },
      signal: null,
    }));

    const result = execGraphify('/tmp', ['build']);
    assert.strictEqual(result.exitCode, 127);
    assert.ok(result.stderr.includes('not found'));
  });

  test('returns exitCode 124 on timeout', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: null,
      stdout: 'partial',
      stderr: '',
      error: undefined,
      signal: 'SIGTERM',
    }));

    const result = execGraphify('/tmp', ['build']);
    assert.strictEqual(result.exitCode, 124);
    assert.ok(result.stderr.includes('timed out'));
  });

  test('passes PYTHONUNBUFFERED=1 in env', () => {
    let captured;
    mock.method(childProcess, 'spawnSync', (_cmd, _args, opts) => {
      captured = opts;
      return { status: 0, stdout: '', stderr: '', error: undefined, signal: null };
    });

    execGraphify('/tmp', ['build']);
    assert.strictEqual(captured.env.PYTHONUNBUFFERED, '1');
  });

  test('uses 30000ms default timeout', () => {
    let captured;
    mock.method(childProcess, 'spawnSync', (_cmd, _args, opts) => {
      captured = opts;
      return { status: 0, stdout: '', stderr: '', error: undefined, signal: null };
    });

    execGraphify('/tmp', ['build']);
    assert.strictEqual(captured.timeout, 30000);
  });

  test('allows timeout override', () => {
    let captured;
    mock.method(childProcess, 'spawnSync', (_cmd, _args, opts) => {
      captured = opts;
      return { status: 0, stdout: '', stderr: '', error: undefined, signal: null };
    });

    execGraphify('/tmp', ['build'], { timeout: 60000 });
    assert.strictEqual(captured.timeout, 60000);
  });

  test('trims stdout and stderr whitespace', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: '  hello  \n',
      stderr: '  warn  \n',
      error: undefined,
      signal: null,
    }));

    const result = execGraphify('/tmp', ['build']);
    assert.strictEqual(result.stdout, 'hello');
    assert.strictEqual(result.stderr, 'warn');
  });
});

// ─── checkGraphifyInstalled (FOUND-02, TEST-04) ────────────────────────────

describe('checkGraphifyInstalled', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('returns installed:true when graphify is on PATH', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: 'Usage: graphify...',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = checkGraphifyInstalled();
    assert.strictEqual(result.installed, true);
  });

  test('returns installed:false with install instructions when not on PATH', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: null,
      stdout: '',
      stderr: '',
      error: { code: 'ENOENT' },
      signal: null,
    }));

    const result = checkGraphifyInstalled();
    assert.strictEqual(result.installed, false);
    assert.ok(result.message.includes('uv pip install graphifyy && graphify install'));
  });

  test('uses --help not --version for detection', () => {
    let capturedArgs;
    mock.method(childProcess, 'spawnSync', (_cmd, args) => {
      capturedArgs = args;
      return { status: 0, stdout: '', stderr: '', error: undefined, signal: null };
    });

    checkGraphifyInstalled();
    assert.deepStrictEqual(capturedArgs, ['--help']);
  });
});

// ─── checkGraphifyVersion (FOUND-03, TEST-04) ──────────────────────────────

describe('checkGraphifyVersion', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('returns compatible:true for version 0.4.0', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: '0.4.0\n',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = checkGraphifyVersion();
    assert.strictEqual(result.version, '0.4.0');
    assert.strictEqual(result.compatible, true);
    assert.strictEqual(result.warning, null);
  });

  test('returns compatible:true for version 0.9.5', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: '0.9.5\n',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = checkGraphifyVersion();
    assert.strictEqual(result.version, '0.9.5');
    assert.strictEqual(result.compatible, true);
  });

  test('returns compatible:false for version 0.3.0', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: '0.3.0\n',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = checkGraphifyVersion();
    assert.strictEqual(result.compatible, false);
    assert.ok(result.warning.includes('outside tested range'));
  });

  test('returns compatible:false for version 1.0.0', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: '1.0.0\n',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = checkGraphifyVersion();
    assert.strictEqual(result.compatible, false);
    assert.ok(result.warning.includes('outside tested range'));
  });

  test('handles python3 not found', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: null,
      stdout: '',
      stderr: '',
      error: { code: 'ENOENT' },
      signal: null,
    }));

    const result = checkGraphifyVersion();
    assert.strictEqual(result.version, null);
    assert.ok(result.warning.includes('Could not determine'));
  });

  test('handles unparseable version string', () => {
    mock.method(childProcess, 'spawnSync', () => ({
      status: 0,
      stdout: 'unknown\n',
      stderr: '',
      error: undefined,
      signal: null,
    }));

    const result = checkGraphifyVersion();
    assert.strictEqual(result.compatible, null);
    assert.ok(result.warning.includes('Could not parse'));
  });

  test('calls python3 with importlib.metadata', () => {
    let capturedCmd;
    let capturedArgs;
    mock.method(childProcess, 'spawnSync', (cmd, args) => {
      capturedCmd = cmd;
      capturedArgs = args;
      return { status: 0, stdout: '0.4.3\n', stderr: '', error: undefined, signal: null };
    });

    checkGraphifyVersion();
    assert.strictEqual(capturedCmd, 'python3');
    assert.ok(capturedArgs.some(arg => arg.includes('importlib.metadata')));
  });
});

// ─── safeReadJson (TEST-01) ────────────────────────────────────────────────

describe('safeReadJson', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });
});

// ─── buildAdjacencyMap (TEST-01) ───────────────────────────────────────────

describe('buildAdjacencyMap', () => {
});

// ─── seedAndExpand (TEST-01) ───────────────────────────────────────────────

describe('seedAndExpand', () => {
});

// ─── applyBudget (TEST-01) ─────────────────────────────────────────────────

describe('applyBudget', () => {
});

// ─── graphifyQuery (QUERY-01, QUERY-02, QUERY-03) ─────────────────────────

describe('graphifyQuery', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });
});

// ─── graphifyStatus (STAT-01, STAT-02) ────────────────────────────────────

describe('graphifyStatus', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });
});

// ─── graphifyDiff (DIFF-01, DIFF-02) ──────────────────────────────────────

describe('graphifyDiff', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });
});
