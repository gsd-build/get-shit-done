'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { atomicWriteFileSync, execGit } = require('./core.cjs');

// ─── Config Gate ─────────────────────────────────────────────────────────────

/**
 * Check whether graphify is enabled in the project config.
 * Reads config.json directly via fs. Returns false by default
 * (when no config, no graphify key, or on error).
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {boolean}
 */
function isGraphifyEnabled(planningDir) {
  try {
    const configPath = path.join(planningDir, 'config.json');
    if (!fs.existsSync(configPath)) return false;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config && config.graphify && config.graphify.enabled === true) return true;
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * Return the standard disabled response object.
 * @returns {{ disabled: true, message: string }}
 */
function disabledResponse() {
  return { disabled: true, message: 'graphify is not enabled. Enable with: gsd-tools config-set graphify.enabled true' };
}

// ─── Subprocess Helper ───────────────────────────────────────────────────────

/**
 * Execute graphify CLI as a subprocess with proper env and timeout handling.
 *
 * @param {string} cwd - Working directory for the subprocess
 * @param {string[]} args - Arguments to pass to graphify
 * @param {{ timeout?: number }} [options={}] - Options (timeout in ms, default 30000)
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
/**
 * Frozen enum of typed reason codes for execGraphify failures (#2974).
 * Tests assert on result.reason instead of grepping stderr text.
 */
const GRAPHIFY_REASON = Object.freeze({
  OK: 'ok',
  ENOENT: 'graphify_not_found',
  TIMEOUT: 'graphify_timed_out',
  EXIT_NONZERO: 'graphify_exit_nonzero',
});

function execGraphify(cwd, args, options = {}) {
  const timeout = options.timeout ?? 30000;
  const result = childProcess.spawnSync('graphify', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  // ENOENT -- graphify binary not found on PATH
  if (result.error && result.error.code === 'ENOENT') {
    return {
      exitCode: 127,
      stdout: '',
      stderr: 'graphify not found on PATH',
      reason: GRAPHIFY_REASON.ENOENT,
    };
  }

  // Timeout -- subprocess killed via SIGTERM
  if (result.signal === 'SIGTERM') {
    return {
      exitCode: 124,
      stdout: (result.stdout ?? '').toString().trim(),
      stderr: 'graphify timed out after ' + timeout + 'ms',
      reason: GRAPHIFY_REASON.TIMEOUT,
      timeout_ms: timeout,
    };
  }

  const exitCode = result.status ?? 1;
  return {
    exitCode,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
    reason: exitCode === 0 ? GRAPHIFY_REASON.OK : GRAPHIFY_REASON.EXIT_NONZERO,
  };
}

// ─── Presence & Version ──────────────────────────────────────────────────────

/**
 * Check whether the graphify CLI binary is installed and accessible on PATH.
 * Uses --help (NOT --version, which graphify does not support).
 *
 * @returns {{ installed: boolean, message?: string }}
 */
function checkGraphifyInstalled() {
  const result = childProcess.spawnSync('graphify', ['--help'], {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 5000,
  });

  if (result.error) {
    return {
      installed: false,
      message: 'graphify is not installed.\n\nInstall with:\n  uv pip install graphifyy && graphify install',
    };
  }

  return { installed: true };
}

/**
 * Detect graphify version and check compatibility.
 * Tested range: >=0.4.0,<1.0
 *
 * Detection strategy:
 * 1. Try `graphify --version` (works for most CLI installations, incl. venv installs)
 * 2. Fall back to python3 importlib.metadata (legacy / system Python path)
 * 3. Return null version gracefully if both fail
 *
 * @returns {{ version: string|null, compatible: boolean|null, warning: string|null }}
 */
function checkGraphifyVersion() {
  // Strategy 1: try `graphify --version` directly (2s timeout -- fast path)
  const versionResult = childProcess.spawnSync('graphify', ['--version'], {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 2000,
  });

  let versionStr = null;

  if (!versionResult.error && versionResult.status === 0) {
    const raw = (versionResult.stdout || '').trim();
    // graphify --version may emit "graphify 0.4.23" or just "0.4.23"
    const match = raw.match(/(\d+\.\d+(?:\.\d+)*)/);
    if (match) {
      versionStr = match[1];
    }
  }

  // Strategy 2: fall back to python3 importlib.metadata
  if (!versionStr) {
    const pyResult = childProcess.spawnSync('python3', [
      '-c',
      'from importlib.metadata import version; print(version("graphifyy"))',
    ], {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 5000,
    });

    if (!pyResult.error && pyResult.status === 0 && pyResult.stdout && pyResult.stdout.trim()) {
      versionStr = pyResult.stdout.trim();
    }
  }

  if (!versionStr) {
    return { version: null, compatible: null, warning: 'Could not determine graphify version' };
  }

  const parts = versionStr.split('.').map(Number);

  if (parts.length < 2 || parts.some(isNaN)) {
    return { version: versionStr, compatible: null, warning: 'Could not parse version: ' + versionStr };
  }

  const compatible = parts[0] === 0 && parts[1] >= 4;
  const warning = compatible ? null : 'graphify version ' + versionStr + ' is outside tested range >=0.4.0,<1.0';

  return { version: versionStr, compatible, warning };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Safely read and parse a JSON file. Returns null on missing file or parse error.
 * Prevents crashes on malformed JSON (T-02-01 mitigation).
 *
 * @param {string} filePath - Absolute path to JSON file
 * @returns {object|null}
 */
function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_e) {
    return null;
  }
}

/**
 * Build a bidirectional adjacency map from graph nodes and edges.
 * Each node ID maps to an array of { target, edge } entries.
 * Bidirectional: both source->target and target->source are added (Pitfall 3).
 *
 * @param {{ nodes: object[], edges: object[] }} graph
 * @returns {Object.<string, Array<{ target: string, edge: object }>>}
 */
function buildAdjacencyMap(graph) {
  const adj = {};
  for (const node of (graph.nodes || [])) {
    adj[node.id] = [];
  }
  for (const edge of (graph.edges || graph.links || [])) {
    if (!adj[edge.source]) adj[edge.source] = [];
    if (!adj[edge.target]) adj[edge.target] = [];
    adj[edge.source].push({ target: edge.target, edge });
    adj[edge.target].push({ target: edge.source, edge });
  }
  return adj;
}

/**
 * Seed-then-expand query: find nodes matching term, then BFS-expand up to maxHops.
 * Matches on node label and description (case-insensitive substring, D-01).
 *
 * @param {{ nodes: object[], edges: object[] }} graph
 * @param {string} term - Search term
 * @param {number} [maxHops=2] - Maximum BFS hops from seed nodes
 * @returns {{ nodes: object[], edges: object[], seeds: Set<string> }}
 */
function seedAndExpand(graph, term, maxHops = 2) {
  const lowerTerm = term.toLowerCase();
  const nodeMap = Object.fromEntries((graph.nodes || []).map(n => [n.id, n]));
  const adj = buildAdjacencyMap(graph);

  // Seed: match on label and description (case-insensitive substring)
  const seeds = (graph.nodes || []).filter(n =>
    (n.label || '').toLowerCase().includes(lowerTerm) ||
    (n.description || '').toLowerCase().includes(lowerTerm)
  );

  // BFS expand from seeds
  const visitedNodes = new Set(seeds.map(n => n.id));
  const collectedEdges = [];
  const seenEdgeKeys = new Set();
  let frontier = seeds.map(n => n.id);

  for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
    const nextFrontier = [];
    for (const nodeId of frontier) {
      for (const entry of (adj[nodeId] || [])) {
        // Deduplicate edges by source::target::label key
        const edgeKey = `${entry.edge.source}::${entry.edge.target}::${entry.edge.label || ''}`;
        if (!seenEdgeKeys.has(edgeKey)) {
          seenEdgeKeys.add(edgeKey);
          collectedEdges.push(entry.edge);
        }
        if (!visitedNodes.has(entry.target)) {
          visitedNodes.add(entry.target);
          nextFrontier.push(entry.target);
        }
      }
    }
    frontier = nextFrontier;
  }

  const resultNodes = [...visitedNodes].map(id => nodeMap[id]).filter(Boolean);
  return { nodes: resultNodes, edges: collectedEdges, seeds: new Set(seeds.map(n => n.id)) };
}

