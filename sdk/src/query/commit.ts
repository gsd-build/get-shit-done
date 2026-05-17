/**
 * Git commit and check-commit query handlers.
 *
 * Ported from get-shit-done/bin/lib/commands.cjs (cmdCommit, cmdCheckCommit)
 * and core.cjs (execGit). Provides commit creation with message sanitization
 * and pre-commit validation.
 *
 * @example
 * ```typescript
 * import { commit, checkCommit } from './commit.js';
 *
 * await commit(['docs: update state', '.planning/STATE.md'], '/project');
 * // { data: { committed: true, hash: 'abc1234', message: 'docs: update state', files: [...] } }
 *
 * await checkCommit([], '/project');
 * // { data: { can_commit: true, reason: 'commit_docs_enabled', ... } }
 * ```
 */

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { GSDError } from '../errors.js';
import { planningPaths, resolvePathUnderProject } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── execGit ──────────────────────────────────────────────────────────────

/**
 * Run a git command in the given working directory.
 *
 * Ported from core.cjs lines 531-542.
 *
 * @param cwd - Working directory for the git command
 * @param args - Git command arguments (e.g., ['commit', '-m', 'msg'])
 * @returns Object with exitCode, stdout, and stderr
 */
export function execGit(cwd: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('git', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
  };
}

// ─── sanitizeCommitMessage ────────────────────────────────────────────────

/**
 * Sanitize a commit message to prevent prompt injection.
 *
 * Ported from security.cjs sanitizeForPrompt.
 * Strips zero-width characters, null bytes, and neutralizes
 * known injection markers that could hijack agent context.
 *
 * @param text - Raw commit message
 * @returns Sanitized message safe for git commit
 */
export function sanitizeCommitMessage(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Strip null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Strip zero-width characters that could hide instructions
  sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');

  // Neutralize XML/HTML tags that mimic system boundaries
  sanitized = sanitized.replace(/<(\/?)?(?:system|assistant|human)>/gi,
    (_match, slash) => `\uFF1C${slash || ''}system-text\uFF1E`);

  // Neutralize [SYSTEM] / [INST] markers
  sanitized = sanitized.replace(/\[(SYSTEM|INST)\]/gi, '[$1-TEXT]');

  // Neutralize <<SYS>> markers
  sanitized = sanitized.replace(/<<\s*SYS\s*>>/gi, '\u00ABSYS-TEXT\u00BB');

  return sanitized;
}

// ─── commit ───────────────────────────────────────────────────────────────

/**
 * Stage files and create a git commit.
 *
 * Checks commit_docs config (unless --force), sanitizes message,
 * stages specified files (or all .planning/), and commits.
 *
 * By default, `--files <paths>` runs `git add -- <path>` for each named file
 * before committing. This means any per-hunk staging set up via `git add -p`
 * is **overwritten** by a full re-stage of the file's working-tree content.
 *
 * Pass `--respect-staged` to skip the `git add` step entirely. The handler
 * will commit only what is already staged within the requested pathspec. If
 * nothing is staged within that scope, the handler returns
 * `{ committed: false, reason: 'nothing staged' }` without error. The #3061
 * leak-prevention invariant still holds: the trailing `-- <paths>` pathspec
 * on the commit ensures files staged outside `--files <paths>` are excluded.
 *
 * @param args - args[0]=message, remaining=file paths or flags
 *               (--force, --amend, --no-verify, --respect-staged)
 * @param projectDir - Project root directory
 * @returns QueryResult with commit result
 */
