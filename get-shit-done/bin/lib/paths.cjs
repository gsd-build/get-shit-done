/**
 * Paths — Centralized planning path resolution for milestone-scoped directories
 *
 * Resolution order: milestoneOverride arg > module-level override > ACTIVE_MILESTONE file > legacy fallback
 * When no active milestone is detected, returns identical paths to legacy hardcoded `.planning/` paths.
 */

const fs = require('fs');
const path = require('path');

// ─── Module-level milestone override (set by CLI --milestone flag) ───────────

let _milestoneOverride = null;

function setMilestoneOverride(milestone) {
  _milestoneOverride = milestone || null;
}

function getMilestoneOverride() {
  return _milestoneOverride;
}

// ─── Path resolution ─────────────────────────────────────────────────────────

/**
 * Resolve all planning paths for the given working directory.
 *
 * @param {string} cwd - Project root directory
 * @param {string|null} [milestoneOverride] - Explicit milestone name (from --milestone flag)
 * @returns {object} Resolved paths object with abs, rel, global, milestone, isMultiMilestone
 */
function resolvePlanningPaths(cwd, milestoneOverride) {
  const planningRoot = path.join(cwd, '.planning');
  const activeMilestonePath = path.join(planningRoot, 'ACTIVE_MILESTONE');

  // Determine active milestone: explicit override > module override > file > null
  let milestone = milestoneOverride || _milestoneOverride || null;
  if (!milestone) {
    try {
      const content = fs.readFileSync(activeMilestonePath, 'utf-8').trim();
      if (content) milestone = content;
    } catch {}
  }

  const isMultiMilestone = !!milestone;

  // Determine base directory for milestone-scoped files
  const absBase = isMultiMilestone
    ? path.join(planningRoot, 'milestones', milestone)
    : planningRoot;

  const relBase = isMultiMilestone
    ? '.planning/milestones/' + milestone
    : '.planning';

  return {
    abs: {
      planningRoot,
      base: absBase,
      state: path.join(absBase, 'STATE.md'),
      roadmap: path.join(absBase, 'ROADMAP.md'),
      requirements: path.join(absBase, 'REQUIREMENTS.md'),
      config: path.join(absBase, 'config.json'),
      phases: path.join(absBase, 'phases'),
      research: path.join(absBase, 'research'),
      codebase: path.join(planningRoot, 'codebase'),
    },
    rel: {
      base: relBase,
      state: relBase + '/STATE.md',
      roadmap: relBase + '/ROADMAP.md',
      requirements: relBase + '/REQUIREMENTS.md',
      config: relBase + '/config.json',
      phases: relBase + '/phases',
      research: relBase + '/research',
    },
    global: {
      abs: {
        project: path.join(planningRoot, 'PROJECT.md'),
        milestones: path.join(planningRoot, 'MILESTONES.md'),
        activeMilestone: activeMilestonePath,
        codebase: path.join(planningRoot, 'codebase'),
        milestonesDir: path.join(planningRoot, 'milestones'),
      },
      rel: {
        project: '.planning/PROJECT.md',
        milestones: '.planning/MILESTONES.md',
        activeMilestone: '.planning/ACTIVE_MILESTONE',
      },
    },
    milestone,
    isMultiMilestone,
  };
}

module.exports = {
  resolvePlanningPaths,
  setMilestoneOverride,
  getMilestoneOverride,
};
