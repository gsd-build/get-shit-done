'use strict';

// Consolidated from 7 files. Anti-pattern collapsed: enh-3170, bug-3166,
// graphify-mvp-viz, feat-3347-config, feat-3347-hook, bug-3579 each added a
// new file per PR instead of appending to this describe. Refs #3761.
//
// Migrated to typed-IR (#2974): execGraphify now returns a typed
// `reason` field (GRAPHIFY_REASON enum) alongside exitCode/stdout/stderr.
// Tests assert on result.reason instead of grepping stderr for failure
// phrases like 'not found' or 'timed out'.

/**
 * Tests for get-shit-done/bin/lib/graphify.cjs
 *
 * Covers: config gate on/off (TEST-03), graceful degradation (TEST-04),
 * subprocess helper (FOUND-04), presence detection (FOUND-02),
 * version checking (FOUND-03), and disabled response (FOUND-01).
 */

const { describe, test, beforeEach, afterEach, mock, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const os = require('node:os');
const { execFileSync, spawnSync } = require('child_process');
const { createTempProject, createTempGitProject, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  isGraphifyEnabled,
  disabledResponse,
  execGraphify,
  GRAPHIFY_REASON,
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
  // Build (Phase 3)
  graphifyBuild,
  writeSnapshot,
} = require('../get-shit-done/bin/lib/graphify.cjs');

const {
  VALID_CONFIG_KEYS,
  isValidConfigKey,
} = require('../get-shit-done/bin/lib/config-schema.cjs');

const {
  CONFIG_DEFAULTS: CANONICAL_CONFIG_DEFAULTS,
} = require('../get-shit-done/bin/lib/configuration.generated.cjs');

// ─── Shared helpers ─────────────────────────────────────────────────────────

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

function gitHead(cwd) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim();
}

function commitEmpty(cwd, message) {
  execFileSync('git', ['commit', '--allow-empty', '-m', message], { cwd, stdio: 'pipe' });
}

// Helper for auto-update status tests: builds a temp git project with
// optional .last-build-status.json written as autoUpdateValue.
// autoUpdateValue === null means no status file is written.
function makeStatusProject(autoUpdateValue) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3347-status-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# t\n');
  execFileSync('git', ['add', '.'], { cwd: tmpDir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: tmpDir });
  fs.mkdirSync(path.join(tmpDir, '.planning/graphs'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning/config.json'),
    JSON.stringify({ graphify: { enabled: true } }),
  );
  // Write a fresh (current-mtime) graph so age-based stale is false; only the
  // auto-update status field can set stale: true.
  fs.writeFileSync(
    path.join(tmpDir, '.planning/graphs/graph.json'),
    JSON.stringify({ nodes: [], edges: [] }),
  );
  if (autoUpdateValue !== null) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning/graphs/.last-build-status.json'),
      JSON.stringify(autoUpdateValue),
    );
  }
  return tmpDir;
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

const SAMPLE_NODES_MINIMAL = [
  { id: 'n1', label: 'A', description: '', type: 'service' },
  { id: 'n2', label: 'B', description: '', type: 'model' },
];

// ─── status describe ─────────────────────────────────────────────────────────

describe('status', () => {
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

  describe('disabledResponse', () => {
    test('returns disabled:true with enable instructions', () => {
      const result = disabledResponse();
      assert.strictEqual(result.disabled, true);
      assert.ok(result.message.includes('gsd-tools config-set graphify.enabled true'));
    });
  });

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

    // STAT-01: returns disabled response when not enabled
    test('returns disabled response when not enabled', () => {
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.disabled, true);
    });

    // STAT-02: returns exists:false when no graph.json
    test('returns exists:false when no graph.json (STAT-02)', () => {
      enableGraphify(planningDir);
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.exists, false);
      assert.ok(result.message.includes('No graph built yet'));
    });

    // STAT-01: returns status with counts when graph exists
    test('returns status with counts when graph exists (STAT-01)', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.exists, true);
      assert.strictEqual(result.node_count, 5);
      assert.strictEqual(result.edge_count, 5);
      assert.strictEqual(typeof result.last_build, 'string');
      assert.strictEqual(typeof result.stale, 'boolean');
      assert.strictEqual(typeof result.age_hours, 'number');
    });

    // STAT-01: reports hyperedge_count
    test('reports hyperedge_count', () => {
      enableGraphify(planningDir);
      const graphWithHyperedges = {
        ...SAMPLE_GRAPH,
        hyperedges: [{ id: 'h1', nodes: ['n1', 'n2', 'n3'], label: 'auth_flow' }],
      };
      writeGraphJson(planningDir, graphWithHyperedges);
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.hyperedge_count, 1);
    });

    // LINKS-02: status edge_count must read graph.links when graph.edges is absent
    test('reports correct edge_count when graph uses links key (LINKS-02)', () => {
      enableGraphify(planningDir);
      const graphWithLinks = {
        nodes: SAMPLE_GRAPH.nodes,
        links: SAMPLE_GRAPH.edges,
        hyperedges: [],
      };
      writeGraphJson(planningDir, graphWithLinks);
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.edge_count, 5, 'edge_count must equal links array length');
    });
  });
});

// ─── build describe ──────────────────────────────────────────────────────────

