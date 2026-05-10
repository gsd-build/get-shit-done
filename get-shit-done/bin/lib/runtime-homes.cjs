'use strict';

/**
 * runtime-homes.cjs — canonical runtime → global config/skills directory mapping.
 *
 * Single source of truth for resolving the global config base directory and
 * the correct global skills directory for every GSD-supported runtime.
 *
 * Thin query adapter over the Runtime Install Policy Module. Safe to require()
 * without triggering the installer.
 *
 * Runtime-specific notes:
 *   hermes  — GSD skills nest under skills/gsd/<skillName>/ (not the flat
 *             skills/<skillName>/ layout used by all other runtimes). This
 *             collapses 86 skill entries into one category in Hermes' system
 *             prompt (#2841).
 *   cline   — Rules-based; commands are embedded in .clinerules. Cline does
 *             not use a skills/ directory. getGlobalSkillDir() returns null
 *             for cline so the caller can emit an appropriate warning.
 */

const os = require('os');
const path = require('path');
const { getGlobalDir, getRuntimePolicy } = require('./runtime-install-policy.cjs');

/**
 * Expand a leading ~ to os.homedir().
 * @param {string} p
 * @returns {string}
 */
function expandTilde(p) {
  if (!p) return p;
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(1));
  return p;
}

/**
 * Return the global config base directory for the given runtime.
 * Respects the env-var overrides owned by Runtime Install Policy.
 *
 * @param {string} runtime
 * @returns {string} Absolute path to the runtime's global config directory
 */
function getGlobalConfigDir(runtime) {
  return getGlobalDir(runtime);
}

/**
 * Return the global skills base directory for the given runtime.
 * Most runtimes: <configDir>/skills
 * Hermes: <configDir>/skills/gsd  (nested category layout — #2841)
 * Cline:  null (rules-based, no skills directory)
 *
 * @param {string} runtime
 * @returns {string|null}
 */
function getGlobalSkillsBase(runtime) {
  const policy = getRuntimePolicy(runtime);
  if (policy.skillsLayout === 'none') return null;
  const configDir = getGlobalConfigDir(runtime);
  if (policy.skillsLayout === 'hermes-nested') return path.join(configDir, 'skills', 'gsd');
  return path.join(configDir, 'skills');
}

/**
 * Return the full path to a specific skill's directory for the given runtime.
 * Returns null for runtimes that don't use a skills directory (cline).
 *
 * @param {string} runtime
 * @param {string} skillName - e.g. 'gsd-executor'
 * @returns {string|null}
 */
function getGlobalSkillDir(runtime, skillName) {
  const base = getGlobalSkillsBase(runtime);
  if (base === null) return null;
  return path.join(base, skillName);
}

/**
 * Return a human-readable display path for a global skill (for log messages).
 *
 * @param {string} runtime
 * @param {string} skillName
 * @returns {string}
 */
function getGlobalSkillDisplayPath(runtime, skillName) {
  const dir = getGlobalSkillDir(runtime, skillName);
  if (!dir) return `(${runtime} does not use a skills directory)`;
  // Replace homedir prefix with ~ for readability
  const home = os.homedir();
  return dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
}

module.exports = {
  getGlobalConfigDir,
  getGlobalSkillsBase,
  getGlobalSkillDir,
  getGlobalSkillDisplayPath,
};
