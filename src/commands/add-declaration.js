// @ts-check
'use strict';

/**
 * add-declaration command logic.
 *
 * Creates a new declaration (D-XX) in FUTURE.md with auto-incremented ID.
 * Maintains cross-reference integrity and commits atomically when configured.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, basename } = require('node:path');
const { parseFutureFile, writeFutureFile } = require('../artifacts/future');
const { DeclareDag } = require('../graph/engine');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Run the add-declaration command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--title, --statement)
 * @returns {{ id: string, title: string, statement: string, status: string, committed: boolean, hash?: string } | { error: string }}
 */
function runAddDeclaration(cwd, args) {
  const title = parseFlag(args, 'title');
  const statement = parseFlag(args, 'statement');

  if (!title) {
    return { error: 'Missing required flag: --title' };
  }
  if (!statement) {
    return { error: 'Missing required flag: --statement' };
  }

  const planningDir = join(cwd, '.planning');
  const futurePath = join(planningDir, 'FUTURE.md');
  const projectName = basename(cwd);

  // Ensure .planning/ exists
  if (!existsSync(planningDir)) {
    mkdirSync(planningDir, { recursive: true });
  }

  // Load existing declarations
  const futureContent = existsSync(futurePath)
    ? readFileSync(futurePath, 'utf-8')
    : '';
  const declarations = parseFutureFile(futureContent);

  // Build DAG to get next ID
  const dag = new DeclareDag();
  for (const d of declarations) {
    dag.addNode(d.id, 'declaration', d.title, d.status || 'PENDING');
  }
  const id = dag.nextId('declaration');

  // Append new declaration
  declarations.push({
    id,
    title,
    statement,
    status: 'PENDING',
    milestones: [],
  });

  // Write FUTURE.md
  const content = writeFutureFile(declarations, projectName);
  writeFileSync(futurePath, content, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: add ${id} "${title}"`,
      ['.planning/FUTURE.md']
    );
    committed = result.committed;
    hash = result.hash;
  }

  return { id, title, statement, status: 'PENDING', committed, hash };
}

module.exports = { runAddDeclaration };