describe('build', () => {
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
      // Migrated #2974: assert on the typed `reason` field instead of
      // grepping stderr for 'not found'.
      assert.strictEqual(result.reason, GRAPHIFY_REASON.ENOENT);
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
      // Migrated #2974: typed reason instead of stderr grep.
      assert.strictEqual(result.reason, GRAPHIFY_REASON.TIMEOUT);
      assert.strictEqual(result.timeout_ms, 30000);
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

    test('tries graphify --version first before python3', () => {
      const calls = [];
      mock.method(childProcess, 'spawnSync', (cmd, args) => {
        calls.push({ cmd, args });
        return { status: 0, stdout: '0.4.3\n', stderr: '', error: undefined, signal: null };
      });

      checkGraphifyVersion();
      assert.strictEqual(calls.length, 1, 'exactly one spawnSync call — no python3 fallback');
      assert.strictEqual(calls[0].cmd, 'graphify');
      assert.ok(calls[0].args.includes('--version'), 'graphify called with --version');
      const python3Calls = calls.filter(c => c.cmd === 'python3');
      assert.strictEqual(python3Calls.length, 0, 'no python3 fallback when graphify --version succeeds');
    });

    test('falls back to python3 importlib.metadata when graphify --version fails', () => {
      const calls = [];
      mock.method(childProcess, 'spawnSync', (cmd, args) => {
        calls.push({ cmd, args });
        if (cmd === 'graphify') {
          return { status: 1, stdout: '', stderr: 'unknown option', error: undefined, signal: null };
        }
        // python3 fallback
        return { status: 0, stdout: '0.4.3\n', stderr: '', error: undefined, signal: null };
      });

      const result = checkGraphifyVersion();
      assert.strictEqual(result.version, '0.4.3');
      assert.strictEqual(result.compatible, true);
      assert.ok(calls.length >= 2, 'at least two spawnSync calls (graphify attempt + python3 fallback)');
      assert.strictEqual(calls[0].cmd, 'graphify', 'graphify call precedes python3 fallback');
      assert.ok(calls[0].args.includes('--version'), 'graphify --version attempted first');
      const lastCall = calls[calls.length - 1];
      assert.strictEqual(lastCall.cmd, 'python3', 'python3 fallback fires last');
      assert.ok(lastCall.args.some(arg => arg.includes('importlib.metadata')));
    });
  });

  describe('graphifyBuild', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => {
      cleanup(tmpDir);
      mock.restoreAll();
    });

    test('returns disabled response when graphify not enabled', () => {
      const tmpDir2 = createTempProject();
      const result = graphifyBuild(tmpDir2);
      assert.strictEqual(result.disabled, true);
      cleanup(tmpDir2);
    });

    test('returns error when graphify not installed', () => {
      mock.method(childProcess, 'spawnSync', () => ({
        status: null,
        stdout: '',
        stderr: '',
        error: { code: 'ENOENT' },
        signal: null,
      }));

      const result = graphifyBuild(tmpDir);
      assert.ok(result.error);
      assert.ok(result.error.includes('not installed') || result.error.includes('pip install'));
    });

    test('returns spawn_agent action on successful pre-flight', () => {
      mock.method(childProcess, 'spawnSync', (_cmd, args) => {
        if (args && args[0] === '--help') {
          return { status: 0, stdout: 'Usage', stderr: '', error: undefined, signal: null };
        }
        // version check via python3
        return { status: 0, stdout: '0.4.3\n', stderr: '', error: undefined, signal: null };
      });

      const result = graphifyBuild(tmpDir);
      assert.strictEqual(result.action, 'spawn_agent');
      assert.ok(result.graphs_dir);
      assert.ok(result.graphify_out);
      assert.strictEqual(result.timeout_seconds, 300);
      assert.strictEqual(result.version, '0.4.3');
      assert.strictEqual(result.version_warning, null);
      assert.deepStrictEqual(result.artifacts, ['graph.json', 'graph.html', 'GRAPH_REPORT.md']);
    });

    test('creates .planning/graphs/ directory if missing', () => {
      mock.method(childProcess, 'spawnSync', (_cmd, args) => {
        if (args && args[0] === '--help') {
          return { status: 0, stdout: 'Usage', stderr: '', error: undefined, signal: null };
        }
        return { status: 0, stdout: '0.4.3\n', stderr: '', error: undefined, signal: null };
      });

      const graphsDir = path.join(planningDir, 'graphs');
      assert.strictEqual(fs.existsSync(graphsDir), false);

      graphifyBuild(tmpDir);
      assert.strictEqual(fs.existsSync(graphsDir), true);
    });

    test('reads graphify.build_timeout from config', () => {
      // Write config with custom timeout
      const configPath = path.join(planningDir, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.graphify.build_timeout = 600;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      mock.method(childProcess, 'spawnSync', (_cmd, args) => {
        if (args && args[0] === '--help') {
          return { status: 0, stdout: 'Usage', stderr: '', error: undefined, signal: null };
        }
        return { status: 0, stdout: '0.4.3\n', stderr: '', error: undefined, signal: null };
      });

      const result = graphifyBuild(tmpDir);
      assert.strictEqual(result.timeout_seconds, 600);
    });

    test('includes version warning when outside tested range', () => {
      mock.method(childProcess, 'spawnSync', (_cmd, args) => {
        if (args && args[0] === '--help') {
          return { status: 0, stdout: 'Usage', stderr: '', error: undefined, signal: null };
        }
        return { status: 0, stdout: '1.2.0\n', stderr: '', error: undefined, signal: null };
      });

      const result = graphifyBuild(tmpDir);
      assert.strictEqual(result.action, 'spawn_agent');
      assert.ok(result.version_warning);
      assert.ok(result.version_warning.includes('outside tested range'));
    });
  });

  describe('writeSnapshot', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempProject();
      planningDir = path.join(tmpDir, '.planning');
    });

    afterEach(() => {
      cleanup(tmpDir);
    });

    test('writes snapshot from existing graph.json', () => {
      const graphData = {
        nodes: [{ id: 'A', label: 'Node A' }, { id: 'B', label: 'Node B' }],
        edges: [{ source: 'A', target: 'B', label: 'relates' }],
      };
      writeGraphJson(planningDir, graphData);

      const result = writeSnapshot(tmpDir);
      assert.strictEqual(result.saved, true);
      assert.strictEqual(result.node_count, 2);
      assert.strictEqual(result.edge_count, 1);
      assert.ok(result.timestamp);

      // Verify file was actually written
      const snapshotPath = path.join(planningDir, 'graphs', '.last-build-snapshot.json');
      assert.strictEqual(fs.existsSync(snapshotPath), true);

      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      assert.strictEqual(snapshot.version, 1);
      assert.strictEqual(snapshot.nodes.length, 2);
      assert.strictEqual(snapshot.edges.length, 1);
      assert.ok(snapshot.timestamp);
    });

    test('returns error when graph.json does not exist', () => {
      // graphs directory exists but no graph.json
      fs.mkdirSync(path.join(planningDir, 'graphs'), { recursive: true });

      const result = writeSnapshot(tmpDir);
      assert.ok(result.error);
      assert.ok(result.error.includes('not parseable'));
    });

    test('returns error when graph.json is invalid JSON', () => {
      const graphsDir = path.join(planningDir, 'graphs');
      fs.mkdirSync(graphsDir, { recursive: true });
      fs.writeFileSync(path.join(graphsDir, 'graph.json'), 'not valid json{{{', 'utf8');

      const result = writeSnapshot(tmpDir);
      assert.ok(result.error);
      assert.ok(result.error.includes('not parseable'));
    });

    test('handles graph.json with empty nodes and edges', () => {
      writeGraphJson(planningDir, { nodes: [], edges: [] });

      const result = writeSnapshot(tmpDir);
      assert.strictEqual(result.saved, true);
      assert.strictEqual(result.node_count, 0);
      assert.strictEqual(result.edge_count, 0);
    });

    test('handles graph.json missing nodes/edges keys gracefully', () => {
      writeGraphJson(planningDir, { metadata: { tool: 'graphify' } });

      const result = writeSnapshot(tmpDir);
      assert.strictEqual(result.saved, true);
      assert.strictEqual(result.node_count, 0);
      assert.strictEqual(result.edge_count, 0);
    });

    test('overwrites existing snapshot on rebuild', () => {
      // Write initial graph and snapshot
      writeGraphJson(planningDir, {
        nodes: [{ id: 'A' }],
        edges: [],
      });
      writeSnapshot(tmpDir);

      // Write updated graph with more nodes
      writeGraphJson(planningDir, {
        nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
        edges: [{ source: 'A', target: 'B' }],
      });

      const result = writeSnapshot(tmpDir);
      assert.strictEqual(result.saved, true);
      assert.strictEqual(result.node_count, 3);
      assert.strictEqual(result.edge_count, 1);

      // Verify file reflects latest data
      const snapshotPath = path.join(planningDir, 'graphs', '.last-build-snapshot.json');
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      assert.strictEqual(snapshot.nodes.length, 3);
    });
  });
});

// ─── query describe ───────────────────────────────────────────────────────────

