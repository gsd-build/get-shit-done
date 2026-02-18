// @ts-check
'use strict';

/**
 * create-plan command logic.
 *
 * Writes a PLAN.md file to the milestone folder with actions.
 * Auto-increments action IDs using the full DAG.
 * Updates MILESTONES.md hasPlan to YES.
 * Commits atomically when configured.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join, basename } = require('node:path');
const { parseFutureFile } = require('../artifacts/future');
const { parseMilestonesFile, writeMilestonesFile } = require('../artifacts/milestones');
const { writePlanFile } = require('../artifacts/plan');
const { loadActionsFromFolders } = require('./load-graph');
const { ensureMilestoneFolder } = require('../artifacts/milestone-folders');
const { DeclareDag } = require('../graph/engine');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Run the create-plan command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--milestone, --actions)
 * @returns {{ milestone: string, folder: string, actions: Array<{id: string, title: string, produces: string}>, committed: boolean, hash?: string } | { error: string }}
 */
function runCreatePlan(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');
  const actionsRaw = parseFlag(args, 'actions');

  if (!milestoneId) {
    return { error: 'Missing required flag: --milestone' };
  }
  if (!actionsRaw) {
    return { error: 'Missing required flag: --actions' };
  }

  let actionDefs;
  try {
    actionDefs = JSON.parse(actionsRaw);
    if (!Array.isArray(actionDefs)) {
      return { error: '--actions must be a JSON array of [{title, produces}]' };
    }
  } catch {
    return { error: '--actions must be valid JSON: ' + actionsRaw };
  }

  const planningDir = join(cwd, '.planning');
  const milestonesPath = join(planningDir, 'MILESTONES.md');
  const futurePath = join(planningDir, 'FUTURE.md');
  const projectName = basename(cwd);

  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  // Load existing data
  const futureContent = existsSync(futurePath)
    ? readFileSync(futurePath, 'utf-8')
    : '';
  const milestonesContent = existsSync(milestonesPath)
    ? readFileSync(milestonesPath, 'utf-8')
    : '';

  const declarations = parseFutureFile(futureContent);
  const { milestones } = parseMilestonesFile(milestonesContent);

  // Validate milestone exists
  const targetMs = milestones.find(m => m.id === milestoneId);
  if (!targetMs) {
    return { error: `Milestone not found: ${milestoneId}` };
  }

  // Build DAG to get next action ID
  const dag = new DeclareDag();
  for (const d of declarations) {
    dag.addNode(d.id, 'declaration', d.title, d.status || 'PENDING');
  }
  for (const m of milestones) {
    dag.addNode(m.id, 'milestone', m.title, m.status || 'PENDING');
  }

  // Load existing actions from all milestone folders
  const existingActions = loadActionsFromFolders(planningDir);
  for (const a of existingActions) {
    dag.addNode(a.id, 'action', a.title, a.status || 'PENDING');
  }

  // Auto-increment action IDs
  const actions = actionDefs.map(def => {
    const id = dag.nextId('action');
    dag.addNode(id, 'action', def.title, 'PENDING');
    return {
      id,
      title: def.title,
      status: 'PENDING',
      produces: def.produces || '',
    };
  });

  // Create/find milestone folder and write PLAN.md
  const folder = ensureMilestoneFolder(planningDir, milestoneId, targetMs.title);
  const planContent = writePlanFile(milestoneId, targetMs.title, targetMs.realizes, actions);
  const planPath = join(folder, 'PLAN.md');
  writeFileSync(planPath, planContent, 'utf-8');

  // Update MILESTONES.md: set hasPlan to true
  targetMs.hasPlan = true;
  const msOutput = writeMilestonesFile(milestones, projectName);
  writeFileSync(milestonesPath, msOutput, 'utf-8');

  // Compute relative paths for commit
  const relFolder = folder.replace(cwd + '/', '');
  const filesToCommit = [
    '.planning/MILESTONES.md',
    join(relFolder, 'PLAN.md'),
  ];

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: create plan for ${milestoneId} "${targetMs.title}"`,
      filesToCommit
    );
    committed = result.committed;
    hash = result.hash;
  }

  return {
    milestone: milestoneId,
    folder: relFolder,
    actions: actions.map(a => ({ id: a.id, title: a.title, produces: a.produces })),
    committed,
    hash,
  };
}

module.exports = { runCreatePlan };
