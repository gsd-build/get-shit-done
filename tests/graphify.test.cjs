'use strict';

// Tests for graphify.cjs — status and build describe blocks.
// Split from the consolidated 2336-LOC file. Refs #3761.
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
  GRAPHIFY_REASON,
  checkGraphifyInstalled,
  checkGraphifyVersion,
  graphifyStatus,
  // Build (Phase 3)
  graphifyBuild,
  writeSnapshot,
} = require('../get-shit-done/bin/lib/graphify.cjs');

const {
  enableGraphify,
  writeGraphJson,
  SAMPLE_GRAPH,
} = require('./helpers/graphify.cjs');

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
