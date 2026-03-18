/**
 * Knowledge Layer — Git diff analysis
 * Detects changed files since a given commit, categorizes changes.
 */
'use strict';

const path = require('path');
const { BINARY_EXTS, CODE_EXTS } = require('./constants.cjs');
const { execGitSafe } = require('./utils.cjs');

function getChangedFilesSince(cwd, sinceCommit) {
  const result = { added: [], modified: [], deleted: [], renamed: [] };
  if (!cwd || !sinceCommit) return result;

  const filters = [
    { key: 'added', args: ['diff', '--name-only', '--diff-filter=A', sinceCommit, 'HEAD'] },
    { key: 'modified', args: ['diff', '--name-only', '--diff-filter=M', sinceCommit, 'HEAD'] },
    { key: 'deleted', args: ['diff', '--name-only', '--diff-filter=D', sinceCommit, 'HEAD'] },
  ];

  for (const { key, args } of filters) {
    const r = execGitSafe(cwd, args);
    if (r.exitCode === 0 && r.stdout) {
      result[key] = r.stdout.split('\n').filter(Boolean);
    }
  }

  // Renamed files
  const renamedResult = execGitSafe(cwd, ['diff', '--name-status', '--diff-filter=R', sinceCommit, 'HEAD']);
  if (renamedResult.exitCode === 0 && renamedResult.stdout) {
    for (const line of renamedResult.stdout.split('\n').filter(Boolean)) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        result.renamed.push({ old: parts[1], new: parts[2] });
      }
    }
  }

  // Untracked files
  const untrackedResult = execGitSafe(cwd, ['ls-files', '--others', '--exclude-standard']);
  if (untrackedResult.exitCode === 0 && untrackedResult.stdout) {
    for (const f of untrackedResult.stdout.split('\n').filter(Boolean)) {
      if (!result.added.includes(f)) result.added.push(f);
    }
  }

  return result;
}

function getCurrentHead(cwd) {
  if (!cwd) return '0000000';
  const result = execGitSafe(cwd, ['rev-parse', '--short', 'HEAD']);
  return (result.exitCode === 0 && result.stdout) ? result.stdout : '0000000';
}

function isBinaryFile(filePath) {
  return BINARY_EXTS.has(path.extname(filePath).toLowerCase());
}

module.exports = { getChangedFilesSince, getCurrentHead, isBinaryFile };
