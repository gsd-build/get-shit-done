'use strict';

// Tests for graphify.cjs — query describe block.
// Split from the consolidated 2336-LOC file. Refs #3761.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

const {
  graphifyQuery,
  graphifyStatus,
  graphifyDiff,
  safeReadJson,
  buildAdjacencyMap,
  seedAndExpand,
  applyBudget,
} = require('../get-shit-done/bin/lib/graphify.cjs');

const {
  enableGraphify,
  writeGraphJson,
  writeSnapshotJson,
  SAMPLE_GRAPH,
} = require('./helpers/graphify.cjs');

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
