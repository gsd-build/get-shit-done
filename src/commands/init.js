// @ts-check
'use strict';

/**
 * /declare:init command logic.
 *
 * Initializes a Declare project with .planning/ directory containing:
 * - FUTURE.md (empty declarations template)
 * - MILESTONES.md (empty milestones/actions template)
 * - config.json (default settings)
 *
 * Re-init behavior: detects existing files, reports them without overwriting.
 * The slash command prompt handles user interaction about keep/replace.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { join, basename } = require('node:path');
const { writeFutureFile } = require('../artifacts/future');
const { writeMilestonesFile } = require('../artifacts/milestones');
const { commitPlanningDocs } = require('../git/commit');

/**
 * Run the init command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (first arg = optional project name)
 * @returns {{ initialized: boolean, created: string[], existing: string[], committed: boolean, hash?: string, error?: string }}
 */
function runInit(cwd, args) {
  const projectName = (args && args[0]) || basename(cwd);
  const planningDir = join(cwd, '.planning');

  const milestonesDir = join(planningDir, 'milestones');

  const artifacts = [
    { name: 'FUTURE.md', path: join(planningDir, 'FUTURE.md') },
    { name: 'MILESTONES.md', path: join(planningDir, 'MILESTONES.md') },
    { name: 'config.json', path: join(planningDir, 'config.json') },
  ];

  const created = [];
  const existing = [];

  // Create .planning/ and milestones/ directories if needed
  if (!existsSync(planningDir)) {
    mkdirSync(planningDir, { recursive: true });
  }
  if (!existsSync(milestonesDir)) {
    mkdirSync(milestonesDir, { recursive: true });
  }

  // Check each artifact: create if missing, report if existing
  for (const artifact of artifacts) {
    if (existsSync(artifact.path)) {
      existing.push(artifact.name);
    } else {
      // Create the artifact
      let content;
      switch (artifact.name) {
        case 'FUTURE.md':
          content = writeFutureFile([], projectName);
          break;
        case 'MILESTONES.md':
          content = writeMilestonesFile([], projectName);
          break;
        case 'config.json':
          content = JSON.stringify({ commit_docs: true }, null, 2) + '\n';
          break;
      }
      writeFileSync(artifact.path, content, 'utf-8');
      created.push(artifact.name);
    }
  }

  // If nothing was created, still report success
  if (created.length === 0) {
    return {
      initialized: true,
      created,
      existing,
      committed: false,
    };
  }

  // Atomic git commit of all created files
  const filesToCommit = created.map(name => join('.planning', name));
  const commitResult = commitPlanningDocs(
    cwd,
    `docs(declare): initialize project "${projectName}"`,
    filesToCommit
  );

  return {
    initialized: true,
    created,
    existing,
    committed: commitResult.committed,
    hash: commitResult.hash,
  };
}

module.exports = { runInit };
