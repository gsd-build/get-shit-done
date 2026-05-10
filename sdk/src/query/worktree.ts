import { spawnSync } from 'node:child_process';
import { resolveGsdToolsPath } from '../sdk-package-compatibility.js';
import type { QueryHandler } from './utils.js';

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
