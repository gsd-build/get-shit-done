import { spawnSync } from 'node:child_process';
import { resolveGsdToolsPath } from '../sdk-package-compatibility.js';
import type { QueryHandler } from './utils.js';

function worktreeSpawn(subcommand: string, args: string[], projectDir: string) {
  const toolsPath = resolveGsdToolsPath(projectDir);
  return spawnSync(process.execPath, [toolsPath, 'worktree', subcommand, ...args], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
  });
}

function worktreeHandleResult(result: ReturnType<typeof spawnSync>) {
  if (result.error) {
    return { data: { ok: false, reason: (result.error as Error).message || 'gsd-tools invocation failed' } };
  }
  const stdout = (result.stdout as string || '').trim();
  if (stdout) {
    try {
      return { data: JSON.parse(stdout) };
    } catch {
      return { data: { ok: result.status === 0, reason: stdout } };
    }
  }
  return {
    data: {
      ok: result.status === 0,
      reason: (result.stderr as string)?.trim() || (result.status === 0 ? 'ok' : 'gsd-tools error'),
    },
  };
}

export const worktreeCleanupWave: QueryHandler = async (args, projectDir) => {
  const toolsPath = resolveGsdToolsPath(projectDir);
  const result = spawnSync(process.execPath, [toolsPath, 'worktree', 'cleanup-wave', ...args], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
  });

  if (result.error) {
    return { data: { ok: false, reason: result.error.message || 'gsd-tools invocation failed' } };
  }

  const stdout = (result.stdout || '').trim();
  if (stdout) {
    try {
      return { data: JSON.parse(stdout) };
    } catch {
      return { data: { ok: result.status === 0, reason: stdout } };
    }
  }

  return {
    data: {
      ok: result.status === 0,
      reason: result.stderr?.trim() || (result.status === 0 ? 'ok' : 'gsd-tools error'),
    },
  };
};

/**
 * Sweep orphaned locked worktrees from prior crashed sessions (#3707).
 * Reaps entries whose pid is dead, branch is merged into the default branch,
 * and lock mtime is older than 5 minutes.
 */
export const worktreeReapOrphans: QueryHandler = async (_args, projectDir) => {
  return worktreeHandleResult(worktreeSpawn('reap-orphans', [], projectDir));
};
