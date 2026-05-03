import { createRegistry } from './index.js';
import { runQueryDispatch } from './query-dispatch.js';
import { resolveGsdToolsPath } from '../gsd-tools.js';
import { resolveQueryRuntimeContext } from './query-runtime-context.js';
import { createCommandTopology } from './command-topology.js';
import { buildQueryCliOutputFromDispatch, buildQueryCliOutputFromError, type QueryCliAdapterOutput } from './query-cli-output.js';

export interface QueryCliAdapterInput {
  projectDir: string;
  ws?: string;
  queryArgv?: string[];
}


function queryFallbackToCjsEnabled(): boolean {
  const v = process.env.GSD_QUERY_FALLBACK?.toLowerCase();
  if (v === 'off' || v === 'never' || v === 'false' || v === '0') return false;
  return true;
}

export async function runQueryCliCommand(input: QueryCliAdapterInput): Promise<QueryCliAdapterOutput> {
  try {
    const runtime = resolveQueryRuntimeContext({ projectDir: input.projectDir, ws: input.ws });
    const registry = createRegistry();
    const topology = createCommandTopology(registry);
    const out = await runQueryDispatch({
      registry,
      projectDir: runtime.projectDir,
      ws: runtime.ws,
      cjsFallbackEnabled: queryFallbackToCjsEnabled(),
      resolveGsdToolsPath,
      topology,
    }, input.queryArgv ?? []);

    return buildQueryCliOutputFromDispatch(out);
  } catch (err) {
    return buildQueryCliOutputFromError(err);
  }
}
