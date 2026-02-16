// @ts-check
'use strict';

/**
 * add-action command logic.
 *
 * Creates a new action (A-XX) in MILESTONES.md with auto-incremented ID.
 * Links to caused milestones and updates their causedBy cross-references.
 * Commits atomically when configured.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, basename } = require('node:path');
const { parseMilestonesFile, writeMilestonesFile } = require('../artifacts/milestones');
const { DeclareDag } = require('../graph/engine');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Run the add-action command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--title, --causes)
 * @returns {{ id: string, title: string, causes: string[], status: string, committed: boolean, hash?: string } | { error: string }}
 */
function runAddAction(cwd, args) {
  const title = parseFlag(args, 'title');
  const causesRaw = parseFlag(args, 'causes');

  if (!title) {
    return { error: 'Missing required flag: --title' };
  }
  if (!causesRaw) {
    return { error: 'Missing required flag: --causes' };
  }

  const causes = causesRaw.split(',').map(s => s.trim()).filter(Boolean);

  const planningDir = join(cwd, '.planning');
  const milestonesPath = join(planningDir, 'MILESTONES.md');
  const projectName = basename(cwd);

  // Ensure .planning/ exists
  if (!existsSync(planningDir)) {
    mkdirSync(planningDir, { recursive: true });
  }

  // Load existing data
  const milestonesContent = existsSync(milestonesPath)
    ? readFileSync(milestonesPath, 'utf-8')
    : '';

  const { milestones, actions } = parseMilestonesFile(milestonesContent);

  // Build DAG from milestones and actions to get next ID and validate
  const dag = new DeclareDag();
  for (const m of milestones) {
    dag.addNode(m.id, 'milestone', m.title, m.status || 'PENDING');
  }
  for (const a of actions) {
    dag.addNode(a.id, 'action', a.title, a.status || 'PENDING');
  }

  // Validate that all milestone IDs in --causes exist
  for (const msId of causes) {
    if (!dag.getNode(msId)) {
      return { error: `Milestone not found: ${msId}` };
    }
  }

  const id = dag.nextId('action');

  // Create new action
  actions.push({
    id,
    title,
    status: 'PENDING',
    causes,
  });

  // Update causedBy on each caused milestone
  for (const msId of causes) {
    const ms = milestones.find(m => m.id === msId);
    if (ms && !ms.causedBy.includes(id)) {
      ms.causedBy.push(id);
    }
  }

  // Write MILESTONES.md
  const output = writeMilestonesFile(milestones, actions, projectName);
  writeFileSync(milestonesPath, output, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: add ${id} "${title}"`,
      ['.planning/MILESTONES.md']
    );
    committed = result.committed;
    hash = result.hash;
  }

  return { id, title, causes, status: 'PENDING', committed, hash };
}

module.exports = { runAddAction };