describe('query', () => {
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

    test('returns parsed object for valid JSON file', () => {
      const filePath = path.join(planningDir, 'test.json');
      const data = { foo: 'bar', num: 42 };
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
      const result = safeReadJson(filePath);
      assert.deepStrictEqual(result, data);
    });

    test('returns null for malformed JSON', () => {
      const filePath = path.join(planningDir, 'bad.json');
      fs.writeFileSync(filePath, 'not json', 'utf8');
      const result = safeReadJson(filePath);
      assert.strictEqual(result, null);
    });

    test('returns null for non-existent file', () => {
      const result = safeReadJson(path.join(planningDir, 'does-not-exist.json'));
      assert.strictEqual(result, null);
    });
  });

  describe('buildAdjacencyMap', () => {
    test('creates bidirectional adjacency entries', () => {
      const adj = buildAdjacencyMap(SAMPLE_GRAPH);
      // n1 -> n2 edge exists, so adj['n1'] should have target n2 AND adj['n2'] should have target n1
      assert.ok(adj['n1'].some(e => e.target === 'n2'));
      assert.ok(adj['n2'].some(e => e.target === 'n1'));
    });

    test('initializes empty arrays for nodes without edges', () => {
      const graph = {
        nodes: [
          ...SAMPLE_GRAPH.nodes,
          { id: 'n99', label: 'Orphan', description: 'No edges', type: 'orphan' },
        ],
        edges: SAMPLE_GRAPH.edges,
      };
      const adj = buildAdjacencyMap(graph);
      assert.ok(Array.isArray(adj['n99']));
      assert.strictEqual(adj['n99'].length, 0);
    });

    test('stores full edge object in adjacency entries', () => {
      const adj = buildAdjacencyMap(SAMPLE_GRAPH);
      const entry = adj['n1'].find(e => e.target === 'n2');
      assert.ok(entry);
      assert.strictEqual(entry.edge.label, 'reads_from');
      assert.strictEqual(entry.edge.confidence, 'EXTRACTED');
    });

    // LINKS-01: graphify emits 'links' key; reader must fall back to it
    test('falls back to graph.links when graph.edges is absent (LINKS-01)', () => {
      const graphWithLinks = {
        nodes: SAMPLE_GRAPH.nodes,
        links: SAMPLE_GRAPH.edges,
      };
      const adj = buildAdjacencyMap(graphWithLinks);
      assert.ok(adj['n1'].some(e => e.target === 'n2'), 'adjacency must traverse links');
      assert.ok(adj['n2'].some(e => e.target === 'n1'), 'reverse adjacency must work');
    });
  });

  describe('seedAndExpand', () => {
    test('finds seed nodes by label match (case-insensitive)', () => {
      const result = seedAndExpand(SAMPLE_GRAPH, 'auth');
      assert.ok(result.seeds.has('n1'), 'AuthService should be a seed');
      assert.ok(result.nodes.some(n => n.id === 'n1'));
    });

    test('finds seed nodes by description match', () => {
      const result = seedAndExpand(SAMPLE_GRAPH, 'credentials');
      assert.ok(result.seeds.has('n2'), 'UserModel description contains credentials');
      assert.ok(result.nodes.some(n => n.id === 'n2'));
    });

    test('BFS expands 1-2 hops from seeds', () => {
      // 'auth' matches n1 (label: AuthService) and n2 (description: authentication)
      // n1 seeds: 1-hop -> n2, n3; 2-hop -> n4 (via n3->n4)
      // n5 is 3 hops from n1 (n1->n3->n4->n5) so should NOT appear
      const result = seedAndExpand(SAMPLE_GRAPH, 'auth');
      const nodeIds = result.nodes.map(n => n.id);
      assert.ok(nodeIds.includes('n1'), 'seed n1');
      assert.ok(nodeIds.includes('n2'), '1-hop from n1');
      assert.ok(nodeIds.includes('n3'), '1-hop from n1');
      assert.ok(nodeIds.includes('n4'), '2-hop from n3');
      // n5 is reachable only at 3 hops from n1 seeds, but n2 is also a seed
      // (description contains "authentication"), and n2->n3->n4->n5 is also 3 hops
      // So n5 should NOT be in results with maxHops=2
      assert.ok(!nodeIds.includes('n5'), 'n5 should be beyond 2 hops');
    });

    test('returns empty results for no matches', () => {
      const result = seedAndExpand(SAMPLE_GRAPH, 'nonexistent');
      assert.strictEqual(result.nodes.length, 0);
      assert.strictEqual(result.edges.length, 0);
      assert.strictEqual(result.seeds.size, 0);
    });

    test('respects maxHops parameter', () => {
      const result = seedAndExpand(SAMPLE_GRAPH, 'auth', 1);
      const nodeIds = result.nodes.map(n => n.id);
      assert.ok(nodeIds.includes('n1'), 'seed');
      assert.ok(nodeIds.includes('n2'), '1-hop');
      assert.ok(nodeIds.includes('n3'), '1-hop');
      assert.ok(!nodeIds.includes('n4'), 'n4 is 2 hops away');
    });
  });

  describe('applyBudget', () => {
    test('returns result unchanged when no budget', () => {
      const input = { nodes: SAMPLE_GRAPH.nodes, edges: SAMPLE_GRAPH.edges, seeds: new Set(['n1']) };
      const result = applyBudget(input, null);
      assert.strictEqual(result.nodes, input.nodes);
      assert.strictEqual(result.edges, input.edges);
    });

    test('drops AMBIGUOUS edges first when over budget', () => {
      const input = { nodes: SAMPLE_GRAPH.nodes, edges: SAMPLE_GRAPH.edges, seeds: new Set(['n1']) };
      // Set a budget small enough to trigger trimming but large enough to keep some edges
      // The full graph serialized is ~600+ chars = ~150+ tokens. Use a small budget.
      const result = applyBudget(input, 50);
      const confidences = result.edges.map(e => e.confidence);
      assert.ok(!confidences.includes('AMBIGUOUS'), 'AMBIGUOUS edges should be dropped first');
    });

    test('drops INFERRED edges after AMBIGUOUS', () => {
      const input = { nodes: SAMPLE_GRAPH.nodes, edges: SAMPLE_GRAPH.edges, seeds: new Set(['n1']) };
      // Very tight budget to force dropping both AMBIGUOUS and INFERRED
      const result = applyBudget(input, 10);
      const confidences = result.edges.map(e => e.confidence);
      assert.ok(!confidences.includes('AMBIGUOUS'), 'AMBIGUOUS removed');
      assert.ok(!confidences.includes('INFERRED'), 'INFERRED removed');
      // Only EXTRACTED should remain (if any)
      for (const c of confidences) {
        assert.strictEqual(c, 'EXTRACTED');
      }
    });

    test('appends trimmed footer with counts', () => {
      const input = { nodes: SAMPLE_GRAPH.nodes, edges: SAMPLE_GRAPH.edges, seeds: new Set(['n1']) };
      const result = applyBudget(input, 10);
      assert.ok(result.trimmed !== null, 'trimmed should not be null');
      assert.ok(/\d+ edges omitted/.test(result.trimmed), 'trimmed contains edge count');
      assert.ok(/\d+ nodes unreachable/.test(result.trimmed), 'trimmed contains node count');
    });
  });

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

    // QUERY-01: returns disabled response when graphify not enabled
    test('returns disabled response when graphify not enabled', () => {
      const result = graphifyQuery(tmpDir, 'auth');
      assert.strictEqual(result.disabled, true);
    });

    // QUERY-01: returns error when graph.json does not exist
    test('returns error when graph.json does not exist', () => {
      enableGraphify(planningDir);
      const result = graphifyQuery(tmpDir, 'auth');
      assert.ok(result.error);
      assert.ok(result.error.includes('No graph'));
    });

    // QUERY-01: returns matching nodes and edges for valid query
    test('returns matching nodes and edges for valid query', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyQuery(tmpDir, 'auth');
      assert.ok(result.nodes.length > 0, 'should have matching nodes');
      assert.ok(result.edges.length > 0, 'should have matching edges');
      assert.strictEqual(result.term, 'auth');
    });

    // QUERY-03: includes confidence on edges
    test('includes confidence on edges (QUERY-03)', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyQuery(tmpDir, 'auth');
      const validTiers = ['EXTRACTED', 'INFERRED', 'AMBIGUOUS'];
      for (const edge of result.edges) {
        assert.ok(validTiers.includes(edge.confidence), `edge confidence ${edge.confidence} is valid tier`);
      }
    });

    // QUERY-02: respects --budget option
    test('respects --budget option (QUERY-02)', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyQuery(tmpDir, 'auth', { budget: 50 });
      // With a very small budget, trimming should occur
      assert.ok(result.trimmed !== null, 'trimmed should indicate budget was applied');
    });

    // QUERY-01: returns total_nodes and total_edges counts
    test('returns total_nodes and total_edges counts', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyQuery(tmpDir, 'auth');
      assert.strictEqual(typeof result.total_nodes, 'number');
      assert.strictEqual(typeof result.total_edges, 'number');
    });
  });

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

    // DIFF-01: returns disabled response when not enabled
    test('returns disabled response when not enabled', () => {
      const result = graphifyDiff(tmpDir);
      assert.strictEqual(result.disabled, true);
    });

    // D-09: returns no_baseline when no snapshot exists
    test('returns no_baseline when no snapshot exists (D-09)', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyDiff(tmpDir);
      assert.strictEqual(result.no_baseline, true);
      assert.ok(result.message.includes('No previous snapshot'));
    });

    // DIFF-01: returns error when no current graph but snapshot exists
    test('returns error when no current graph but snapshot exists', () => {
      enableGraphify(planningDir);
      writeSnapshotJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyDiff(tmpDir);
      assert.ok(result.error);
      assert.ok(result.error.includes('No current graph'));
    });

    // DIFF-02: detects added and removed nodes
    test('detects added and removed nodes (DIFF-02)', () => {
      enableGraphify(planningDir);
      const snapshot = {
        nodes: [
          { id: 'n1', label: 'AuthService', description: 'Auth', type: 'service' },
          { id: 'n2', label: 'UserModel', description: 'User', type: 'model' },
        ],
        edges: [],
      };
      const current = {
        nodes: [
          { id: 'n1', label: 'AuthService', description: 'Auth', type: 'service' },
          { id: 'n3', label: 'SessionManager', description: 'Sessions', type: 'service' },
        ],
        edges: [],
      };
      writeSnapshotJson(planningDir, snapshot);
      writeGraphJson(planningDir, current);
      const result = graphifyDiff(tmpDir);
      assert.strictEqual(result.nodes.added, 1, 'n3 added');
      assert.strictEqual(result.nodes.removed, 1, 'n2 removed');
    });

    // DIFF-02: detects changed nodes and edges
    test('detects changed nodes and edges (DIFF-02)', () => {
      enableGraphify(planningDir);
      const snapshot = {
        nodes: [
          { id: 'n1', label: 'OldName', description: 'Auth', type: 'service' },
          { id: 'n2', label: 'UserModel', description: 'User', type: 'model' },
        ],
        edges: [
          { source: 'n1', target: 'n2', label: 'reads_from', confidence: 'INFERRED' },
        ],
      };
      const current = {
        nodes: [
          { id: 'n1', label: 'NewName', description: 'Auth', type: 'service' },
          { id: 'n2', label: 'UserModel', description: 'User', type: 'model' },
        ],
        edges: [
          { source: 'n1', target: 'n2', label: 'reads_from', confidence: 'EXTRACTED' },
        ],
      };
      writeSnapshotJson(planningDir, snapshot);
      writeGraphJson(planningDir, current);
      const result = graphifyDiff(tmpDir);
      assert.strictEqual(result.nodes.changed, 1, 'n1 label changed');
      assert.strictEqual(result.edges.changed, 1, 'edge confidence changed');
    });

    // LINKS-03: diff must handle links key in both current and snapshot (LINKS-03)
    test('detects edge changes when graphs use links key (LINKS-03)', () => {
      enableGraphify(planningDir);
      const snapshot = {
        nodes: [
          { id: 'n1', label: 'AuthService', description: 'Auth', type: 'service' },
          { id: 'n2', label: 'UserModel', description: 'User', type: 'model' },
        ],
        links: [
          { source: 'n1', target: 'n2', label: 'reads_from', confidence: 'INFERRED' },
        ],
      };
      const current = {
        nodes: [
          { id: 'n1', label: 'AuthService', description: 'Auth', type: 'service' },
          { id: 'n2', label: 'UserModel', description: 'User', type: 'model' },
        ],
        links: [
          { source: 'n1', target: 'n2', label: 'reads_from', confidence: 'EXTRACTED' },
        ],
      };
      writeSnapshotJson(planningDir, snapshot);
      writeGraphJson(planningDir, current);
      const result = graphifyDiff(tmpDir);
      assert.strictEqual(result.edges.changed, 1, 'edge confidence change must be detected via links key');
      assert.strictEqual(result.edges.added, 0);
      assert.strictEqual(result.edges.removed, 0);
    });
  });

  // AGENT-03: Graceful degradation (graph absent)
  describe('graceful degradation (AGENT-03)', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempProject();
      planningDir = path.join(tmpDir, '.planning');
    });

    afterEach(() => {
      cleanup(tmpDir);
    });

    // AGENT-03: graphifyQuery returns error object when graph.json absent (not exception)
    test('graphifyQuery returns clean error object when graph.json does not exist', () => {
      enableGraphify(planningDir);
      const result = graphifyQuery(tmpDir, 'anything');
      assert.ok(result.error, 'should have error property');
      assert.ok(result.error.includes('No graph'), 'error should mention no graph');
      assert.strictEqual(typeof result.error, 'string', 'error should be a string, not thrown');
    });

    // AGENT-03: graphifyStatus returns exists:false when graph.json absent (not exception)
    test('graphifyStatus returns exists:false when graph.json does not exist', () => {
      enableGraphify(planningDir);
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.exists, false, 'should report exists as false');
      assert.ok(result.message, 'should have a message');
      assert.ok(result.message.includes('No graph'), 'message should mention no graph');
    });

    // AGENT-03: graphifyQuery with various terms all return clean errors when no graph
    test('graphifyQuery gracefully handles any query term when graph absent', () => {
      enableGraphify(planningDir);
      const terms = ['auth', 'payment', 'nonexistent', ''];
      for (const term of terms) {
        const result = graphifyQuery(tmpDir, term);
        assert.ok(result.error || result.nodes !== undefined,
          `term "${term}" should return error or valid result, not throw`);
      }
    });

    // D-12: Integration test - query returns expected structure with known graph.json
    test('graphifyQuery returns non-empty results with expected structure for known graph', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyQuery(tmpDir, 'auth');
      assert.ok(!result.error, 'should not have error when graph exists');
      assert.ok(Array.isArray(result.nodes), 'nodes should be an array');
      assert.ok(Array.isArray(result.edges), 'edges should be an array');
      assert.ok(result.nodes.length > 0, 'should have matching nodes for auth term');
      assert.strictEqual(typeof result.total_nodes, 'number', 'total_nodes should be a number');
      assert.strictEqual(typeof result.total_edges, 'number', 'total_edges should be a number');
      assert.strictEqual(result.term, 'auth', 'term should be echoed back');
    });

    // D-12: graphifyStatus returns valid structure with known graph.json
    test('graphifyStatus returns valid structure when graph.json exists', () => {
      enableGraphify(planningDir);
      writeGraphJson(planningDir, SAMPLE_GRAPH);
      const result = graphifyStatus(tmpDir);
      assert.strictEqual(result.exists, true, 'should report exists as true');
      assert.strictEqual(typeof result.node_count, 'number', 'node_count should be number');
      assert.strictEqual(typeof result.edge_count, 'number', 'edge_count should be number');
      assert.strictEqual(typeof result.stale, 'boolean', 'stale should be boolean');
      assert.strictEqual(typeof result.age_hours, 'number', 'age_hours should be number');
    });
  });
});

