// @ts-check
'use strict';

/**
 * Git commit utility for planning docs.
 *
 * Creates atomic git commits for .planning/ files.
 * Respects config.json commit_docs setting.
 * Handles edge cases: nothing to commit, gitignored paths.
 *
 * Zero runtime dependencies (uses child_process). CJS module.
 */

const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Execute a git command and return structured result.
 * @param {string} cwd - Working directory
 * @param {string[]} args - Git arguments
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
function execGit(cwd, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
    };
  }
}

/**
 * Load .planning/config.json from the project root.
 * Returns defaults if file doesn't exist.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ commit_docs: boolean, [key: string]: any }}
 */
function loadConfig(cwd) {
  const configPath = join(cwd, '.planning', 'config.json');
  if (!existsSync(configPath)) {
    return { commit_docs: true };
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { commit_docs: true, ...parsed };
  } catch {
    return { commit_docs: true };
  }
}

/**
 * Check if a path is git-ignored.
 * @param {string} cwd
 * @param {string} path
 * @returns {boolean}
 */
function isGitIgnored(cwd, path) {
  const result = execGit(cwd, ['check-ignore', '-q', path]);
  return result.exitCode === 0;
}

/**
 * Create an atomic git commit for planning docs.
 *
 * @param {string} cwd - Project root directory
 * @param {string} message - Commit message
 * @param {string[]} files - Specific files to stage (if empty, stages .planning/)
 * @returns {{ committed: boolean, hash?: string, reason?: string, error?: string }}
 */
function commitPlanningDocs(cwd, message, files) {
  const config = loadConfig(cwd);

  // Respect commit_docs config
  if (!config.commit_docs) {
    return { committed: false, reason: 'skipped_config' };
  }

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) {
    return { committed: false, reason: 'skipped_gitignored' };
  }

  // Stage specific files
  const filesToStage = files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    const addResult = execGit(cwd, ['add', file]);
    if (addResult.exitCode !== 0) {
      return { committed: false, reason: 'error', error: `Failed to stage ${file}: ${addResult.stderr}` };
    }
  }

  // Commit
  const result = execGit(cwd, ['commit', '-m', message]);
  if (result.exitCode !== 0) {
    const combined = result.stdout + ' ' + result.stderr;
    if (combined.includes('nothing to commit') || combined.includes('nothing added to commit')) {
      return { committed: false, reason: 'nothing_to_commit' };
    }
    return { committed: false, reason: 'error', error: result.stderr || result.stdout };
  }

  // Get commit hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  return { committed: true, hash: hashResult.stdout };
}

module.exports = { commitPlanningDocs, loadConfig, execGit };
