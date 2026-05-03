import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BUNDLED_GSD_TOOLS_PATH = fileURLToPath(
  new URL('../../get-shit-done/bin/gsd-tools.cjs', import.meta.url),
);

/**
 * Resolve gsd-tools.cjs path.
 * Probe order: SDK-bundled repo copy → project/.claude/get-shit-done → ~/.claude/get-shit-done
 */
export function resolveGsdToolsPath(projectDir: string): string {
  const candidates = [
    BUNDLED_GSD_TOOLS_PATH,
    join(projectDir, '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
    join(homedir(), '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[candidates.length - 1]!;
}

export { BUNDLED_GSD_TOOLS_PATH };
