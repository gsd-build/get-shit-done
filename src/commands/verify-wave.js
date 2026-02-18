// @ts-check
'use strict';

/**
 * verify-wave command logic.
 *
 * Post-wave upward verification checks. Verifies that completed actions'
 * produces artifacts exist on disk and detects milestone completability.
 *
 * Zero runtime dependencies beyond existing internal modules. CJS module.
 */

const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { traceUpward } = require('./trace');
const { isCompleted } = require('../graph/engine');

/**
 * Check if a produces value looks like a file path (vs a description).
 *
 * @param {string} produces - The produces field value
 * @returns {boolean}
 */
function looksLikeFilePath(produces) {
  if (!produces || produces.trim() === '') return false;
  // Heuristic: file paths contain slashes or dots with extensions
  return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
}

/**
 * Run the verify-wave command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ milestoneId: string, milestoneTitle: string, completedActions: Array<{id: string, title: string, producesExist: boolean | null}>, milestoneCompletable: boolean, traceContext: { declarations: Array<{id: string, title: string}>, whyChain: string }, allChecks: Array<{actionId: string, check: string, passed: boolean}>, passed: boolean } | { error: string }}
 */
function runVerifyWave(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');
  if (!milestoneId) {
    return { error: 'Missing --milestone flag. Usage: verify-wave --milestone M-XX --actions "A-01,A-02"' };
  }

  const actionsStr = parseFlag(args, 'actions');
  if (!actionsStr) {
    return { error: 'Missing --actions flag. Usage: verify-wave --milestone M-XX --actions "A-01,A-02"' };
  }

  const completedActionIds = actionsStr.split(',').map(s => s.trim()).filter(Boolean);

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;

  // Validate milestone
  const milestone = dag.getNode(milestoneId);
  if (!milestone) {
    return { error: `Milestone not found: ${milestoneId}` };
  }
  if (milestone.type !== 'milestone') {
    return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
  }

  /** @type {Array<{actionId: string, check: string, passed: boolean}>} */
  const allChecks = [];

  /** @type {Array<{id: string, title: string, producesExist: boolean | null}>} */
  const completedActions = [];

  // Verify each completed action
  for (const actionId of completedActionIds) {
    const action = dag.getNode(actionId);

    // Check 1: Action exists in DAG
    allChecks.push({
      actionId,
      check: 'action-exists',
      passed: !!action,
    });

    if (!action) {
      completedActions.push({ id: actionId, title: '(not found)', producesExist: null });
      continue;
    }

    // Check 2: Artifact existence
    const produces = action.metadata.produces || '';
    if (looksLikeFilePath(produces)) {
      const filePath = resolve(cwd, produces);
      const exists = existsSync(filePath);
      allChecks.push({
        actionId,
        check: 'produces-exist',
        passed: exists,
      });
      completedActions.push({ id: actionId, title: action.title, producesExist: exists });
    } else {
      // No file path to check -- mark as no-file-check (pass)
      allChecks.push({
        actionId,
        check: 'produces-exist',
        passed: true,
      });
      completedActions.push({ id: actionId, title: action.title, producesExist: null });
    }
  }

  // Compute milestone completability
  const allMilestoneActions = dag.getDownstream(milestoneId)
    .filter(n => n.type === 'action');

  const milestoneCompletable = allMilestoneActions.every(a =>
    isCompleted(a.status) || completedActionIds.includes(a.id)
  );

  // Build trace context for AI review
  const paths = traceUpward(dag, milestoneId);
  /** @type {Map<string, string>} */
  const declMap = new Map();
  for (const path of paths) {
    for (const node of path) {
      if (node.type === 'declaration') {
        declMap.set(node.id, node.title);
      }
    }
  }

  const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
  const declStrings = declarations.map(d => `${d.id}: ${d.title}`);
  const whyChain = declStrings.length > 0
    ? `${milestoneId} ("${milestone.title}") realizes ${declStrings.join(', ')}`
    : `${milestoneId} ("${milestone.title}")`;

  const passed = allChecks.every(c => c.passed);

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    completedActions,
    milestoneCompletable,
    traceContext: {
      declarations,
      whyChain,
    },
    allChecks,
    passed,
  };
}

module.exports = { runVerifyWave };
