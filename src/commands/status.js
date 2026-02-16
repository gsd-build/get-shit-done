// @ts-check
'use strict';

/**
 * /declare:status command logic.
 *
 * Loads the graph from FUTURE.md and MILESTONES.md, runs validation,
 * returns structured data for the slash command to render.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join, basename } = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseFutureFile } = require('../artifacts/future');
const { parseMilestonesFile } = require('../artifacts/milestones');
const { DeclareDag } = require('../graph/engine');

/**
 * Run the status command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ project: string, stats: object, validation: object, lastActivity: string, health: string } | { error: string }}
 */
function runStatus(cwd) {
  const planningDir = join(cwd, '.planning');

  // Check if project is initialized
  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  const projectName = basename(cwd);

  // Load and parse artifacts
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

  // Run validation and get stats
  const validation = dag.validate();
  const stats = dag.stats();

  // Get last activity from git
  let lastActivity = 'No activity recorded';
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%ci %s', '--', '.planning/'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (output) {
      lastActivity = output;
    }
  } catch {
    // Git not available or no commits -- use default
  }

  // Determine health
  let health = 'healthy';
  if (!validation.valid) {
    const hasCycle = validation.errors.some(e => e.type === 'cycle');
    const hasBroken = validation.errors.some(e => e.type === 'broken_edge');
    health = (hasCycle || hasBroken) ? 'errors' : 'warnings';
  }

  return {
    project: projectName,
    stats: {
      declarations: stats.declarations,
      milestones: stats.milestones,
      actions: stats.actions,
      edges: stats.edges,
      byStatus: stats.byStatus,
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors,
    },
    lastActivity,
    health,
  };
}

module.exports = { runStatus };