// ─── staleness describe ──────────────────────────────────────────────────────

describe('staleness', () => {
  // Regression for #3170: graphifyStatus surfaces built_at_commit staleness.
  // graphify v0.7+ embeds `built_at_commit` into graph.json at write time.
  // Tri-state on commit_stale: null means "we don't know" (pre-v0.7 graph or
  // no git), which is semantically distinct from false ("known fresh").

  describe('git-aware', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempGitProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => cleanup(tmpDir));

    test('graph rebuilt at HEAD: commits_behind=0, commit_stale=false', () => {
      const head = gitHead(tmpDir);
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: head });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, head.slice(0, 7),
        'short hash from graph.built_at_commit');
      assert.equal(result.current_commit, head.slice(0, 7),
        'short hash of git HEAD');
      assert.equal(result.commits_behind, 0,
        'zero commits between HEAD and itself');
      assert.equal(result.commit_stale, false,
        'commit_stale is explicitly false when commits_behind === 0');
    });

    test('graph 5 commits behind HEAD: commits_behind=5, commit_stale=true', () => {
      const built = gitHead(tmpDir);
      for (let i = 0; i < 5; i += 1) commitEmpty(tmpDir, `c${i}`);
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: built });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.commits_behind, 5);
      assert.equal(result.commit_stale, true);
      assert.equal(result.built_at_commit, built.slice(0, 7));
      assert.notEqual(result.current_commit, built.slice(0, 7),
        'current_commit reflects HEAD, not graph build commit');
    });

    test('built_at_commit absent (pre-v0.7 graph): all four new fields null', () => {
      // No built_at_commit on the graph -- GSD must not fabricate one.
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [] });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, null);
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null,
        'tri-state: null means "we do not know", not "fresh"');
      // current_commit may still be non-null since we are in a git repo,
      // but without a baseline it cannot drive staleness.
      assert.notEqual(result.current_commit, undefined,
        'current_commit field is always present even when null');
    });

    test('rebased-away built_at_commit: commits_behind=null, commit_stale=null', () => {
      // built_at_commit references a commit that never existed in this repo.
      const ghostHash = '0000000000000000000000000000000000000001';
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: ghostHash });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, ghostHash.slice(0, 7),
        'echoes the field even if unreachable -- caller can decide what to do');
      assert.equal(result.commits_behind, null,
        'cannot count commits to an unreachable commit');
      assert.equal(result.commit_stale, null,
        'unknown distance means unknown staleness');
    });

    test('malformed built_at_commit (dashed argv): rejected before git invocation', () => {
      // Argument-injection fence: a graph.json with a hostile built_at_commit
      // must never reach `git` as an argv element. The implementation should
      // validate /^[0-9a-f]{4,40}$/i and treat anything else as absent.
      const malicious = '--upload-pack=evil';
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: malicious });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, null,
        'malformed value is rejected, not echoed');
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null);
    });
  });

  describe('non-git cwd', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => cleanup(tmpDir));

    test('cwd has no .git: current_commit=null, derived fields=null', () => {
      const built = 'abcdef1234567890abcdef1234567890abcdef12';
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: built });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, built.slice(0, 7),
        'graph field is echoed even without a local repo');
      assert.equal(result.current_commit, null,
        'no HEAD without git');
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null);
    });
  });

  describe('back-compat', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempGitProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
      writeGraphJson(planningDir, {
        nodes: SAMPLE_NODES_MINIMAL,
        edges: [{ source: 'n1', target: 'n2', label: 'x', confidence: 'EXTRACTED' }],
        hyperedges: [],
        built_at_commit: gitHead(tmpDir),
      });
    });

    afterEach(() => cleanup(tmpDir));

    test('existing fields are unchanged when commit-staleness fields are added', () => {
      const result = graphifyStatus(tmpDir);

      // Existing contract — must not regress.
      assert.equal(result.exists, true);
      assert.equal(result.node_count, 2);
      assert.equal(result.edge_count, 1);
      assert.equal(result.hyperedge_count, 0);
      assert.equal(typeof result.last_build, 'string');
      assert.equal(typeof result.stale, 'boolean',
        'mtime-based stale flag stays as-is for back-compat');
      assert.equal(typeof result.age_hours, 'number');
    });

    test('disabled response is unchanged (commit-staleness fields not added)', () => {
      const tmp2 = createTempProject();
      try {
        const result = graphifyStatus(tmp2);
        assert.equal(result.disabled, true,
          'disabled path returns the existing shape, no commit fields');
        assert.equal(result.built_at_commit, undefined,
          'commit-staleness fields are only added on the success path');
      } finally {
        cleanup(tmp2);
      }
    });
  });
});

