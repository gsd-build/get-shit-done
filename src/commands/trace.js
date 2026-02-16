// @ts-check
'use strict';

/**
 * trace command logic.
 *
 * Traces why-chains from any node upward through the DAG to its
 * source declarations. Returns all paths for multi-path scenarios
 * (action serving multiple milestones/declarations).
 *
 * Zero runtime dependencies. CJS module.
 */

const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');

/**
 * Find all upward paths from a node to declarations.
 * Each path is an array of node objects from start to declaration.
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {string} startId
 * @returns {Array<Array<{id: string, type: string, title: string, status: string}>>}
 */
function traceUpward(dag, startId) {
  const startNode = dag.getNode(startId);
  if (!startNode) return [];

  // Declarations are endpoints -- no upstream
  if (startNode.type === 'declaration') {
    return [[{ id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status }]];
  }

  const upstream = dag.getUpstream(startId);

  if (upstream.length === 0) {
    // Orphan node -- return single-node path
    return [[{ id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status }]];
  }

  const paths = [];
  const startEntry = { id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status };

  for (const parent of upstream) {
    const parentPaths = traceUpward(dag, parent.id);
    for (const parentPath of parentPaths) {
      paths.push([startEntry, ...parentPath]);
    }
  }

  return paths;
}

/**
 * Format trace paths as a tree with Unicode connectors.
 * Plain text, no ANSI colors.
 *
 * @param {string} nodeId
 * @param {{id: string, type: string, title: string, status: string}} node
 * @param {Array<Array<{id: string, type: string, title: string, status: string}>>} paths
 * @returns {string}
 */
function formatTracePaths(nodeId, node, paths) {
  if (paths.length === 0) {
    return `${nodeId}: (not found)\n`;
  }

  const lines = [];
  lines.push(`${node.id}: ${node.title} [${node.status}]`);

  if (paths.length === 1 && paths[0].length === 1) {
    // Single node, no upstream
    lines.push('  (no upstream connections)');
    return lines.join('\n') + '\n';
  }

  // Group paths by first upstream node for tree rendering
  // Each path starts with the node itself, so upstream starts at index 1
  /** @type {Map<string, Array<Array<{id: string, type: string, title: string, status: string}>>>} */
  const byFirstUpstream = new Map();
  for (const path of paths) {
    if (path.length < 2) continue;
    const firstUp = path[1];
    if (!byFirstUpstream.has(firstUp.id)) {
      byFirstUpstream.set(firstUp.id, []);
    }
    byFirstUpstream.get(firstUp.id).push(path);
  }

  const upstreamIds = [...byFirstUpstream.keys()];

  for (let i = 0; i < upstreamIds.length; i++) {
    const upId = upstreamIds[i];
    const groupPaths = byFirstUpstream.get(upId);
    const isLast = i === upstreamIds.length - 1;
    const connector = isLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
    const indent = isLast ? '    ' : '\u2502   ';

    // First upstream node
    const upNode = groupPaths[0][1];
    lines.push(`${connector} ${upNode.id}: ${upNode.title} [${upNode.status}]`);

    // If paths go deeper (milestone -> declaration)
    /** @type {Map<string, {id: string, type: string, title: string, status: string}>} */
    const declNodes = new Map();
    for (const path of groupPaths) {
      if (path.length > 2) {
        const decl = path[2];
        declNodes.set(decl.id, decl);
      }
    }

    const declList = [...declNodes.values()];
    for (let j = 0; j < declList.length; j++) {
      const decl = declList[j];
      const declIsLast = j === declList.length - 1;
      const declConnector = declIsLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
      lines.push(`${indent}${declConnector} ${decl.id}: ${decl.title} [${decl.status}]`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Run the trace command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ nodeId: string, node: object, paths: Array, pathCount: number, truncated?: boolean, totalPaths?: number, formatted: string, outputFile?: string } | { nodes: object } | { error: string }}
 */
function runTrace(cwd, args) {
  const graphResult = buildDagFromDisk(cwd);
  if (graphResult.error) return graphResult;

  const { dag } = graphResult;

  // Parse args: nodeId from first positional or --node flag
  const nodeId = parseFlag(args, 'node') || (args[0] && !args[0].startsWith('--') ? args[0] : null);
  const outputFile = parseFlag(args, 'output');

  // If no nodeId, return node list grouped by type for interactive picker
  if (!nodeId) {
    const declarations = dag.getDeclarations().map(n => ({ id: n.id, title: n.title, status: n.status }));
    const milestones = dag.getMilestones().map(n => ({ id: n.id, title: n.title, status: n.status }));
    const actions = dag.getActions().map(n => ({ id: n.id, title: n.title, status: n.status }));

    return {
      nodes: {
        declarations,
        milestones,
        actions,
        total: declarations.length + milestones.length + actions.length,
      },
    };
  }

  // Validate nodeId exists
  const node = dag.getNode(nodeId);
  if (!node) {
    return { error: `Node not found: ${nodeId}. Use 'trace' without arguments to see available nodes.` };
  }

  // Trace upward paths
  let paths = traceUpward(dag, nodeId);
  let truncated = false;
  let totalPaths = paths.length;

  // Path limit
  if (paths.length > 20) {
    paths = paths.slice(0, 20);
    truncated = true;
  }

  const nodeInfo = { id: node.id, type: node.type, title: node.title, status: node.status };
  const formatted = formatTracePaths(nodeId, nodeInfo, paths);

  // Write to file if requested
  /** @type {string | undefined} */
  let resolvedOutput;
  if (outputFile) {
    resolvedOutput = resolve(cwd, outputFile);
    writeFileSync(resolvedOutput, formatted, 'utf-8');
  }

  const result = {
    nodeId,
    node: nodeInfo,
    paths,
    pathCount: paths.length,
    formatted,
  };

  if (truncated) {
    result.truncated = true;
    result.totalPaths = totalPaths;
  }

  if (resolvedOutput) {
    result.outputFile = resolvedOutput;
  }

  return result;
}

module.exports = { runTrace, traceUpward, formatTracePaths };
