// @ts-check
'use strict';

/**
 * Milestone folder management utilities.
 *
 * Handles creation, lookup, and archival of milestone folders
 * in .planning/milestones/{M-XX-slug}/ structure.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, mkdirSync, readdirSync, renameSync } = require('node:fs');
const { join, basename } = require('node:path');

/**
 * Convert a title to a URL-friendly slug.
 * Lowercase, replace non-alphanumeric runs with hyphens, strip leading/trailing hyphens.
 *
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate milestone folder name from ID and title.
 * @param {string} id - e.g. 'M-01'
 * @param {string} title - e.g. 'User Authentication'
 * @returns {string} e.g. 'M-01-user-authentication'
 */
function milestoneFolderName(id, title) {
  return `${id}-${slugify(title)}`;
}

/**
 * Get the full path for a milestone folder.
 * @param {string} planningDir - Path to .planning directory
 * @param {string} id - Milestone ID e.g. 'M-01'
 * @param {string} title - Milestone title
 * @returns {string} Full path to milestone folder
 */
function getMilestoneFolderPath(planningDir, id, title) {
  return join(planningDir, 'milestones', milestoneFolderName(id, title));
}

/**
 * Ensure a milestone folder exists, creating it if needed.
 * @param {string} planningDir - Path to .planning directory
 * @param {string} id - Milestone ID
 * @param {string} title - Milestone title
 * @returns {string} Path to the (created or existing) folder
 */
function ensureMilestoneFolder(planningDir, id, title) {
  const folderPath = getMilestoneFolderPath(planningDir, id, title);
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

/**
 * Find a milestone folder by ID prefix.
 * Handles slug changes by matching on the ID prefix only.
 * @param {string} planningDir - Path to .planning directory
 * @param {string} id - Milestone ID e.g. 'M-01'
 * @returns {string | null} Full path to folder, or null if not found
 */
function findMilestoneFolder(planningDir, id) {
  const milestonesDir = join(planningDir, 'milestones');
  if (!existsSync(milestonesDir)) return null;

  const entries = readdirSync(milestonesDir, { withFileTypes: true });
  const folder = entries.find(e => e.isDirectory() && e.name.startsWith(id));
  return folder ? join(milestonesDir, folder.name) : null;
}

/**
 * Archive a milestone folder by moving it to _archived/.
 * @param {string} planningDir - Path to .planning directory
 * @param {string} id - Milestone ID
 * @returns {boolean} true if archived, false if folder not found
 */
function archiveMilestoneFolder(planningDir, id) {
  const folder = findMilestoneFolder(planningDir, id);
  if (!folder) return false;

  const archiveDir = join(planningDir, 'milestones', '_archived');
  mkdirSync(archiveDir, { recursive: true });
  renameSync(folder, join(archiveDir, basename(folder)));
  return true;
}

module.exports = {
  slugify,
  milestoneFolderName,
  getMilestoneFolderPath,
  ensureMilestoneFolder,
  findMilestoneFolder,
  archiveMilestoneFolder,
};
