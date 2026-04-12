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
  // Build (Phase 3)
  graphifyBuild,
  writeSnapshot,
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

// ─── buildAdjacencyMap (TEST-01) ───────────────────────────────────────────

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
});

// ─── seedAndExpand (TEST-01) ───────────────────────────────────────────────

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

// ─── applyBudget (TEST-01) ─────────────────────────────────────────────────

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
});

// ─── graphifyBuild (BUILD-01, BUILD-02, TEST-02) ────────────────────────────

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

// ─── writeSnapshot (BUILD-01, TEST-02) ──────────────────────────────────────

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

// --- AGENT-03: Graceful degradation (graph absent) -------------------------

describe('AGENT-03 graceful degradation', () => {
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
