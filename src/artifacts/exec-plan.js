// @ts-check
'use strict';

/**
 * EXEC-PLAN markdown generation with GSD format.
 *
 * Transforms a Declare action + DAG context into a GSD-style PLAN.md
 * string with YAML frontmatter, XML tasks, and why-chain context.
 *
 * Pure function, no I/O. Zero runtime dependencies beyond existing
 * internal modules. CJS module.
 */

const { traceUpward } = require('../commands/trace');

/**
 * Build a why-chain string from trace paths.
 *
 * @param {Array<Array<{id: string, type: string, title: string, status: string}>>} paths
 * @param {string} milestoneId
 * @param {string} milestoneTitle
 * @returns {{ whyChain: string, declarations: Array<{id: string, title: string}> }}
 */
function buildWhyChain(paths, milestoneId, milestoneTitle) {
  // Extract unique declarations from all trace paths
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
    ? `This action causes ${milestoneId} ("${milestoneTitle}") which realizes ${declStrings.join(', ')}`
    : `This action causes ${milestoneId} ("${milestoneTitle}")`;

  return { whyChain, declarations };
}

/**
 * Generate a GSD-style EXEC-PLAN markdown string for an action.
 *
 * @param {import('../graph/engine').DeclareDag} dag - The loaded DAG
 * @param {string} actionId - Action ID (e.g. 'A-03')
 * @param {string} milestoneId - Milestone ID (e.g. 'M-01')
 * @param {number} waveNumber - Wave number (e.g. 1)
 * @returns {string} Complete GSD-format PLAN.md content
 */
function generateExecPlan(dag, actionId, milestoneId, waveNumber) {
  const action = dag.getNode(actionId);
  const milestone = dag.getNode(milestoneId);

  if (!action) {
    return `# Error: Action ${actionId} not found in DAG\n`;
  }
  if (!milestone) {
    return `# Error: Milestone ${milestoneId} not found in DAG\n`;
  }

  // Build why-chain via trace
  const paths = traceUpward(dag, actionId);
  const { whyChain, declarations } = buildWhyChain(paths, milestoneId, milestone.title);

  // Extract action metadata
  const produces = action.metadata.produces || '';
  const description = action.metadata.description || action.title;

  // Build context references
  const contextRefs = [
    '@.planning/FUTURE.md',
    '@.planning/MILESTONES.md',
  ];

  // Build the GSD-style PLAN.md content
  const lines = [
    '---',
    `phase: ${milestoneId}`,
    `plan: ${actionId}`,
    'type: execute',
    `wave: ${waveNumber}`,
    'depends_on: []',
    'files_modified: []',
    'autonomous: true',
    '---',
    '',
    '<objective>',
    action.title,
    '',
    `Purpose: ${whyChain}`,
    `Output: ${produces || 'See action description'}`,
    '</objective>',
    '',
    '<context>',
    ...contextRefs,
    '</context>',
    '',
    '<tasks>',
    '',
    '<task type="auto">',
    `  <name>Task 1: ${action.title}</name>`,
    `  <files>${produces || 'TBD - executor determines from action scope'}</files>`,
    '  <action>',
    description,
    '',
    `Context: ${whyChain}`,
    '  </action>',
    `  <verify>Verify that the action's output exists and functions correctly</verify>`,
    `  <done>${produces || action.title} is complete and verified</done>`,
    '</task>',
    '',
    '</tasks>',
    '',
    '<verification>',
    '1. Action produces artifacts exist on disk',
    '2. Any tests related to this action pass',
    '3. Git commits reflect the work done',
    '</verification>',
    '',
    '<success_criteria>',
    `${action.title} is complete, verified, and advances milestone ${milestoneId}`,
    '</success_criteria>',
    '',
    '<output>',
    'After completion, commit atomically and report results to orchestrator.',
    '</output>',
    '',
  ];

  return lines.join('\n');
}

module.exports = { generateExecPlan, buildWhyChain };