export const commit: QueryHandler = async (args, projectDir, workstream) => {
  const allArgs = [...args];

  // Extract flags
  const hasForce = allArgs.includes('--force');
  const hasAmend = allArgs.includes('--amend');
  const hasNoVerify = allArgs.includes('--no-verify');
  const hasRespectStaged = allArgs.includes('--respect-staged');
  const filesIndex = allArgs.indexOf('--files');
  const endIndex = filesIndex !== -1 ? filesIndex : allArgs.length;
  // CodeRabbit #6: don't strip arbitrary `--foo` tokens from commit messages
  const knownFlags = new Set(['--force', '--amend', '--no-verify', '--respect-staged']);
  const messageArgs = allArgs.slice(0, endIndex).filter(a => !knownFlags.has(a));
  const message = messageArgs.join(' ') || undefined;
  const filePaths =
    filesIndex !== -1 ? allArgs.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];

  if (!message && !hasAmend) {
    return { data: { committed: false, reason: 'commit message required' } };
  }

  // Check commit_docs config unless --force
  if (!hasForce) {
    const paths = planningPaths(projectDir, workstream);
    try {
      const raw = await readFile(paths.config, 'utf-8');
      const config = JSON.parse(raw) as Record<string, unknown>;
      if (config.commit_docs === false) {
        return { data: { committed: false, reason: 'commit_docs disabled' } };
      }
    } catch {
      // No config or malformed — allow commit
    }
  }

  // Sanitize message
  const sanitized = message ? sanitizeCommitMessage(message) : message;

  // If --files was passed explicitly, the caller asked for an explicit scope.
  // Falling back to .planning/ when every following token got filtered out
  // would silently swap the requested scope, so reject the call instead.
  if (filesIndex !== -1 && filePaths.length === 0) {
    return { data: { committed: false, reason: '--files requires at least one path' } };
  }

  // Compute pathspec once: the handler commits exactly the paths it staged,
  // never anything that was pre-staged externally (#3061).
  const pathsToCommit = filePaths.length > 0 ? filePaths : ['.planning/'];

  // When --respect-staged is set, skip re-staging so that per-hunk staging
  // from `git add -p` is preserved. Without the flag, run git add for each
  // path (default behavior, back-compat).
  if (!hasRespectStaged) {
    for (const file of pathsToCommit) {
      // The `--` separator keeps any path that starts with `-` from being
      // interpreted as a git option (e.g. a file literally named `-A`).
      const addResult = execGit(projectDir, ['add', '--', file]);
      if (addResult.exitCode !== 0) {
        return { data: { committed: false, reason: addResult.stderr || `failed to stage ${file}`, exitCode: addResult.exitCode } };
      }
    }
  }

  // Check if anything is staged within the pathspec we're about to commit.
  // When --respect-staged is set the caller may list paths that git doesn't
  // know yet (e.g. untracked files the operator intentionally skipped via
  // `git add -p`). Passing those unknown paths directly as a git pathspec
  // causes `git diff --cached` to exit non-zero with "pathspec did not match".
  // To avoid that, get all staged files and filter by the requested paths in
  // TypeScript instead.
  const stagedFilesResult: { files: string[] } | { error: { reason: string; exitCode: number } } = (() => {
    if (hasRespectStaged) {
      const allStaged = execGit(projectDir, ['diff', '--cached', '--name-only']);
      if (allStaged.exitCode !== 0) {
        return {
          error: {
            reason: allStaged.stderr || allStaged.stdout || 'failed to inspect staged files',
            exitCode: allStaged.exitCode,
          },
        };
      }
      const allStagedFiles = allStaged.stdout ? allStaged.stdout.split('\n').filter(Boolean) : [];
      const normalizePathspec = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
      const normalizedSpecs = pathsToCommit.map(normalizePathspec);
      return {
        files: allStagedFiles.filter(file => {
          const normalizedFile = normalizePathspec(file);
          return normalizedSpecs.some(spec => normalizedFile === spec || normalizedFile.startsWith(`${spec}/`));
        }),
      };
    }
    const diffResult = execGit(projectDir, ['diff', '--cached', '--name-only', '--', ...pathsToCommit]);
    if (diffResult.exitCode !== 0) {
      return {
        error: {
          reason: diffResult.stderr || diffResult.stdout || 'failed to inspect staged files',
          exitCode: diffResult.exitCode,
        },
      };
    }
    return { files: diffResult.stdout ? diffResult.stdout.split('\n').filter(Boolean) : [] };
  })();
  if ('error' in stagedFilesResult) {
    return { data: { committed: false, ...stagedFilesResult.error } };
  }
  const stagedFiles = stagedFilesResult.files;
  if (stagedFiles.length === 0) {
    return { data: { committed: false, reason: 'nothing staged' } };
  }

  // Build commit command. The trailing pathspec ensures the commit captures
  // only files within the requested scope (#3061 invariant).
  //
  // For the default path: use `pathsToCommit` (the caller's requested scope).
  // For --respect-staged: use `stagedFiles` (the exact set already in the
  // index within scope). This avoids git rejecting the commit when the caller
  // listed paths that are not yet known to git (e.g. skipped hunks from
  // `git add -p` that were intentionally left unstaged).
  const commitPathspec = hasRespectStaged ? stagedFiles : pathsToCommit;
  const commitArgs: string[] = hasAmend
    ? ['commit', '--amend', '--no-edit']
    : ['commit', '-m', sanitized ?? ''];
  if (hasNoVerify) commitArgs.push('--no-verify');
  commitArgs.push('--', ...commitPathspec);

  const commitResult = execGit(projectDir, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      return { data: { committed: false, reason: 'nothing to commit' } };
    }
    return { data: { committed: false, reason: commitResult.stderr || 'commit failed', exitCode: commitResult.exitCode } };
  }

  // Get short hash
  const hashResult = execGit(projectDir, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;

  return { data: { committed: true, hash, message: sanitized, files: stagedFiles } };
};

