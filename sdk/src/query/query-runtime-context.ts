import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { findProjectRoot } from './helpers.js';
import { validateWorkstreamName } from '../workstream-utils.js';

export interface QueryRuntimeContextInput {
  projectDir: string;
  ws?: string;
}

export interface QueryRuntimeContext {
  projectDir: string;
  ws?: string;
}

/**
 * Read the active workstream from `.planning/active-workstream` file.
 *
 * Mirrors the logic in workstream.ts:getActiveWorkstream — returns null
 * when the file is missing, empty, contains invalid characters, or names
 * a workstream directory that doesn't exist on disk.
 */
function readActiveWorkstreamFile(projectDir: string): string | null {
  const filePath = join(projectDir, '.planning', 'active-workstream');
  try {
    const name = readFileSync(filePath, 'utf-8').trim();
    if (!name || !validateWorkstreamName(name)) return null;
    const wsDir = join(projectDir, '.planning', 'workstreams', name);
    if (!existsSync(wsDir)) return null;
    return name;
  } catch {
    return null;
  }
}

/**
 * Resolve the runtime context for a query invocation.
 *
 * Workstream resolution priority:
 *   1. `--ws <name>` flag (input.ws)
 *   2. `GSD_WORKSTREAM` environment variable
 *   3. `.planning/active-workstream` file
 *   4. Root `.planning/` (no workstream)
 */
export function resolveQueryRuntimeContext(input: QueryRuntimeContextInput): QueryRuntimeContext {
  const projectDir = findProjectRoot(input.projectDir);

  if (input.ws !== undefined) {
    return {
      projectDir,
      ws: validateWorkstreamName(input.ws) ? input.ws : undefined,
    };
  }

  const envWs = process.env.GSD_WORKSTREAM;
  if (envWs && validateWorkstreamName(envWs)) {
    return { projectDir, ws: envWs };
  }

  const fileWs = readActiveWorkstreamFile(projectDir);
  return {
    projectDir,
    ws: fileWs ?? undefined,
  };
}
