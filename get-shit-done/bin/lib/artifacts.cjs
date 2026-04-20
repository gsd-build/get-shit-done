/**
 * Canonical GSD artifact registry.
 *
 * Enumerates the file names that gsd workflows officially produce at the
 * .planning/ root level. Used by gsd-health (W019) to flag unrecognized files
 * so stale or misnamed artifacts don't silently mislead agents or reviewers.
 *
 * Add entries here whenever a new workflow produces a .planning/ root file.
 */

'use strict';

// Exact-match canonical file names at .planning/ root
const CANONICAL_EXACT = new Set([
  'PROJECT.md',
  'ROADMAP.md',
  'STATE.md',
  'REQUIREMENTS.md',
  'MILESTONES.md',
  'BACKLOG.md',
  'LEARNINGS.md',
  'THREADS.md',
  'config.json',
  'CLAUDE.md',
]);

// Pattern-match canonical file names (regex tests on the basename)
// Each pattern includes the name of the workflow that produces it as a comment.
const CANONICAL_PATTERNS = [
  /^v\d+\.\d+(?:\.\d+)?-MILESTONE-AUDIT\.md$/i,  // gsd-complete-milestone (pre-archive)
  /^v\d+\.\d+(?:\.\d+)?-.*\.md$/i,               // other version-stamped planning docs
];

/**
 * Return true if `filename` (basename only, no path) matches a canonical
 * .planning/ root artifact — either an exact name or a known pattern.
 *
 * @param {string} filename - Basename of the file (e.g. "STATE.md")
 */
function isCanonicalPlanningFile(filename) {
  if (CANONICAL_EXACT.has(filename)) return true;
  for (const pattern of CANONICAL_PATTERNS) {
    if (pattern.test(filename)) return true;
  }
  return false;
}

module.exports = {
  CANONICAL_EXACT,
  CANONICAL_PATTERNS,
  isCanonicalPlanningFile,
};
