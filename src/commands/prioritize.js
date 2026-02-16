// @ts-check
'use strict';

/**
 * prioritize command logic.
 *
 * Ranks actions by dependency weight (unblocking power).
 * Actions that contribute to more milestones and declarations
 * score higher. Supports filtering by declaration subtree.
 *
 * Zero runtime dependencies. CJS module.
 */

const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');

/**
 * Compute dependency weight for a single node.
 * Weight = number of unique nodes reachable via upward traversal (excluding self).
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {string} nodeId
 * @returns {number}
 */
function dependencyWeight(dag, nodeId) {
  const visited = new Set();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = /** @type {string} */ (queue.shift());
    if (visited.has(current)) continue;
    visited.add(current);

    const upstream = dag.getUpstream(current);
    for (const parent of upstream) {
      if (!visited.has(parent.id)) {
        queue.push(parent.id);
      }
    }
  }

  // Subtract 1 to exclude the node itself
  return visited.size - 1;
}

/**
 * Get all node IDs in a subtree rooted at the given node.
 * Traverses downward (toward actions).
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
 * Rank actions by dependency weight (descending).
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {string} [filterDeclarationId] - Optional: scope to a declaration's subtree
 * @returns {Array<{rank: number, id: string, title: string, score: number}>}
 */
function rankActions(dag, filterDeclarationId) {
  let actions = dag.getActions();

  if (filterDeclarationId) {
    const subtreeNodes = getSubtreeNodeIds(dag, filterDeclarationId);
    actions = actions.filter(a => subtreeNodes.has(a.id));
  }

  const ranked = actions.map(a => ({
    id: a.id,
    title: a.title,
    score: dependencyWeight(dag, a.id),
  }));

  // Sort descending by score, then by ID for stability
  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return ranked.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));
}

/**
 * Format ranked actions as plain text.
 *
 * @param {Array<{rank: number, id: string, title: string, score: number}>} ranking
 * @param {string | null} filter
 * @returns {string}
 */
function formatRanking(ranking, filter) {
  const lines = [];

  if (filter) {
    lines.push(`Priority ranking (filtered by ${filter}):`);
  } else {
    lines.push('Priority ranking (all actions):');
  }
  lines.push('');

  if (ranking.length === 0) {
    lines.push('  No actions found.');
    return lines.join('\n') + '\n';
  }

  for (const item of ranking) {
    lines.push(`  ${item.rank}. ${item.id}: ${item.title} (score: ${item.score})`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Run the prioritize command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ ranking: Array, filter: string | null, totalActions: number, formatted: string, outputFile?: string } | { error: string }}
 */
function runPrioritize(cwd, args) {
  const graphResult = buildDagFromDisk(cwd);
  if (graphResult.error) return graphResult;

  const { dag } = graphResult;

  const filterDeclaration = parseFlag(args, 'declaration');
  const outputFile = parseFlag(args, 'output');

  // Validate filter if provided
  if (filterDeclaration) {
    const filterNode = dag.getNode(filterDeclaration);
    if (!filterNode) {
      return { error: `Declaration not found: ${filterDeclaration}. Use a valid D-XX ID.` };
    }
    if (filterNode.type !== 'declaration') {
      return { error: `${filterDeclaration} is a ${filterNode.type}, not a declaration. Use --declaration with a D-XX ID.` };
    }
  }

  const ranking = rankActions(dag, filterDeclaration || undefined);
  const formatted = formatRanking(ranking, filterDeclaration);

  const result = {
    ranking,
    filter: filterDeclaration || null,
    totalActions: ranking.length,
    formatted,
  };

  if (outputFile) {
    const resolvedOutput = resolve(cwd, outputFile);
    writeFileSync(resolvedOutput, formatted, 'utf-8');
    result.outputFile = resolvedOutput;
  }

  return result;
}

module.exports = { runPrioritize, dependencyWeight, getSubtreeNodeIds, rankActions };