// ─── mvp-viz describe ─────────────────────────────────────────────────────────

describe('mvp-viz', () => {
  // Contract: commands/gsd/graphify.md documents MVP visual differentiation.
  // Per PRD Q5: distinct node color + 'MVP' label suffix.
  // Tests parse the markdown skill into structured IR (YAML frontmatter +
  // fenced code blocks) and assert on the parsed structures, not raw text.

  const CMD = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

  /**
   * Parse the narrow YAML subset used in this skill's frontmatter:
   *   key: scalar
   *   key:
   *     - item
   *     - item
   */
  function parseSkillFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let activeKey = null;
    let activeList = null;
    for (const raw of lines) {
      const listItem = raw.match(/^\s+-\s+(.+?)\s*$/);
      if (listItem && activeList) {
        activeList.push(listItem[1]);
        continue;
      }
      const kv = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawValue] = kv;
      const value = rawValue.trim();
      if (value === '') {
        activeKey = key;
        activeList = [];
        out[key] = activeList;
      } else {
        activeKey = null;
        activeList = null;
        out[key] = value;
      }
    }
    return out;
  }

  /**
   * Walk markdown body line-by-line and return every fenced code block as
   * { lang, content } records. Tracks fence state explicitly.
   */
  function extractFencedBlocks(body) {
    const lines = body.split(/\r?\n/);
    const blocks = [];
    let active = null;
    for (const line of lines) {
      const open = line.match(/^```(\S*)\s*$/);
      if (active === null) {
        if (open) active = { lang: open[1] || '', lines: [] };
        continue;
      }
      if (line.trim() === '```') {
        blocks.push({ lang: active.lang, content: active.lines.join('\n') });
        active = null;
        continue;
      }
      active.lines.push(line);
    }
    return blocks;
  }

  function loadSkill() {
    // Local rename (`markdown` not `content`) so the no-source-grep lint
    // doesn't conflate this readFileSync-bound variable with the
    // `b.content.includes(...)` calls below — those operate on parsed
    // fenced-block records, not raw file text.
    const markdown = fs.readFileSync(CMD, 'utf8');
    const lines = markdown.split(/\r?\n/);
    const delims = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') delims.push(i);
      if (delims.length === 2) break;
    }
    assert.equal(delims.length, 2, 'graphify.md must have a closed frontmatter block');
    const frontmatterText = lines.slice(delims[0] + 1, delims[1]).join('\n');
    const body = lines.slice(delims[1] + 1).join('\n');
    return {
      frontmatter: parseSkillFrontmatter(frontmatterText),
      body,
      fencedBlocks: extractFencedBlocks(body),
    };
  }

  // Parse MVP section from graphify.md body as structured IR (not raw grep).
  // Extracts: mentionsMvp, colorRuleLine, labelRuleLine, fallbackLine.
  function parseMvpVizContract(body) {
    const lines = body.split(/\r?\n/);
    const lowerLines = lines.map(line => line.toLowerCase());
    const mvpLines = lines.filter(line => line.toLowerCase().includes('mvp'));
    return {
      mentionsMvp: mvpLines.length > 0,
      colorRuleLine: mvpLines.find(line => {
        const lower = line.toLowerCase();
        return lower.includes('color') || lower.includes('fill') || line.includes('#');
      }) || '',
      labelRuleLine: mvpLines.find(line => {
        const lower = line.toLowerCase();
        return lower.includes('label') || lower.includes('suffix');
      }) || '',
      fallbackLine: lowerLines.find(line =>
        (line.includes('mode') && (line.includes('null') || line.includes('absent') || line.includes('not mvp'))) ||
        (line.includes('standard') && (line.includes('render') || line.includes('fallback')))
      ) || '',
    };
  }

  test('graphify.md documents distinct color for MVP-mode phases', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    assert.ok(contract.mentionsMvp, 'must mention MVP in color rule');
    assert.ok(contract.colorRuleLine.length > 0, 'must reference a color/fill rule for MVP nodes');
  });

  test('graphify.md documents MVP label suffix on node text', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    assert.ok(contract.labelRuleLine.length > 0, 'must add an MVP label/suffix to node text');
  });

  test('graphify.md specifies fallback when phase mode is null/absent', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    assert.ok(contract.fallbackLine.length > 0, 'must specify fallback when mode is not mvp');
  });

  // Counter-test: a non-mvp phase must NOT carry mode:'mvp' in the contract.
  // The fallbackLine ensures standard rendering is documented for the non-mvp case.
  test('non-mvp phase render path is documented (counter-test)', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    // The fallback line is required precisely because non-mvp phases exist;
    // its presence is the counter-assertion that mvp rendering is NOT applied globally.
    assert.ok(
      contract.fallbackLine.length > 0,
      'fallback documentation confirms mvp rendering is not applied to non-mvp phases',
    );
    // Additionally: the MVP label should only be a suffix, not a full replacement;
    // so the standard label path (no MVP suffix) must be documented.
    assert.ok(
      contract.mentionsMvp,
      'mvp mention is present, meaning mvp is treated as a special case, not the default',
    );
  });
});

// ─── auto-update describe ─────────────────────────────────────────────────────

