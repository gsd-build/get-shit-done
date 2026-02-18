// @ts-check
'use strict';

/**
 * verify-milestone command logic.
 *
 * Milestone-level truth verification with programmatic checks.
 * Checks artifact existence, test results, and provides AI assessment placeholder.
 *
 * Zero runtime dependencies beyond existing internal modules. CJS module.
 */

const { existsSync, readFileSync, statSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { parsePlanFile } = require('../artifacts/plan');
const { traceUpward } = require('./trace');

/**
 * Check if a produces value looks like a file path (vs a description).
 * @param {string} produces
 * @returns {boolean}
 */
function looksLikeFilePath(produces) {
  if (!produces || produces.trim() === '') return false;
  return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
}

/**
 * Run the verify-milestone command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments
 * @returns {{ milestoneId: string, milestoneTitle: string, milestoneFolder: string | null, criteria: Array<{id: string, type: string, passed: boolean | null, description: string, evidence: string | null, actionId?: string}>, programmaticPassed: boolean, aiAssessmentNeeded: boolean, traceContext: { declarations: Array<{id: string, title: string}>, whyChain: string } } | { error: string }}
 */
function runVerifyMilestone(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');
  if (!milestoneId) {
    return { error: 'Missing --milestone flag. Usage: verify-milestone --milestone M-XX' };
  }

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

  // Find milestone folder and load PLAN.md
  const planningDir = join(cwd, '.planning');
  const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);

  /** @type {Array<{id: string, type: string, passed: boolean | null, description: string, evidence: string | null, actionId?: string}>} */
  const criteria = [];
  let scCounter = 1;

  if (milestoneFolder) {
    const planPath = join(milestoneFolder, 'PLAN.md');
    if (existsSync(planPath)) {
      const planContent = readFileSync(planPath, 'utf-8');
      const plan = parsePlanFile(planContent);

      // Build artifact checks from actions with produces fields
      for (const action of plan.actions) {
        if (!action.produces) continue;

        if (looksLikeFilePath(action.produces)) {
          const filePath = resolve(cwd, action.produces);
          const exists = existsSync(filePath);
          let evidence = exists ? `File exists` : `File not found: ${action.produces}`;

          if (exists) {
            try {
              const stats = statSync(filePath);
              evidence = `File exists (${stats.size} bytes)`;
            } catch {
              // Keep simple evidence
            }
          }

          criteria.push({
            id: `SC-${String(scCounter).padStart(2, '0')}`,
            type: 'artifact',
            passed: exists,
            description: `${action.id} produces ${action.produces}`,
            evidence,
            actionId: action.id,
          });
          scCounter++;
        }
        // Non-file-path produces: description, auto-pass (no way to verify programmatically)
      }
    }
  }

  // Test checks: run npm test if package.json has test script
  const packagePath = join(cwd, 'package.json');
  if (existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.test) {
        let testPassed = false;
        let testEvidence = '';
        try {
          const result = execFileSync('npm', ['test'], {
            cwd,
            timeout: 60000,
            stdio: 'pipe',
          });
          testPassed = true;
          testEvidence = 'npm test exited with code 0';
        } catch (err) {
          testPassed = false;
          const stderr = err.stderr ? err.stderr.toString().slice(0, 200) : '';
          testEvidence = `npm test failed (exit code ${err.status || 'unknown'}): ${stderr}`;
        }

        criteria.push({
          id: `SC-${String(scCounter).padStart(2, '0')}`,
          type: 'test',
          passed: testPassed,
          description: 'npm test passes',
          evidence: testEvidence,
        });
        scCounter++;
      }
    } catch {
      // Invalid package.json, skip test check
    }
  }

  // AI assessment placeholder (always last)
  criteria.push({
    id: `SC-${String(scCounter).padStart(2, '0')}`,
    type: 'ai',
    passed: null,
    description: 'AI assessment of milestone truth alignment',
    evidence: null,
  });

  // Compute programmatic pass (all non-AI criteria must pass)
  const programmaticCriteria = criteria.filter(c => c.type !== 'ai');
  const programmaticPassed = programmaticCriteria.length === 0 || programmaticCriteria.every(c => c.passed === true);

  // Build trace context
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

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    milestoneFolder,
    criteria,
    programmaticPassed,
    aiAssessmentNeeded: true,
    traceContext: {
      declarations,
      whyChain,
    },
  };
}

module.exports = { runVerifyMilestone };
