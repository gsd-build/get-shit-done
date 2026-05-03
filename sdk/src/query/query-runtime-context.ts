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

export function resolveQueryRuntimeContext(input: QueryRuntimeContextInput): QueryRuntimeContext {
  const projectDir = findProjectRoot(input.projectDir);

  if (input.ws !== undefined) {
    return {
      projectDir,
      ws: validateWorkstreamName(input.ws) ? input.ws : undefined,
    };
  }

  const envWs = process.env.GSD_WORKSTREAM;
  return {
    projectDir,
    ws: envWs && validateWorkstreamName(envWs) ? envWs : undefined,
  };
}
