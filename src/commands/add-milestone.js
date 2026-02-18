// @ts-check
'use strict';

/**
 * add-milestone command logic.
 *
 * Creates a new milestone (M-XX) in MILESTONES.md with auto-incremented ID.
 * Links to realized declarations and updates FUTURE.md cross-references.
 * Commits atomically when configured.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, basename } = require('node:path');
const { parseFutureFile, writeFutureFile } = require('../artifacts/future');
const { parseMilestonesFile, writeMilestonesFile } = require('../artifacts/milestones');
const { DeclareDag } = require('../graph/engine');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Run the add-milestone command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--title, --realizes)
 * @returns {{ id: string, title: string, realizes: string[], status: string, committed: boolean, hash?: string } | { error: string }}
 */
function runAddMilestone(cwd, args) {
  const title = parseFlag(args, 'title');
  const realizesRaw = parseFlag(args, 'realizes');

  if (!title) {
    return { error: 'Missing required flag: --title' };
  }
  if (!realizesRaw) {
    return { error: 'Missing required flag: --realizes' };
  }

  const realizes = realizesRaw.split(',').map(s => s.trim()).filter(Boolean);

  const planningDir = join(cwd, '.planning');
  const futurePath = join(planningDir, 'FUTURE.md');
  const milestonesPath = join(planningDir, 'MILESTONES.md');
  const projectName = basename(cwd);

  // Ensure .planning/ exists
  if (!existsSync(planningDir)) {
    mkdirSync(planningDir, { recursive: true });
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

  // Build DAG from all nodes to get next ID and validate
  const dag = new DeclareDag();
  for (const d of declarations) {
    dag.addNode(d.id, 'declaration', d.title, d.status || 'PENDING');
  }
  for (const m of milestones) {
    dag.addNode(m.id, 'milestone', m.title, m.status || 'PENDING');
  }

  // Validate that all declaration IDs in --realizes exist
  for (const declId of realizes) {
    if (!dag.getNode(declId)) {
      return { error: `Declaration not found: ${declId}` };
    }
  }

  const id = dag.nextId('milestone');

  // Create new milestone
  milestones.push({
    id,
    title,
    status: 'PENDING',
    realizes,
    hasPlan: false,
  });

  // Update FUTURE.md: add new milestone ID to each realized declaration's milestones array
  for (const declId of realizes) {
    const decl = declarations.find(d => d.id === declId);
    if (decl && !decl.milestones.includes(id)) {
      decl.milestones.push(id);
    }
  }

  // Write both files atomically
  const futureOutput = writeFutureFile(declarations, projectName);
  writeFileSync(futurePath, futureOutput, 'utf-8');

  const milestonesOutput = writeMilestonesFile(milestones, projectName);
  writeFileSync(milestonesPath, milestonesOutput, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: add ${id} "${title}"`,
      ['.planning/FUTURE.md', '.planning/MILESTONES.md']
    );
    committed = result.committed;
    hash = result.hash;
  }

  return { id, title, realizes, status: 'PENDING', committed, hash };
}

module.exports = { runAddMilestone };
