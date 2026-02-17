// @ts-check
'use strict';

/**
 * check-drift command logic.
 *
 * Detects orphaned nodes (milestones/actions with no causation path
 * to any declaration) and provides contextual reconnection suggestions.
 *
 * Zero runtime dependencies. CJS module.
 */

const { buildDagFromDisk } = require('./build-dag');
const { findOrphans } = require('../graph/engine');

/**
 * Find nearest possible parent connections for an orphaned node.
 * For orphaned actions: suggest milestones that have existing actions.
 * For orphaned milestones: suggest active declarations.
 *
 * @param {import('../graph/engine').DeclareDag} dag
 * @param {string} orphanId
 * @returns {Array<{type: string, target: string, targetTitle: string, reason: string}>}
 */
function findNearestConnections(dag, orphanId) {
  const node = dag.getNode(orphanId);
  if (!node) return [];

  const suggestions = [];

  if (node.type === 'action') {
    // Suggest milestones that already have actions connected
    const milestones = dag.getMilestones();
    for (const m of milestones) {
      const downstream = dag.getDownstream(m.id);
      const hasActions = downstream.some(d => d.type === 'action');
      if (hasActions) {
        suggestions.push({
          type: 'connect',
          target: m.id,
          targetTitle: m.title,
          reason: `Milestone already has ${downstream.filter(d => d.type === 'action').length} action(s)`,
        });
      }
      if (suggestions.length >= 3) break;
    }

    // If no milestones with actions, suggest any milestone
    if (suggestions.length === 0) {
      for (const m of milestones) {
        suggestions.push({
          type: 'connect',
          target: m.id,
          targetTitle: m.title,
          reason: 'Available milestone',
        });
        if (suggestions.length >= 3) break;
      }
    }
  } else if (node.type === 'milestone') {
    // Suggest active declarations
    const declarations = dag.getDeclarations();
    for (const d of declarations) {
      if (d.status === 'ACTIVE' || d.status === 'PENDING') {
        suggestions.push({
          type: 'connect',
          target: d.id,
          targetTitle: d.title,
          reason: `Declaration is ${d.status}`,
        });
      }
      if (suggestions.length >= 3) break;
    }

    // If no active/pending declarations, suggest any declaration
    if (suggestions.length === 0) {
      for (const d of declarations) {
        suggestions.push({
          type: 'connect',
          target: d.id,
          targetTitle: d.title,
          reason: 'Available declaration',
        });
        if (suggestions.length >= 3) break;
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Run the check-drift command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ hasDrift: boolean, driftedNodes: Array<{id: string, type: string, title: string, status: string, suggestions: Array<{type: string, target: string, targetTitle: string, reason: string}>}> } | { error: string }}
 */
function runCheckDrift(cwd) {
  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;
  const orphans = findOrphans(dag);

  const driftedNodes = orphans.map(orphan => ({
    id: orphan.id,
    type: orphan.type,
    title: orphan.title,
    status: orphan.status,
    suggestions: findNearestConnections(dag, orphan.id),
  }));

  return {
    hasDrift: driftedNodes.length > 0,
    driftedNodes,
  };
}

module.exports = { runCheckDrift };
