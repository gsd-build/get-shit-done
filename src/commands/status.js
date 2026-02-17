// @ts-check
'use strict';

/**
 * /declare:status command logic.
 *
 * Loads the graph from FUTURE.md, MILESTONES.md, and milestone folders.
 * Runs validation, detects staleness, computes coverage.
 * Returns structured data for the slash command to render.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join, basename } = require('node:path');
const { execFileSync } = require('node:child_process');
const { parsePlanFile } = require('../artifacts/plan');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { buildDagFromDisk } = require('./build-dag');
const { isCompleted } = require('../graph/engine');

/**
 * Detect staleness indicators for milestones.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string} planningDir - Path to .planning directory
 * @param {Array<{id: string, title: string, status: string, realizes: string[], hasPlan: boolean}>} milestones
 * @returns {Array<{milestone: string, issue: string, detail: string}>}
 */
function detectStaleness(cwd, planningDir, milestones) {
  const indicators = [];

  for (const m of milestones) {
    const folder = findMilestoneFolder(planningDir, m.id);
    if (!folder) {
      indicators.push({ milestone: m.id, issue: 'NO_PLAN', detail: 'No plan derived yet' });
      continue;
    }

    const planPath = join(folder, 'PLAN.md');
    if (!existsSync(planPath)) {
      indicators.push({ milestone: m.id, issue: 'EMPTY_FOLDER', detail: 'Folder exists but no PLAN.md' });
      continue;
    }

    // Check age via git
    try {
      const lastMod = execFileSync('git', ['log', '-1', '--format=%ct', '--', planPath], {
        cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (lastMod) {
        const ageDays = (Date.now() - parseInt(lastMod, 10) * 1000) / 86400000;
        if (ageDays > 30) {
          indicators.push({ milestone: m.id, issue: 'STALE', detail: `Plan not updated in ${Math.floor(ageDays)} days` });
        }
      }
    } catch { /* git unavailable */ }

    // Check consistency
    const plan = parsePlanFile(readFileSync(planPath, 'utf-8'));
    if (m.status === 'ACTIVE' && plan.actions.length > 0 && plan.actions.every(a => isCompleted(a.status))) {
      indicators.push({ milestone: m.id, issue: 'COMPLETABLE', detail: 'All actions done, milestone still ACTIVE' });
    }
    if (isCompleted(m.status) && plan.actions.some(a => !isCompleted(a.status))) {
      indicators.push({ milestone: m.id, issue: 'INCONSISTENT', detail: 'Milestone marked completed but has incomplete actions' });
    }
  }

  return indicators;
}

/**
 * Run the status command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ project: string, stats: object, validation: object, lastActivity: string, health: string, coverage: object, staleness: Array } | { error: string }}
 */
function runStatus(cwd) {
  const planningDir = join(cwd, '.planning');

  const graphResult = buildDagFromDisk(cwd);
  if (graphResult.error) return graphResult;

  const { dag, declarations, milestones, actions } = graphResult;
  const projectName = basename(cwd);

  // Run validation and get stats
  const validation = dag.validate();
  const stats = dag.stats();

  // Get last activity from git
  let lastActivity = 'No activity recorded';
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%ci %s', '--', '.planning/'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (output) {
      lastActivity = output;
    }
  } catch {
    // Git not available or no commits -- use default
  }

  // Compute coverage
  const withPlan = milestones.filter(m => m.hasPlan).length;
  const coverage = {
    total: milestones.length,
    withPlan,
    percentage: milestones.length > 0 ? Math.round((withPlan / milestones.length) * 100) : 100,
  };

  // Detect staleness
  const staleness = detectStaleness(cwd, planningDir, milestones);

  // Compute integrity aggregation
  const integrity = {
    total: milestones.length,
    verified: 0,   // KEPT + HONORED + RENEGOTIATED
    kept: 0,
    honored: 0,
    renegotiated: 0,
    broken: 0,
    pending: 0,    // PENDING + ACTIVE + DONE (not yet verified)
  };
  for (const m of milestones) {
    switch (m.status) {
      case 'KEPT': integrity.kept++; integrity.verified++; break;
      case 'HONORED': integrity.honored++; integrity.verified++; break;
      case 'RENEGOTIATED': integrity.renegotiated++; integrity.verified++; break;
      case 'BROKEN': integrity.broken++; break;
      default: integrity.pending++; break;
    }
  }

  // Determine health
  let health = 'healthy';
  if (!validation.valid) {
    const hasCycle = validation.errors.some(e => e.type === 'cycle');
    const hasBroken = validation.errors.some(e => e.type === 'broken_edge');
    health = (hasCycle || hasBroken) ? 'errors' : 'warnings';
  }
  if (staleness.length > 0 && health === 'healthy') {
    health = 'warnings';
  }
  // BROKEN milestones are a state (in remediation), not an error per INTG-03
  if (integrity.broken > 0 && health === 'healthy') {
    health = 'warnings';
  }

  return {
    project: projectName,
    stats: {
      declarations: stats.declarations,
      milestones: stats.milestones,
      actions: stats.actions,
      edges: stats.edges,
      byStatus: stats.byStatus,
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors,
    },
    lastActivity,
    health,
    coverage,
    staleness,
    integrity,
  };
}

module.exports = { runStatus };
