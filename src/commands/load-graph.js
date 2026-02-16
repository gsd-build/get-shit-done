// @ts-check
'use strict';

/**
 * load-graph command logic.
 *
 * Loads the full Declare graph from FUTURE.md and MILESTONES.md,
 * reconstructs the DAG, and returns structured JSON with stats and validation.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseFutureFile } = require('../artifacts/future');
const { parseMilestonesFile } = require('../artifacts/milestones');
const { DeclareDag } = require('../graph/engine');

/**
 * Run the load-graph command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ declarations: Array, milestones: Array, actions: Array, stats: object, validation: object } | { error: string }}
 */
function runLoadGraph(cwd) {
  const planningDir = join(cwd, '.planning');

  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  const futurePath = join(planningDir, 'FUTURE.md');
  const milestonesPath = join(planningDir, 'MILESTONES.md');

  const futureContent = existsSync(futurePath)
    ? readFileSync(futurePath, 'utf-8')
    : '';
  const milestonesContent = existsSync(milestonesPath)
    ? readFileSync(milestonesPath, 'utf-8')
    : '';

  const declarations = parseFutureFile(futureContent);
  const { milestones, actions } = parseMilestonesFile(milestonesContent);

  // Reconstruct the DAG
  const dag = new DeclareDag();

  for (const d of declarations) {
    dag.addNode(d.id, 'declaration', d.title, d.status || 'PENDING');
  }
  for (const m of milestones) {
    dag.addNode(m.id, 'milestone', m.title, m.status || 'PENDING');
  }
  for (const a of actions) {
    dag.addNode(a.id, 'action', a.title, a.status || 'PENDING');
  }

  // Add edges: milestone->declaration (realizes), action->milestone (causes)
  for (const m of milestones) {
    for (const declId of m.realizes) {
      if (dag.getNode(declId)) {
        dag.addEdge(m.id, declId);
      }
    }
    for (const actionId of m.causedBy) {
      if (dag.getNode(actionId)) {
        dag.addEdge(actionId, m.id);
      }
    }
  }

  for (const a of actions) {
    for (const milestoneId of a.causes) {
      if (dag.getNode(milestoneId)) {
        dag.addEdge(a.id, milestoneId);
      }
    }
  }

  return {
    declarations,
    milestones,
    actions,
    stats: dag.stats(),
    validation: dag.validate(),
  };
}

module.exports = { runLoadGraph };