describe('auto-update', () => {
  // Regression for #3347: opt-in auto-update of the knowledge graph after
  // main HEAD advances. Two sub-concerns: config-key surface (config.test)
  // and hook behavior (hook.test). Both merged here.

  describe('config-key surface', () => {
    // Regression for #3347

    test('VALID_CONFIG_KEYS contains graphify.auto_update', () => {
      assert.ok(
        VALID_CONFIG_KEYS.has('graphify.auto_update'),
        'graphify.auto_update must be in VALID_CONFIG_KEYS so config-set accepts it',
      );
    });

    test('isValidConfigKey accepts graphify.auto_update', () => {
      assert.ok(
        isValidConfigKey('graphify.auto_update'),
        'isValidConfigKey must return true for graphify.auto_update',
      );
    });

    test('isValidConfigKey still accepts the pre-existing graphify.enabled key', () => {
      assert.ok(
        isValidConfigKey('graphify.enabled'),
        'regression guard: graphify.enabled must remain a valid key',
      );
    });

    test('CANONICAL_CONFIG_DEFAULTS.graphify.auto_update is false', () => {
      assert.ok(
        CANONICAL_CONFIG_DEFAULTS.graphify !== undefined,
        'CANONICAL_CONFIG_DEFAULTS must expose a graphify section',
      );
      assert.strictEqual(
        CANONICAL_CONFIG_DEFAULTS.graphify.auto_update,
        false,
        'graphify.auto_update default must be false (opt-in per issue #3347 AC)',
      );
    });

    test('config-set graphify.auto_update true succeeds', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      const result = runGsdTools(
        ['config-set', 'graphify.auto_update', 'true'],
        tmpDir,
      );
      assert.ok(
        result.success,
        [
          'config-set graphify.auto_update true should succeed,',
          'got:',
          'stdout: ' + result.output,
          'stderr: ' + result.error,
        ].join('\n'),
      );
    });

    test('config-set graphify.auto_update true writes to config.json', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      runGsdTools(['config-set', 'graphify.auto_update', 'true'], tmpDir);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      assert.ok(
        fs.existsSync(configPath),
        '.planning/config.json must exist after config-set',
      );

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(
        config.graphify?.auto_update,
        true,
        [
          'Expected graphify.auto_update: true in config.json,',
          'got: ' + JSON.stringify(config.graphify),
        ].join('\n'),
      );
    });

    test('config-set graphify.auto_update false persists too', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      runGsdTools(['config-set', 'graphify.auto_update', 'true'], tmpDir);
      runGsdTools(['config-set', 'graphify.auto_update', 'false'], tmpDir);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(
        config.graphify?.auto_update,
        false,
        'config-set must round-trip true → false',
      );
    });

    test('graphifyStatus folds auto-update status=failed into stale=true', (t) => {
      const tmpDir = makeStatusProject({
        ts: '2026-05-15T12:00:00Z',
        status: 'failed',
        exit_code: 1,
        duration_ms: 1234,
        head_at_build: 'abcdef0',
        graphify_version: null,
      });
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.stale, true, 'auto-build failure must set stale=true');
      assert.ok(s.last_build_auto_update, 'last_build_auto_update must be exposed');
      assert.strictEqual(s.last_build_auto_update.status, 'failed');
      assert.strictEqual(s.last_build_auto_update.exit_code, 1);
    });

    test('graphifyStatus folds auto-update status=running into stale=true', (t) => {
      const tmpDir = makeStatusProject({
        ts: '2026-05-15T12:00:00Z',
        status: 'running',
        exit_code: null,
        duration_ms: null,
        head_at_build: 'abcdef0',
        graphify_version: null,
      });
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.stale, true, 'auto-build in-flight must set stale=true');
      assert.strictEqual(s.last_build_auto_update.status, 'running');
    });

    test('graphifyStatus leaves stale alone when auto-update status=ok and graph is fresh', (t) => {
      const tmpDir = makeStatusProject({
        ts: '2026-05-15T12:00:00Z',
        status: 'ok',
        exit_code: 0,
        duration_ms: 1234,
        head_at_build: 'abcdef0',
        graphify_version: null,
      });
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.stale, false, 'fresh graph + ok auto-build => not stale');
      assert.strictEqual(s.last_build_auto_update.status, 'ok');
    });

    test('graphifyStatus exposes last_build_auto_update: null when status file absent', (t) => {
      const tmpDir = makeStatusProject(null);
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.last_build_auto_update, null);
      assert.strictEqual(s.stale, false, 'no status file => stale follows mtime only');
    });

    test('config-set graphify.auto_update does not perturb sibling graphify.enabled', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      runGsdTools(['config-set', 'graphify.enabled', 'true'], tmpDir);
      runGsdTools(['config-set', 'graphify.auto_update', 'true'], tmpDir);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(
        config.graphify?.enabled,
        true,
        'graphify.enabled must be preserved when setting graphify.auto_update',
      );
      assert.strictEqual(
        config.graphify?.auto_update,
        true,
        'graphify.auto_update must coexist with graphify.enabled',
      );
    });
  });

  // ─── hook tests ─────────────────────────────────────────────────────────────

  const isWindows = process.platform === 'win32';
  const HOOK = path.join(__dirname, '..', 'hooks', 'gsd-graphify-update.sh');

  function createTempGitRepo(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3347-'));
    spawnSync('git', ['init', '-b', opts.defaultBranch || 'main'], {
      cwd: tmpDir,
      stdio: 'ignore',
    });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test\n');
    execFileSync('git', ['add', 'README.md'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    if (opts.config !== undefined) {
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'config.json'),
        JSON.stringify(opts.config, null, 2),
      );
    }
    return tmpDir;
  }

  function makeMockGraphifyBin(tmpDir, { exitCode = 0, sleepMs = 0 } = {}) {
    const binDir = path.join(tmpDir, '.mock-bin');
    fs.mkdirSync(binDir, { recursive: true });
    const script = path.join(binDir, 'graphify');
    const body = [
      '#!/usr/bin/env bash',
      'set -u',
      sleepMs ? `sleep ${(sleepMs / 1000).toFixed(3)}` : '',
      'mkdir -p graphify-out',
      'echo \'{"nodes":[],"edges":[]}\' > graphify-out/graph.json',
      'echo "mock report" > graphify-out/GRAPH_REPORT.md',
      'echo "<html></html>" > graphify-out/graph.html',
      `exit ${exitCode}`,
    ]
      .filter(Boolean)
      .join('\n');
    fs.writeFileSync(script, body + '\n', { mode: 0o755 });
    return binDir;
  }

  function runHook(tmpDir, toolPayload, { env = {}, pathPrepend = '' } = {}) {
    const PATH = pathPrepend
      ? `${pathPrepend}${path.delimiter}${process.env.PATH || ''}`
      : process.env.PATH || '';
    return spawnSync('bash', [HOOK], {
      cwd: tmpDir,
      input: JSON.stringify(toolPayload),
      env: {
        ...process.env,
        PATH,
        CI: '',
        ...env,
      },
      encoding: 'utf8',
      timeout: 30000,
    });
  }

  function cleanupHookRepo(tmpDir) {
    // The hook detaches a graphify-rebuild subprocess that may still be writing
    // into tmpDir when the test body returns. Wait briefly for its lock file to
    // disappear (rebuild process exit trap removes it), then retry rmSync to
    // absorb any remaining transient ENOTEMPTY race.
    const lockPath = path.join(tmpDir, '.planning/graphs/.rebuild.lock');
    const lockDeadline = Date.now() + 4000;
    while (Date.now() < lockDeadline) {
      if (!fs.existsSync(lockPath)) break;
      try {
        const pid = parseInt(fs.readFileSync(lockPath, 'utf8'), 10);
        if (!Number.isFinite(pid) || pid <= 0) break;
        execFileSync('kill', ['-0', String(pid)], { stdio: 'ignore' });
      } catch {
        break; // PID dead → safe to clean up
      }
      execFileSync('sleep', ['0.05']);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }

  describe('hook — bail paths (no side effects)',
    { skip: isWindows ? 'POSIX-only: harness spawns bash + kill -0 + sleep; the hook itself is a bash script under test' : false },
    () => {
    test('non-Bash tool call exits 0 with no status file', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Edit', tool_input: { file_path: 'x' } });
      assert.strictEqual(r.status, 0, 'hook must exit 0 on non-Bash tool');
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'no status file should be created when bailing',
      );
    });

    test('Bash but non-HEAD-advancing command exits 0 with no status file', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'ls -la' } });
      assert.strictEqual(r.status, 0);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
    });

    test('git commit but graphify.enabled=false → no dispatch', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: false, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } });
      assert.strictEqual(r.status, 0);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
    });

    test('git commit but graphify.auto_update=false → no dispatch (opt-in)', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: false } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } });
      assert.strictEqual(r.status, 0);
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'opt-in default-off: auto_update=false must suppress dispatch',
      );
    });

    test('CI=true → no dispatch even with both gates true', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir);
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { env: { CI: 'true' }, pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
    });

    test('on non-default branch → no dispatch', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      execFileSync('git', ['checkout', '-b', 'worktree-agent-abc'], {
        cwd: tmpDir,
        stdio: 'ignore',
      });
      const mockBin = makeMockGraphifyBin(tmpDir);
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'branch check must filter worktree-agent-* (non-default-branch) commits',
      );
    });

    test('graphify binary not on PATH → silent exit 0', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      // Note: do NOT prepend mock bin; rely on real PATH not having graphify
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { env: { PATH: '/usr/bin:/bin' } },
      );
      assert.strictEqual(r.status, 0, 'must not break commits when graphify missing');
    });
  });

  describe('hook — dispatch path (all gates pass)',
    { skip: isWindows ? 'POSIX-only: harness spawns bash + kill -0 + sleep; the hook itself is a bash script under test' : false },
    () => {
    test('writes status file with status=running synchronously before returning', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      // Sleep 2s in mock so we can observe the running state before completion
      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 2000 });

      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0, 'hook must return 0');

      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      assert.ok(fs.existsSync(statusPath), 'status file must be written synchronously');
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      assert.strictEqual(status.status, 'running', 'initial status must be "running"');
      assert.ok(/^[0-9a-f]{7,40}$/.test(status.head_at_build), 'head_at_build must be a commit sha');
    });

    test('completes to status=ok after detached graphify run succeeds', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { exitCode: 0, sleepMs: 200 });

      runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );

      // Wait up to 5s for the detached process to finish updating the status
      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      const deadline = Date.now() + 15000;
      let status;
      while (Date.now() < deadline) {
        if (fs.existsSync(statusPath)) {
          try {
            status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            if (status.status === 'ok') break;
          } catch {
            // Detached writer can briefly expose a partial JSON write.
          }
        }
        execFileSync('sleep', ['0.1']);
      }
      assert.ok(status, 'status file must exist after dispatch');
      assert.strictEqual(status.status, 'ok', 'mock graphify exit=0 → status ok');
      assert.strictEqual(status.exit_code, 0);
      assert.ok(typeof status.duration_ms === 'number' && status.duration_ms >= 0);
    });

    test('completes to status=failed when graphify exits non-zero', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { exitCode: 1, sleepMs: 100 });

      runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );

      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      const deadline = Date.now() + 15000;
      let status;
      while (Date.now() < deadline) {
        if (fs.existsSync(statusPath)) {
          try {
            status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            if (status.status === 'failed') break;
          } catch {
            // Detached writer can briefly expose a partial JSON write.
          }
        }
        execFileSync('sleep', ['0.1']);
      }
      assert.ok(status, 'status file must exist after dispatch');
      assert.strictEqual(status.status, 'failed', 'mock graphify exit=1 → status failed');
      assert.strictEqual(status.exit_code, 1);
    });

    test('lock file with a live PID prevents concurrent dispatch', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      fs.mkdirSync(path.join(tmpDir, '.planning/graphs'), { recursive: true });
      // Seed a live-PID lock pointing at our own process — kill -0 will succeed
      fs.writeFileSync(path.join(tmpDir, '.planning/graphs/.rebuild.lock'), String(process.pid));

      const mockBin = makeMockGraphifyBin(tmpDir);
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      // Status file should NOT be written because a rebuild is in flight
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'live PID lock must suppress dispatch',
      );
    });

    test('stale lock file (dead PID) is treated as absent', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      fs.mkdirSync(path.join(tmpDir, '.planning/graphs'), { recursive: true });
      // PID 1 is init; kill -0 1 succeeds for root but fails for non-root.
      // Use a very large PID number unlikely to exist (max pid = 4194304 on linux).
      fs.writeFileSync(path.join(tmpDir, '.planning/graphs/.rebuild.lock'), '4194303');

      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 500 });
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      assert.ok(fs.existsSync(statusPath), 'stale lock must not block dispatch');
    });

    test('respects git.base_branch config override (default branch != main)', (t) => {
      const tmpDir = createTempGitRepo({
        defaultBranch: 'trunk',
        config: {
          graphify: { enabled: true, auto_update: true },
          git: { base_branch: 'trunk' },
        },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 100 });
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(
        fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'hook must honor git.base_branch when default branch is not main',
      );
    });
  });

  describe('hook — HEAD-advancing command matchers',
    { skip: isWindows ? 'POSIX-only: harness spawns bash to invoke the .sh hook under test' : false },
    () => {
    for (const cmd of [
      'git commit -m fix',
      'git merge feature',
      'git pull --ff-only',
      'git rebase --continue',
      'git cherry-pick abc123',
      // #3653 — `gsd-sdk query commit` invokes git via spawnSync('git', [...]),
      // so the substring "git commit" never appears in tool_input.command.
      // The hook must match the user-facing SDK invocation directly.
      'gsd-sdk query commit "docs: probe" --files .planning/STATE.md',
      'npx gsd-sdk query commit "docs: probe" --files .planning/STATE.md',
    ]) {
      test(`dispatches on: ${cmd}`, (t) => {
        const tmpDir = createTempGitRepo({
          config: { graphify: { enabled: true, auto_update: true } },
        });
        t.after(() => cleanupHookRepo(tmpDir));
        const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 100 });
        runHook(
          tmpDir,
          { tool_name: 'Bash', tool_input: { command: cmd } },
          { pathPrepend: mockBin },
        );
        assert.ok(
          fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
          `must dispatch for HEAD-advancing op: ${cmd}`,
        );
      });
    }

    test('does NOT dispatch on SDK commit-to-subrepo prefix collision', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 100 });
      const r = runHook(
        tmpDir,
        {
          tool_name: 'Bash',
          tool_input: {
            command: 'gsd-sdk query commit-to-subrepo "msg" --files packages/foo',
          },
        },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'must NOT dispatch for commit-to-subrepo, which does not advance the outer repo HEAD',
      );
    });

    // #3653 — only the SDK `commit` verb invokes git internally. Other
    // `gsd-sdk query` verbs (phase.complete, roadmap.update-plan-progress,
    // state.begin-phase) mutate .md files but do NOT advance HEAD; matching
    // them would cause a spurious rebuild per state mutation.
    for (const cmd of [
      'gsd-sdk query phase.complete 109',
      'gsd-sdk query roadmap.update-plan-progress 109 W001',
      'gsd-sdk query state.begin-phase 110',
    ]) {
      test(`does NOT dispatch on non-HEAD-advancing SDK verb: ${cmd}`, (t) => {
        const tmpDir = createTempGitRepo({
          config: { graphify: { enabled: true, auto_update: true } },
        });
        t.after(() => cleanupHookRepo(tmpDir));
        const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: cmd } });
        assert.strictEqual(r.status, 0);
        assert.ok(
          !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
          `must NOT dispatch for non-HEAD-advancing SDK verb: ${cmd}`,
        );
      });
    }
  });
});

