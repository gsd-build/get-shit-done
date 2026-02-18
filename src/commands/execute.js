// @ts-check
'use strict';

/**
 * execute command logic.
 *
 * Data provider for the /declare:execute slash command.
 * Returns comprehensive milestone execution data: actions, waves,
 * trace context, and milestone folder path — everything the
 * orchestrator needs in one call.
 *
 * Zero runtime dependencies beyond existing internal modules. CJS module.
 */

const { join } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { isCompleted } = require('../graph/engine');

/**
 * Run the execute command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ milestoneId: string, milestoneTitle: string, status: string, declarations: Array<{id: string, title: string}>, allActions: Array<{id: string, title: string, status: string, produces: string}>, pendingActions: Array<{id: string, title: string, status: string, produces: string}>, waves: Array<{wave: number, actions: Array<{id: string, title: string, status: string, produces: string}>}>, totalActions: number, pendingCount: number, doneCount: number, allDone: boolean, milestoneFolderPath: string | null } | { milestones: Array<{id: string, title: string, status: string, actionCount: number, doneCount: number}> } | { error: string }}
 */
function runExecute(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag, milestones } = graphResult;

  // If no milestone specified, return milestone picker data
  if (!milestoneId) {
    const milestonePicker = milestones.map(m => {
      const actions = dag.getDownstream(m.id).filter(n => n.type === 'action');
      const doneCount = actions.filter(a => isCompleted(a.status)).length;
      return {
        id: m.id,
        title: m.title,
        status: m.status,
        actionCount: actions.length,
        doneCount,
      };
    });
    return { milestones: milestonePicker };
  }

  // Validate milestone exists
  const milestone = dag.getNode(milestoneId);
  if (!milestone) {
    return { error: `Milestone not found: ${milestoneId}` };
  }
  if (milestone.type !== 'milestone') {
    return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
  }

  // Get all actions for this milestone
  const allActionsRaw = dag.getDownstream(milestoneId)
    .filter(n => n.type === 'action');

  const allActions = allActionsRaw
    .map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      produces: a.metadata.produces || '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const pendingActions = allActions.filter(a => !isCompleted(a.status));
  const doneCount = allActions.length - pendingActions.length;

  // Compute waves (v1: all pending sibling actions form one wave)
  /** @type {Array<{wave: number, actions: Array<{id: string, title: string, status: string, produces: string}>}>} */
  const waves = [];
  if (pendingActions.length > 0) {
    waves.push({ wave: 1, actions: pendingActions });
  }

  // Get upstream declarations for trace context
  const upstream = dag.getUpstream(milestoneId);
  const declarations = upstream
    .filter(n => n.type === 'declaration')
    .map(n => ({ id: n.id, title: n.title }));

  // Find milestone folder path
  const planningDir = join(cwd, '.planning');
  const milestoneFolderPath = findMilestoneFolder(planningDir, milestoneId);

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    status: milestone.status,
    declarations,
    allActions,
    pendingActions,
    waves,
    totalActions: allActions.length,
    pendingCount: pendingActions.length,
    doneCount,
    allDone: pendingActions.length === 0,
    milestoneFolderPath,
  };
}

module.exports = { runExecute };