/**
 * Apply token budget by dropping edges by confidence tier (D-04, D-05, D-06).
 * Token estimation: Math.ceil(JSON.stringify(obj).length / 4).
 * Drop order: AMBIGUOUS -> INFERRED -> EXTRACTED.
 *
 * @param {{ nodes: object[], edges: object[], seeds: Set<string> }} result
 * @param {number|null} budgetTokens - Max tokens, or null/falsy for unlimited
 * @returns {{ nodes: object[], edges: object[], trimmed: string|null, total_nodes: number, total_edges: number, term?: string }}
 */
function applyBudget(result, budgetTokens) {
  if (!budgetTokens) return result;

  const CONFIDENCE_ORDER = ['AMBIGUOUS', 'INFERRED', 'EXTRACTED'];
  let edges = [...result.edges];
  let omitted = 0;

  const estimateTokens = (obj) => Math.ceil(JSON.stringify(obj).length / 4);

  for (const tier of CONFIDENCE_ORDER) {
    if (estimateTokens({ nodes: result.nodes, edges }) <= budgetTokens) break;
    const before = edges.length;
    // Check both confidence and confidence_score field names (Open Question 1)
    edges = edges.filter(e => (e.confidence || e.confidence_score) !== tier);
    omitted += before - edges.length;
  }

  // Find unreachable nodes after edge removal
  const reachableNodes = new Set();
  for (const edge of edges) {
    reachableNodes.add(edge.source);
    reachableNodes.add(edge.target);
  }
  // Always keep seed nodes
  const nodes = result.nodes.filter(n => reachableNodes.has(n.id) || (result.seeds && result.seeds.has(n.id)));
  const unreachable = result.nodes.length - nodes.length;

  return {
    nodes,
    edges,
    trimmed: omitted > 0 ? `[${omitted} edges omitted, ${unreachable} nodes unreachable]` : null,
    total_nodes: nodes.length,
    total_edges: edges.length,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Query the knowledge graph for nodes matching a term, with optional budget cap.
 * Uses seed-then-expand BFS traversal (D-01).
 *
 * @param {string} cwd - Working directory
 * @param {string} term - Search term
 * @param {{ budget?: number|null }} [options={}]
 * @returns {object}
 */
function graphifyQuery(cwd, term, options = {}) {
  const planningDir = path.join(cwd, '.planning');
  if (!isGraphifyEnabled(planningDir)) return disabledResponse();

  const graphPath = path.join(planningDir, 'graphs', 'graph.json');
  if (!fs.existsSync(graphPath)) {
    return { error: 'No graph built yet. Run graphify build first.' };
  }

  const graph = safeReadJson(graphPath);
  if (!graph) {
    return { error: 'Failed to parse graph.json' };
  }

  let result = seedAndExpand(graph, term);

  if (options.budget) {
    result = applyBudget(result, options.budget);
  }

  return {
    term,
    nodes: result.nodes,
    edges: result.edges,
    total_nodes: result.nodes.length,
    total_edges: result.edges.length,
    trimmed: result.trimmed || null,
  };
}

/**
 * Strict 4-40 hex fence for graph.built_at_commit values (#3170). Anything
 * else (dashed, prose, empty) is treated as absent so a hostile graph.json
 * cannot smuggle a `--upload-pack=…` option into a `git` argv.
 */
const COMMIT_HASH_RE = /^[0-9a-f]{4,40}$/i;

/**
 * Read git HEAD for the project at `cwd`. Returns the full commit hash on
 * success, or null when cwd is not a git repo / `git` is not on PATH.
 */
function readGitHead(cwd) {
  const r = execGit(cwd, ['rev-parse', 'HEAD']);
  if (r.exitCode !== 0) return null;
  return r.stdout.trim() || null;
}

/**
 * Count commits between `from` and `to` (exclusive..inclusive, like
 * `git rev-list --count A..B`). Returns null when either ref is unreachable
 * or the cwd is not a git repo.
 */
function countCommitsBetween(cwd, from, to) {
  const r = execGit(cwd, ['rev-list', '--count', `${from}..${to}`]);
  if (r.exitCode !== 0) return null;
  const n = parseInt(r.stdout.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Return status information about the knowledge graph (STAT-01, STAT-02).
 *
 * Surfaces the graphify v0.7+ commit-staleness signal as four optional
 * fields when graph.built_at_commit is present and validly formatted
 * (#3170). Tri-state on commit_stale: null means "we don't know" (pre-v0.7
 * graph, no git, or unreachable commit), distinct from false ("known
 * fresh").
 *
 * @param {string} cwd - Working directory
 * @returns {object}
 */
function graphifyStatus(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!isGraphifyEnabled(planningDir)) return disabledResponse();

  const graphPath = path.join(planningDir, 'graphs', 'graph.json');
  if (!fs.existsSync(graphPath)) {
    return { exists: false, message: 'No graph built yet. Run graphify build to create one.' };
  }

  const stat = fs.statSync(graphPath);
  const graph = safeReadJson(graphPath);
  if (!graph) {
    return { error: 'Failed to parse graph.json' };
  }

  const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
  const age = Date.now() - stat.mtimeMs;

  // Commit-staleness signal (#3170). Validate before passing to git.
  const rawBuilt = (graph.built_at_commit || '').toString().trim();
  const builtAt = COMMIT_HASH_RE.test(rawBuilt) ? rawBuilt : null;
  const head = readGitHead(cwd);
  let commitsBehind = null;
  let commitStale = null;
  if (builtAt && head) {
    commitsBehind = countCommitsBetween(cwd, builtAt, head);
    if (commitsBehind !== null) commitStale = commitsBehind > 0;
  }

  return {
    exists: true,
    last_build: stat.mtime.toISOString(),
    node_count: (graph.nodes || []).length,
    edge_count: (graph.edges || graph.links || []).length,
    hyperedge_count: (graph.hyperedges || []).length,
    stale: age > STALE_MS,
    age_hours: Math.round(age / (60 * 60 * 1000)),
    built_at_commit: builtAt ? builtAt.slice(0, 7) : null,
    current_commit: head ? head.slice(0, 7) : null,
    commits_behind: commitsBehind,
    commit_stale: commitStale,
  };
}

/**
 * Compute topology-level diff between current graph and last build snapshot (D-07, D-08, D-09).
 *
 * @param {string} cwd - Working directory
 * @returns {object}
 */
function graphifyDiff(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!isGraphifyEnabled(planningDir)) return disabledResponse();

  const snapshotPath = path.join(planningDir, 'graphs', '.last-build-snapshot.json');
  const graphPath = path.join(planningDir, 'graphs', 'graph.json');

  if (!fs.existsSync(snapshotPath)) {
    return { no_baseline: true, message: 'No previous snapshot. Run graphify build first, then build again to generate a diff baseline.' };
  }

  if (!fs.existsSync(graphPath)) {
    return { error: 'No current graph. Run graphify build first.' };
  }

  const current = safeReadJson(graphPath);
  const snapshot = safeReadJson(snapshotPath);

  if (!current || !snapshot) {
    return { error: 'Failed to parse graph or snapshot file' };
  }

  // Diff nodes
  const currentNodeMap = Object.fromEntries((current.nodes || []).map(n => [n.id, n]));
  const snapshotNodeMap = Object.fromEntries((snapshot.nodes || []).map(n => [n.id, n]));

  const nodesAdded = Object.keys(currentNodeMap).filter(id => !snapshotNodeMap[id]);
  const nodesRemoved = Object.keys(snapshotNodeMap).filter(id => !currentNodeMap[id]);
  const nodesChanged = Object.keys(currentNodeMap).filter(id =>
    snapshotNodeMap[id] && JSON.stringify(currentNodeMap[id]) !== JSON.stringify(snapshotNodeMap[id])
  );

  // Diff edges (keyed by source+target+relation)
  const edgeKey = (e) => `${e.source}::${e.target}::${e.relation || e.label || ''}`;
  const currentEdgeMap = Object.fromEntries((current.edges || current.links || []).map(e => [edgeKey(e), e]));
  const snapshotEdgeMap = Object.fromEntries((snapshot.edges || snapshot.links || []).map(e => [edgeKey(e), e]));

  const edgesAdded = Object.keys(currentEdgeMap).filter(k => !snapshotEdgeMap[k]);
  const edgesRemoved = Object.keys(snapshotEdgeMap).filter(k => !currentEdgeMap[k]);
  const edgesChanged = Object.keys(currentEdgeMap).filter(k =>
    snapshotEdgeMap[k] && JSON.stringify(currentEdgeMap[k]) !== JSON.stringify(snapshotEdgeMap[k])
  );

  return {
    nodes: { added: nodesAdded.length, removed: nodesRemoved.length, changed: nodesChanged.length },
    edges: { added: edgesAdded.length, removed: edgesRemoved.length, changed: edgesChanged.length },
    timestamp: snapshot.timestamp || null,
  };
}

// ─── Build Pipeline (Phase 3) ───────────────────────────────────────────────

/**
 * Pre-flight checks for graphify build (BUILD-01, BUILD-02, D-09).
 * Does NOT invoke graphify -- returns structured JSON for the builder agent.
 *
 * @param {string} cwd - Working directory
 * @returns {object}
 */
function graphifyBuild(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!isGraphifyEnabled(planningDir)) return disabledResponse();

  const installed = checkGraphifyInstalled();
  if (!installed.installed) return { error: installed.message };

  const version = checkGraphifyVersion();

  // Ensure output directory exists (D-05)
  const graphsDir = path.join(planningDir, 'graphs');
  fs.mkdirSync(graphsDir, { recursive: true });

  // Read build timeout from config -- default 300s per D-02
  const config = safeReadJson(path.join(planningDir, 'config.json')) || {};
  const timeoutSec = (config.graphify && config.graphify.build_timeout) || 300;

  return {
    action: 'spawn_agent',
    graphs_dir: graphsDir,
    graphify_out: path.join(cwd, 'graphify-out'),
    timeout_seconds: timeoutSec,
    version: version.version,
    version_warning: version.warning,
    artifacts: ['graph.json', 'graph.html', 'GRAPH_REPORT.md'],
  };
}

/**
 * Write a diff snapshot after successful build (D-06).
 * Reads graph.json from .planning/graphs/ and writes .last-build-snapshot.json
 * using atomicWriteFileSync for crash safety.
 *
 * @param {string} cwd - Working directory
 * @returns {object}
 */
function writeSnapshot(cwd) {
  const graphPath = path.join(cwd, '.planning', 'graphs', 'graph.json');
  const graph = safeReadJson(graphPath);
  if (!graph) return { error: 'Cannot write snapshot: graph.json not parseable' };

  const snapshot = {
    version: 1,
    timestamp: new Date().toISOString(),
    nodes: graph.nodes || [],
    edges: graph.edges || graph.links || [],
  };

  const snapshotPath = path.join(cwd, '.planning', 'graphs', '.last-build-snapshot.json');
  atomicWriteFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  return {
    saved: true,
    timestamp: snapshot.timestamp,
    node_count: snapshot.nodes.length,
    edge_count: snapshot.edges.length,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Config gate
  isGraphifyEnabled,
  disabledResponse,
  // Subprocess
  execGraphify,
  GRAPHIFY_REASON,
  // Presence and version
  checkGraphifyInstalled,
  checkGraphifyVersion,
  // Query (Phase 2)
  graphifyQuery,
  safeReadJson,
  buildAdjacencyMap,
  seedAndExpand,
  applyBudget,
  // Status (Phase 2)
  graphifyStatus,
  // Diff (Phase 2)
  graphifyDiff,
  // Build (Phase 3)
  graphifyBuild,
  writeSnapshot,
};
