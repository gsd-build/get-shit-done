// @ts-check
'use strict';

/**
 * generate-exec-plan command logic.
 *
 * CLI subcommand wrapping exec-plan generation.
 * Generates a GSD-style EXEC-PLAN-NN.md file in the milestone folder
 * for a given action.
 *
 * Zero runtime dependencies beyond existing internal modules. CJS module.
 */

const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { generateExecPlan } = require('../artifacts/exec-plan');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

/**
 * Run the generate-exec-plan command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ actionId: string, milestoneId: string, wave: number, outputPath: string, content: string } | { error: string }}
 */
function runGenerateExecPlan(cwd, args) {
  const actionId = parseFlag(args, 'action');
  if (!actionId) {
    return { error: 'Missing --action flag. Usage: generate-exec-plan --action A-XX --milestone M-XX' };
  }

  const milestoneId = parseFlag(args, 'milestone');
  if (!milestoneId) {
    return { error: 'Missing --milestone flag. Usage: generate-exec-plan --action A-XX --milestone M-XX' };
  }

  const waveStr = parseFlag(args, 'wave');
  const wave = waveStr ? parseInt(waveStr, 10) : 1;

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;

  // Validate action exists
  const action = dag.getNode(actionId);
  if (!action) {
    return { error: `Action not found: ${actionId}` };
  }
  if (action.type !== 'action') {
    return { error: `${actionId} is not an action (type: ${action.type})` };
  }

  // Validate milestone exists
  const milestone = dag.getNode(milestoneId);
  if (!milestone) {
    return { error: `Milestone not found: ${milestoneId}` };
  }
  if (milestone.type !== 'milestone') {
    return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
  }

  // Generate the exec plan content
  const content = generateExecPlan(dag, actionId, milestoneId, wave);

  // Find the milestone folder
  const planningDir = join(cwd, '.planning');
  const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
  if (!milestoneFolder) {
    return { error: `Milestone folder not found for ${milestoneId}. Run /declare:actions first to create the milestone plan.` };
  }

  // Derive filename: A-03 -> EXEC-PLAN-03.md
  const numericSuffix = actionId.split('-')[1];
  const filename = `EXEC-PLAN-${numericSuffix}.md`;
  const outputPath = join(milestoneFolder, filename);

  // Write the file
  writeFileSync(outputPath, content, 'utf-8');

  return {
    actionId,
    milestoneId,
    wave,
    outputPath,
    content: content.substring(0, 200),
  };
}

module.exports = { runGenerateExecPlan };
