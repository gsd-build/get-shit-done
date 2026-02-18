// @ts-check
'use strict';

/**
 * add-milestones-batch command logic.
 *
 * Creates multiple milestones in a single call with one git commit.
 * Accepts JSON array via --json flag: [{ "title": "...", "realizes": "D-01" }, ...]
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
 * @typedef {{ title: string, realizes: string }} MilestoneInput
 * @typedef {{ id: string, title: string, realizes: string[], status: string }} MilestoneResult
 */

/**
 * Run the add-milestones-batch command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--json)
 * @returns {{ milestones: MilestoneResult[], committed: boolean, hash?: string } | { error: string }}
 */
function runAddMilestonesBatch(cwd, args) {
  const jsonRaw = parseFlag(args, 'json');

  if (!jsonRaw) {
    return { error: 'Missing required flag: --json (JSON array of { title, realizes })' };
  }

  /** @type {MilestoneInput[]} */
  let inputs;
  try {
    inputs = JSON.parse(jsonRaw);
  } catch {
    return { error: 'Invalid JSON in --json flag' };
  }

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { error: '--json must be a non-empty array of { title, realizes }' };
  }

  for (let i = 0; i < inputs.length; i++) {
    if (!inputs[i].title) return { error: `Item ${i}: missing title` };
    if (!inputs[i].realizes) return { error: `Item ${i}: missing realizes` };
  }

  const planningDir = join(cwd, '.planning');
  const futurePath = join(planningDir, 'FUTURE.md');
  const milestonesPath = join(planningDir, 'MILESTONES.md');
  const projectName = basename(cwd);

  if (!existsSync(planningDir)) {
    mkdirSync(planningDir, { recursive: true });
  }

  const futureContent = existsSync(futurePath)
    ? readFileSync(futurePath, 'utf-8')
    : '';
  const milestonesContent = existsSync(milestonesPath)
    ? readFileSync(milestonesPath, 'utf-8')
    : '';

  const declarations = parseFutureFile(futureContent);
  const { milestones } = parseMilestonesFile(milestonesContent);

  // Build DAG for ID generation and validation
  const dag = new DeclareDag();
  for (const d of declarations) {
    dag.addNode(d.id, 'declaration', d.title, d.status || 'PENDING');
  }
  for (const m of milestones) {
    dag.addNode(m.id, 'milestone', m.title, m.status || 'PENDING');
  }

  // Validate all realizes references
  for (let i = 0; i < inputs.length; i++) {
    const realizes = inputs[i].realizes.split(',').map(s => s.trim()).filter(Boolean);
    for (const declId of realizes) {
      if (!dag.getNode(declId)) {
        return { error: `Item ${i}: declaration not found: ${declId}` };
      }
    }
  }

  // Create all milestones
  /** @type {MilestoneResult[]} */
  const results = [];

  for (const input of inputs) {
    const realizes = input.realizes.split(',').map(s => s.trim()).filter(Boolean);
    const id = dag.nextId('milestone');

    dag.addNode(id, 'milestone', input.title, 'PENDING');

    milestones.push({
      id,
      title: input.title,
      status: 'PENDING',
      realizes,
      hasPlan: false,
    });

    // Update FUTURE.md cross-references
    for (const declId of realizes) {
      const decl = declarations.find(d => d.id === declId);
      if (decl && !decl.milestones.includes(id)) {
        decl.milestones.push(id);
      }
    }

    results.push({ id, title: input.title, realizes, status: 'PENDING' });
  }

  // Write both files once
  const futureOutput = writeFutureFile(declarations, projectName);
  writeFileSync(futurePath, futureOutput, 'utf-8');

  const milestonesOutput = writeMilestonesFile(milestones, projectName);
  writeFileSync(milestonesPath, milestonesOutput, 'utf-8');

  // Single commit for all milestones
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const ids = results.map(r => r.id).join(', ');
    const result = commitPlanningDocs(
      cwd,
      `declare: add milestones ${ids}`,
      ['.planning/FUTURE.md', '.planning/MILESTONES.md']
    );
    committed = result.committed;
    hash = result.hash;
  }

  return { milestones: results, committed, hash };
}

module.exports = { runAddMilestonesBatch };
