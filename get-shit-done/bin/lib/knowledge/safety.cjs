/**
 * Knowledge Layer — Safety rails
 * Protected-file detection, improvement-type classification, circuit breakers,
 * scope checking, and merge-readiness validation.
 */
'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');

const SAFE_TYPES = new Set(['test-gap', 'stale-doc', 'pattern-violation']);
const UNSAFE_TYPES = new Set(['feature', 'api-change', 'dependency-add', 'architecture']);
const MAX_FILES_PER_IMPROVEMENT = 5;
const BANNED_KEYWORDS = ['dependency', 'new package', 'api change', 'breaking change'];

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 30000 });
  return { status: result.status, stdout: result.stdout || '', stderr: (result.stderr || '').trim() };
}

function getProtectedFiles(cwd) {
  if (!cwd) return [];
  const unstaged = git(['diff', '--name-only'], cwd);
  const staged = git(['diff', '--name-only', '--staged'], cwd);
  if (unstaged.status !== 0 && staged.status !== 0) return [];
  const files = new Set();
  const addLines = (output) => {
    if (!output) return;
    for (const line of output.split('\n')) { const t = line.trim(); if (t) files.add(t); }
  };
  if (unstaged.status === 0) addLines(unstaged.stdout);
  if (staged.status === 0) addLines(staged.stdout);
  return Array.from(files);
}

function isFileProtected(filePath, protectedFiles) {
  if (!filePath || !protectedFiles || protectedFiles.length === 0) return false;
  const normalise = (p) => p.replace(/\\/g, '/');
  const normalised = normalise(filePath);
  for (const pf of protectedFiles) {
    const normPf = normalise(pf);
    if (normalised === normPf) return true;
    if (normalised.startsWith(normPf + '/')) return true;
    if (normPf.startsWith(normalised + '/')) return true;
  }
  return false;
}

function isSafeImprovement(item) {
  if (!item || !item.type) return { safe: false, reason: 'Missing improvement type' };
  if (SAFE_TYPES.has(item.type)) return { safe: true, reason: 'Type "' + item.type + '" is safe' };
  if (UNSAFE_TYPES.has(item.type)) return { safe: false, reason: 'Type "' + item.type + '" requires human review' };
  return { safe: false, reason: 'Unknown type "' + item.type + '" defaults to unsafe' };
}

function createCircuitBreaker(maxConsecutiveFailures) {
  const max = typeof maxConsecutiveFailures === 'number' ? maxConsecutiveFailures : 3;
  let consecutiveFailures = 0, totalFailures = 0, totalSuccesses = 0;
  return {
    recordSuccess() { totalSuccesses++; consecutiveFailures = 0; },
    recordFailure() { totalFailures++; consecutiveFailures++; },
    isTripped() { return consecutiveFailures >= max; },
    getState() { return { consecutiveFailures, tripped: consecutiveFailures >= max, totalFailures, totalSuccesses }; },
    reset() { consecutiveFailures = 0; totalFailures = 0; totalSuccesses = 0; },
  };
}

function scopeCheck(planContent) {
  if (!planContent) return { valid: true, reason: 'Empty plan', fileCount: 0 };
  const lower = planContent.toLowerCase();
  for (const keyword of BANNED_KEYWORDS) {
    if (lower.includes(keyword)) return { valid: false, reason: 'Banned keyword: "' + keyword + '"', fileCount: 0 };
  }
  const filePattern = /(?:Create|Modify|Edit|Test):\s*(\S+)/gi;
  const files = new Set();
  let match;
  while ((match = filePattern.exec(planContent)) !== null) files.add(match[1]);
  if (files.size > MAX_FILES_PER_IMPROVEMENT) {
    return { valid: false, reason: 'Plan touches ' + files.size + ' files (max ' + MAX_FILES_PER_IMPROVEMENT + ')', fileCount: files.size };
  }
  return { valid: true, reason: 'Scope is acceptable', fileCount: files.size };
}

/**
 * Validate merge readiness by running tests in a worktree.
 * FIX(review #4): accepts an args array instead of a string to prevent
 * command injection. The first element is the command, rest are arguments.
 * Uses spawnSync with array args — no shell interpolation.
 *
 * @param {string} _cwd - Project root (unused, kept for API symmetry)
 * @param {string} worktreePath - Path to the worktree to test
 * @param {string[]} testArgs - Command as array, e.g. ['node', '--test', 'tests/']
 * @returns {{ ready: boolean, reason: string, testOutput: string }}
 */
function validateMergeReadiness(_cwd, worktreePath, testArgs) {
  if (!worktreePath) return { ready: false, reason: 'No worktree path', testOutput: '' };
  try {
    if (!fs.statSync(worktreePath).isDirectory()) return { ready: false, reason: 'Not a directory', testOutput: '' };
  } catch { return { ready: false, reason: 'Worktree does not exist', testOutput: '' }; }
  if (!testArgs || !Array.isArray(testArgs) || testArgs.length === 0) {
    return { ready: false, reason: 'No test command (must be an array of args)', testOutput: '' };
  }
  const result = spawnSync(testArgs[0], testArgs.slice(1), {
    cwd: worktreePath, stdio: 'pipe', encoding: 'utf-8', timeout: 120000,
  });
  const testOutput = ((result.stdout || '') + '\n' + (result.stderr || '')).trim();
  if (result.status === 0) return { ready: true, reason: 'All tests passed', testOutput };
  return { ready: false, reason: 'Tests failed (exit ' + result.status + ')', testOutput };
}

module.exports = {
  SAFE_TYPES, UNSAFE_TYPES, MAX_FILES_PER_IMPROVEMENT,
  getProtectedFiles, isFileProtected, isSafeImprovement,
  createCircuitBreaker, scopeCheck, validateMergeReadiness,
};
