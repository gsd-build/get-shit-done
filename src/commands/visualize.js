// @ts-check
'use strict';

/**
 * visualize command logic.
 *
 * Renders the full 3-layer DAG as a top-down ASCII tree with
 * Unicode box-drawing connectors and status markers.
 * Supports subtree scoping via optional declaration/milestone ID.
 *
 * Zero runtime dependencies. CJS module.
 */

const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');

/**
 * Get all node IDs in a subtree rooted at the given node.
 * Traverses downward (toward actions) via BFS.
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {string} rootId
 * @returns {Set<string>}
 */
function getSubtreeNodeIds(dag, rootId) {
  const visited = new Set();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = /** @type {string} */ (queue.shift());
    if (visited.has(current)) continue;
    visited.add(current);

    const downstream = dag.getDownstream(current);
    for (const child of downstream) {
      if (!visited.has(child.id)) {
        queue.push(child.id);
      }
    }
  }

  return visited;
}

/**
 * Determine the status marker for a node.
 *
 * - DONE -> checkmark
 * - ACTIVE -> >
 * - PENDING with at least one non-DONE child -> blocked (!)
 * - PENDING with no children or all children DONE -> pending (circle)
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {{id: string, type: string, title: string, status: string}} node
 * @returns {string}
 */
function statusMarker(dag, node) {
  if (node.status === 'DONE') return '[\u2713]';
  if (node.status === 'ACTIVE') return '[>]';

  // PENDING -- check if blocked
  const children = dag.getDownstream(node.id);
  if (children.length > 0) {
    const hasNonDoneChild = children.some(c => c.status !== 'DONE');
    if (hasNonDoneChild) return '[!]';
  }

  return '[\u25CB]';
}

/**
 * Sort nodes by ID for stable output.
 * @param {Array<{id: string}>} nodes
 * @returns {Array<{id: string}>}
 */
function sortById(nodes) {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Build tree data structure for the visualization.
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {Set<string> | null} scopeFilter - If non-null, only include nodes in this set
 * @returns {Array<{node: {id: string, type: string, title: string, status: string, marker: string}, children: Array}>}
 */
function buildTreeData(dag, scopeFilter) {
  const declarations = sortById(dag.getDeclarations());
  const tree = [];

  for (const decl of declarations) {
    if (scopeFilter && !scopeFilter.has(decl.id)) continue;

    const declEntry = {
      node: { id: decl.id, type: decl.type, title: decl.title, status: decl.status, marker: statusMarker(dag, decl) },
      children: [],
    };

    const milestones = sortById(dag.getDownstream(decl.id));
    for (const ms of milestones) {
      if (scopeFilter && !scopeFilter.has(ms.id)) continue;

      const msEntry = {
        node: { id: ms.id, type: ms.type, title: ms.title, status: ms.status, marker: statusMarker(dag, ms) },
        children: [],
      };

      const actions = sortById(dag.getDownstream(ms.id));
      for (const act of actions) {
        if (scopeFilter && !scopeFilter.has(act.id)) continue;

        msEntry.children.push({
          node: { id: act.id, type: act.type, title: act.title, status: act.status, marker: statusMarker(dag, act) },
          children: [],
        });
      }

      declEntry.children.push(msEntry);
    }

    tree.push(declEntry);
  }

  // If scope starts at a milestone (not a declaration), render milestone as root
  if (tree.length === 0 && scopeFilter) {
    const milestones = sortById(dag.getMilestones());
    for (const ms of milestones) {
      if (!scopeFilter.has(ms.id)) continue;

      const msEntry = {
        node: { id: ms.id, type: ms.type, title: ms.title, status: ms.status, marker: statusMarker(dag, ms) },
        children: [],
      };

      const actions = sortById(dag.getDownstream(ms.id));
      for (const act of actions) {
        if (scopeFilter && !scopeFilter.has(act.id)) continue;

        msEntry.children.push({
          node: { id: act.id, type: act.type, title: act.title, status: act.status, marker: statusMarker(dag, act) },
          children: [],
        });
      }

      tree.push(msEntry);
    }
  }

  return tree;
}

/**
 * Render tree data as formatted ASCII text with Unicode connectors.
 *
 * @param {Array<{node: {id: string, marker: string, title: string}, children: Array}>} tree
 * @returns {string}
 */
function formatTree(tree) {
  const lines = [];

  for (const root of tree) {
    lines.push(`${root.node.id}: ${root.node.title} ${root.node.marker}`);
    renderChildren(root.children, '', lines);
    lines.push(''); // blank line between top-level roots
  }

  // Remove trailing blank line
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n') + '\n';
}

/**
 * Recursively render children with tree connectors.
 *
 * @param {Array<{node: {id: string, marker: string, title: string}, children: Array}>} children
 * @param {string} prefix - Indentation prefix for this level
 * @param {string[]} lines - Output accumulator
 */
function renderChildren(children, prefix, lines) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isLast = i === children.length - 1;
    const connector = isLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
    const childPrefix = isLast ? `${prefix}    ` : `${prefix}\u2502   `;

    lines.push(`${prefix}${connector} ${child.node.id}: ${child.node.title} ${child.node.marker}`);

    if (child.children.length > 0) {
      renderChildren(child.children, childPrefix, lines);
    }
  }
}

/**
 * Run the visualize command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ scope: string, tree: Array, formatted: string, stats: {declarations: number, milestones: number, actions: number}, outputFile?: string } | { error: string }}
 */
function runVisualize(cwd, args) {
  const graphResult = buildDagFromDisk(cwd);
  if (graphResult.error) return graphResult;

  const { dag } = graphResult;

  // Parse args
  const scopeId = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const outputFile = parseFlag(args, 'output');

  // Validate scope if provided
  /** @type {Set<string> | null} */
  let scopeFilter = null;
  if (scopeId) {
    const scopeNode = dag.getNode(scopeId);
    if (!scopeNode) {
      return { error: `Node not found: ${scopeId}. Use a valid D-XX or M-XX ID.` };
    }
    scopeFilter = getSubtreeNodeIds(dag, scopeId);
  }

  const tree = buildTreeData(dag, scopeFilter);
  const formatted = formatTree(tree);

  // Count stats from the tree
  let declCount = 0;
  let msCount = 0;
  let actCount = 0;

  function countNodes(nodes) {
    for (const entry of nodes) {
      const type = entry.node.type;
      if (type === 'declaration') declCount++;
      else if (type === 'milestone') msCount++;
      else if (type === 'action') actCount++;
      countNodes(entry.children);
    }
  }
  countNodes(tree);

  const result = {
    scope: scopeId || 'full',
    tree,
    formatted,
    stats: { declarations: declCount, milestones: msCount, actions: actCount },
  };

  if (outputFile) {
    const resolvedOutput = resolve(cwd, outputFile);
    writeFileSync(resolvedOutput, formatted, 'utf-8');
    result.outputFile = resolvedOutput;
  }

  return result;
}

module.exports = { runVisualize, getSubtreeNodeIds, buildTreeData, formatTree, statusMarker };