// ─── checkCommit ──────────────────────────────────────────────────────────

/**
 * Validate whether a commit can proceed.
 *
 * Checks commit_docs config and staged file state.
 *
 * @param _args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with { can_commit, reason, commit_docs, staged_files }
 */
export const checkCommit: QueryHandler = async (_args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);

  let commitDocs = true;
  try {
    const raw = await readFile(paths.config, 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown>;
    if (config.commit_docs === false) {
      commitDocs = false;
    }
  } catch {
    // No config — default to allowing commits
  }

  // Check staged files
  const diffResult = execGit(projectDir, ['diff', '--cached', '--name-only']);
  const stagedFiles = diffResult.stdout ? diffResult.stdout.split('\n').filter(Boolean) : [];

  if (!commitDocs) {
    // If commit_docs is false, check if any .planning/ files are staged
    const planningFiles = stagedFiles.filter(f => f.startsWith('.planning/') || f.startsWith('.planning\\'));
    if (planningFiles.length > 0) {
      return {
        data: {
          allowed: false,
          can_commit: false,
          reason: `commit_docs is false but ${planningFiles.length} .planning/ file(s) are staged`,
          commit_docs: false,
          staged_files: planningFiles,
        },
      };
    }
  }

  return {
    data: {
      allowed: true,
      can_commit: true,
      reason: commitDocs ? 'commit_docs_enabled' : 'no_planning_files_staged',
      commit_docs: commitDocs,
      staged_files: stagedFiles,
    },
  };
};

// ─── commitToSubrepo ─────────────────────────────────────────────────────

export const commitToSubrepo: QueryHandler = async (args, projectDir, workstream) => {
  const filesIdx = args.indexOf('--files');
  const endIdx = filesIdx >= 0 ? filesIdx : args.length;
  const knownFlags = new Set(['--force', '--amend', '--no-verify']);
  const messageArgs = args.slice(0, endIdx).filter(a => !knownFlags.has(a));
  const message = messageArgs.join(' ') || undefined;
  const files = filesIdx >= 0 ? args.slice(filesIdx + 1).filter(a => !a.startsWith('--')) : [];

  if (!message) {
    return { data: { committed: false, reason: 'commit message required' } };
  }

  const paths = planningPaths(projectDir, workstream);
  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(paths.config, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* no config */
  }
  const subRepos = config.sub_repos as string[] | undefined;
  if (!subRepos || subRepos.length === 0) {
    return {
      data: { committed: false, reason: 'no sub_repos configured in .planning/config.json' },
    };
  }

  if (files.length === 0) {
    return { data: { committed: false, reason: '--files required for commit-to-subrepo' } };
  }

  const sanitized = sanitizeCommitMessage(message);
  if (!sanitized && message) {
    return { data: { committed: false, reason: 'commit message empty after sanitization' } };
  }

  try {
    for (const file of files) {
      try {
        await resolvePathUnderProject(projectDir, file);
      } catch (err) {
        if (err instanceof GSDError) {
          return { data: { committed: false, reason: `${err.message}: ${file}` } };
        }
        throw err;
      }
    }

    const fileArgs = files.length > 0 ? files : ['.'];
    // The `--` separator keeps any path that starts with `-` from being
    // interpreted as a git option (e.g. a file literally named `-A`).
    const addResult = spawnSync('git', ['-C', projectDir, 'add', '--', ...fileArgs], { stdio: 'pipe', encoding: 'utf-8' });
    if (addResult.status !== 0) {
      return { data: { committed: false, reason: addResult.stderr || 'git add failed' } };
    }

    // Pathspec on the commit keeps the scope identical to what was just staged,
    // so any pre-staged external changes do not leak in (#3061).
    const commitResult = spawnSync(
      'git', ['-C', projectDir, 'commit', '-m', sanitized, '--', ...fileArgs],
      { stdio: 'pipe', encoding: 'utf-8' },
    );
    if (commitResult.status !== 0) {
      return { data: { committed: false, reason: commitResult.stderr || 'commit failed' } };
    }

    const hashResult = spawnSync(
      'git', ['-C', projectDir, 'rev-parse', '--short', 'HEAD'],
      { encoding: 'utf-8' },
    );
    const hash = hashResult.stdout.trim();
    return { data: { committed: true, hash, message: sanitized } };
  } catch (err) {
    return { data: { committed: false, reason: String(err) } };
  }
};
