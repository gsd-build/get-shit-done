import { findProjectRoot } from './helpers.js';
import { validateWorkstreamName } from '../workstream-utils.js';
import { readActiveWorkstream } from './active-workstream-store.js';

export interface QueryRuntimeContextInput {
  projectDir: string;
  ws?: string;
}

export interface QueryRuntimeContext {
  projectDir: string;
  ws?: string;
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

  const fileWs = readActiveWorkstream(projectDir);
  return {
    projectDir,
    ws: fileWs ?? undefined,
  };
}