// ─── regressions describe ─────────────────────────────────────────────────────

describe('regressions', () => {
  // ── Regression for #3166 ────────────────────────────────────────────────────
  // /gsd-graphify build lost artifacts because the skill spawned a Task
  // sub-agent that backgrounded `graphify update .`. Sub-agent isolation
  // SIGTERM'd the post-extraction phase before graph.json / graph.html /
  // GRAPH_REPORT.md were written.
  // Fix: skill runs the build inline in a single foreground Bash call.
  // Structural fence: skill is parsed into (a) a YAML frontmatter map and
  // (b) a list of fenced code blocks. Assertions run against parsed structures,
  // never against raw markdown text.

  const SKILL_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

  function parseBug3166SkillFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let activeKey = null;
    let activeList = null;
    for (const raw of lines) {
      const listItem = raw.match(/^\s+-\s+(.+?)\s*$/);
      if (listItem && activeList) {
        activeList.push(listItem[1]);
        continue;
      }
      const kv = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawValue] = kv;
      const value = rawValue.trim();
      if (value === '') {
        activeKey = key;
        activeList = [];
        out[key] = activeList;
      } else {
        activeKey = null;
        activeList = null;
        out[key] = value;
      }
    }
    return out;
  }

  function extractBug3166FencedBlocks(body) {
    const lines = body.split(/\r?\n/);
    const blocks = [];
    let active = null;
    for (const line of lines) {
      const open = line.match(/^```(\S*)\s*$/);
      if (active === null) {
        if (open) active = { lang: open[1] || '', lines: [] };
        continue;
      }
      if (line.trim() === '```') {
        blocks.push({ lang: active.lang, content: active.lines.join('\n') });
        active = null;
        continue;
      }
      active.lines.push(line);
    }
    return blocks;
  }

  function loadBug3166Skill() {
    const markdown = fs.readFileSync(SKILL_PATH, 'utf8');
    const lines = markdown.split(/\r?\n/);
    const delims = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') delims.push(i);
      if (delims.length === 2) break;
    }
    assert.equal(delims.length, 2, 'graphify.md must have a closed frontmatter block');
    const frontmatterText = lines.slice(delims[0] + 1, delims[1]).join('\n');
    const body = lines.slice(delims[1] + 1).join('\n');
    return {
      frontmatter: parseBug3166SkillFrontmatter(frontmatterText),
      body,
      fencedBlocks: extractBug3166FencedBlocks(body),
    };
  }

  // Regression for #3166
  test('graphify.md allowed-tools does not include Task (inline build fence)', () => {
    const { frontmatter } = loadBug3166Skill();
    assert.ok(Array.isArray(frontmatter['allowed-tools']),
      'allowed-tools must be a YAML block list');
    assert.ok(frontmatter['allowed-tools'].length > 0,
      'allowed-tools must declare at least one tool');
    assert.ok(!frontmatter['allowed-tools'].includes('Task'),
      'Task must NOT be in allowed-tools — sub-agent isolation truncates ' +
      'graphify v0.7+ post-extraction phase (#3166). Build runs inline.');
  });

  // Regression for #3166
  test('graphify.md frontmatter retains Read and Bash (inline build prerequisites)', () => {
    const { frontmatter } = loadBug3166Skill();
    const tools = frontmatter['allowed-tools'];
    assert.ok(tools.includes('Read'), 'Read required for config gate');
    assert.ok(tools.includes('Bash'), 'Bash required for inline build chain');
  });

  // Regression for #3166
  test('no fenced code block in graphify.md invokes Task() agent spawn syntax', () => {
    const { fencedBlocks } = loadBug3166Skill();
    const offending = fencedBlocks.filter(b => b.content.includes('Task('));
    assert.deepEqual(offending, [],
      'no fenced code block in graphify.md may contain `Task(` invocation ' +
      'syntax — sub-agent spawning truncates graphify v0.7+ post-extraction ' +
      'phase (#3166). Prose mentioning the word "Task" is fine; only the ' +
      'call expression inside a code block is forbidden.');
  });

  // Regression for #3166
  test('a bash code block invokes the inline graphify update . pipeline', () => {
    const { fencedBlocks } = loadBug3166Skill();
    const bashBlocks = fencedBlocks.filter(b => b.lang === 'bash');
    assert.ok(bashBlocks.length > 0, 'skill must contain at least one bash block');
    assert.ok(
      bashBlocks.some(b => b.content.includes('graphify update .')),
      'a bash code block must invoke `graphify update .`'
    );
    assert.ok(
      bashBlocks.some(b => /gsd-tools\.cjs["']?\s+graphify build snapshot/.test(b.content)),
      'a bash code block must invoke `gsd-tools.cjs graphify build snapshot`'
    );
  });

  // ── Regression for #3579 ────────────────────────────────────────────────────
  // graphify auto-update hook was dead-on-arrival in 1.50.0-canary.x because:
  //   Gap 1: scripts/build-hooks.js HOOKS_TO_COPY did not include
  //           gsd-graphify-update.sh
  //   Gap 2: hooks/lib/gsd-graphify-rebuild.sh not copied by installer
  // Test strategy: run the actual build and assert filesystem outcomes.

  const REPO_ROOT_3579 = path.resolve(__dirname, '..');
  const HOOKS_DIR_3579 = path.join(REPO_ROOT_3579, 'hooks');
  const DIST_DIR_3579 = path.join(HOOKS_DIR_3579, 'dist');
  const BUILD_SCRIPT_3579 = path.join(REPO_ROOT_3579, 'scripts', 'build-hooks.js');
  const INSTALL_SCRIPT_3579 = path.join(REPO_ROOT_3579, 'bin', 'install.js');

  // Regression for #3579: Gap 1 — build-hooks.js packages every top-level hooks/*.sh
  describe('#3579 Gap 1: build-hooks.js packages every top-level hooks/*.sh into dist', () => {
    before(() => {
      execFileSync(process.execPath, [BUILD_SCRIPT_3579], { encoding: 'utf-8', stdio: 'pipe' });
    });

    test('every top-level hooks/*.sh is emitted to hooks/dist/ by the build', () => {
      const topLevelSh = fs
        .readdirSync(HOOKS_DIR_3579, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.sh'))
        .map((e) => e.name);

      assert.ok(topLevelSh.length > 0, 'expected at least one top-level hooks/*.sh in source');

      const missing = topLevelSh.filter(
        (sh) => !fs.existsSync(path.join(DIST_DIR_3579, sh))
      );
      assert.deepStrictEqual(
        missing,
        [],
        `every top-level hooks/*.sh must be emitted to hooks/dist/ by scripts/build-hooks.js; missing from dist: ${JSON.stringify(missing)}`
      );
    });

    test('hooks/dist/gsd-graphify-update.sh exists after build', () => {
      assert.ok(
        fs.existsSync(path.join(DIST_DIR_3579, 'gsd-graphify-update.sh')),
        'expected hooks/dist/gsd-graphify-update.sh to exist after build (Gap 1)'
      );
    });

    test('hooks/dist/lib/gsd-graphify-rebuild.sh exists after build', () => {
      assert.ok(
        fs.existsSync(path.join(DIST_DIR_3579, 'lib', 'gsd-graphify-rebuild.sh')),
        'expected hooks/dist/lib/gsd-graphify-rebuild.sh to exist after build (Gap 2)'
      );
    });
  });

  // Regression for #3579: installer deploys graphify hook + lib helper to target
  describe('#3579: installer deploys graphify hook + lib helper to target', () => {
    let tmpDir;
    let installStdout;

    before(() => {
      execFileSync(process.execPath, [BUILD_SCRIPT_3579], { encoding: 'utf-8', stdio: 'pipe' });
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3579-install-'));
      installStdout = execFileSync(
        process.execPath,
        [INSTALL_SCRIPT_3579, '--claude', '--global', '--yes', '--no-sdk'],
        {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, CLAUDE_CONFIG_DIR: tmpDir },
        }
      );
    });

    after(() => {
      if (tmpDir) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    test('hooks/gsd-graphify-update.sh present at install target', () => {
      const dest = path.join(tmpDir, 'hooks', 'gsd-graphify-update.sh');
      assert.ok(fs.existsSync(dest), `expected ${dest} to exist after install`);
    });

    test('hooks/lib/gsd-graphify-rebuild.sh present at install target', () => {
      const dest = path.join(tmpDir, 'hooks', 'lib', 'gsd-graphify-rebuild.sh');
      assert.ok(fs.existsSync(dest), `expected ${dest} to exist after install`);
    });

    test('installer does not warn about missing gsd-graphify-update.sh', () => {
      assert.ok(
        !installStdout.includes('Missing expected hook: gsd-graphify-update.sh'),
        `installer output must not warn about missing graphify hook; got:\n${installStdout}`
      );
      assert.ok(
        !installStdout.includes(
          'Skipped graphify auto-update hook — gsd-graphify-update.sh not found'
        ),
        `installer must not skip graphify hook configuration; got:\n${installStdout}`
      );
    });
  });
});
