// @ts-check
'use strict';

/**
 * compute-waves command logic.
 *
 * Computes execution waves for a milestone's non-DONE actions.
 * In the current v1 model, all sibling actions within a milestone
 * form a single wave (no inter-action edges).
 *
 * Zero runtime dependencies beyond existing internal modules. CJS module.
 */

const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { isCompleted } = require('../graph/engine');

/**
 * Run the compute-waves command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ milestoneId: string, milestoneTitle: string, declarations: Array<{id: string, title: string}>, waves: Array<{wave: number, actions: Array<{id: string, title: string, status: string, produces: string}>}>, totalActions: number, allDone: boolean } | { error: string }}
 */
function runComputeWaves(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');
  if (!milestoneId) {
    return { error: 'Missing --milestone flag. Usage: compute-waves --milestone M-XX' };
  }

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;

  const milestone = dag.getNode(milestoneId);
  if (!milestone) {
    return { error: `Milestone not found: ${milestoneId}` };
  }
  if (milestone.type !== 'milestone') {
    return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
  }

  // Get non-DONE actions for this milestone
  const actions = dag.getDownstream(milestoneId)
    .filter(n => n.type === 'action' && !isCompleted(n.status));

  if (actions.length === 0) {
    return {
      milestoneId,
      milestoneTitle: milestone.title,
      declarations: [],
      waves: [],
      totalActions: 0,
      allDone: true,
    };
  }

  // In current v1 model, all sibling actions form one wave
  const wave1Actions = actions
    .map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      produces: a.metadata.produces || '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Get upstream declarations for trace context enrichment
  const upstream = dag.getUpstream(milestoneId);
  const declarations = upstream
    .filter(n => n.type === 'declaration')
    .map(n => ({ id: n.id, title: n.title }));

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    declarations,
    waves: [{ wave: 1, actions: wave1Actions }],
    totalActions: wave1Actions.length,
    allDone: false,
  };
}

module.exports = { runComputeWaves };
