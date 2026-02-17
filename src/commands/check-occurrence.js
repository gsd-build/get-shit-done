// @ts-check
'use strict';

/**
 * check-occurrence command logic.
 *
 * Gathers declaration context (milestones, action summaries) for AI
 * assessment of whether declarations still occur as declared.
 *
 * Zero runtime dependencies. CJS module.
 */

const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { isCompleted } = require('../graph/engine');

/**
 * Run the check-occurrence command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments (optional --declaration D-XX)
 * @returns {{ declarations: Array<{declarationId: string, statement: string, status: string, milestoneCount: number, milestones: Array<{id: string, title: string, status: string}>, actionSummary: {total: number, completed: number}}> } | { error: string }}
 */
function runCheckOccurrence(cwd, args) {
  const targetDecl = parseFlag(args || [], 'declaration');

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;
  const allDeclarations = dag.getDeclarations();

  // Filter to specific declaration if requested
  const declarations = targetDecl
    ? allDeclarations.filter(d => d.id === targetDecl)
    : allDeclarations;

  if (targetDecl && declarations.length === 0) {
    return { error: `Declaration not found: ${targetDecl}` };
  }

  const result = declarations.map(decl => {
    // Get milestones that realize this declaration
    const downstream = dag.getDownstream(decl.id);
    const milestones = downstream.filter(n => n.type === 'milestone');

    // For each milestone, count its actions
    let totalActions = 0;
    let completedActions = 0;
    for (const m of milestones) {
      const mDownstream = dag.getDownstream(m.id);
      const actions = mDownstream.filter(n => n.type === 'action');
      totalActions += actions.length;
      completedActions += actions.filter(a => isCompleted(a.status)).length;
    }

    return {
      declarationId: decl.id,
      statement: decl.metadata?.statement || decl.title,
      status: decl.status,
      milestoneCount: milestones.length,
      milestones: milestones.map(m => ({
        id: m.id,
        title: m.title,
        status: m.status,
      })),
      actionSummary: {
        total: totalActions,
        completed: completedActions,
      },
    };
  });

  return { declarations: result };
}

module.exports = { runCheckOccurrence };
