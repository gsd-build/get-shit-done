import { findProjectRoot } from './helpers.js';
import { createRegistry } from './index.js';
import { runQueryDispatch } from './query-dispatch.js';
import { resolveGsdToolsPath, GSDToolsError } from '../gsd-tools.js';
import { GSDError, exitCodeFor } from '../errors.js';
import { validateWorkstreamName } from '../workstream-utils.js';

export interface QueryCliAdapterInput {
  projectDir: string;
  ws?: string;
  queryArgv?: string[];
}

export interface QueryCliAdapterOutput {
  exitCode: number;
  stdoutChunks: string[];
  stderrLines: string[];
}

function queryFallbackToCjsEnabled(): boolean {
  const v = process.env.GSD_QUERY_FALLBACK?.toLowerCase();
  if (v === 'off' || v === 'never' || v === 'false' || v === '0') return false;
  return true;
}

function resolveQueryWorkstream(ws: string | undefined): string | undefined {
  if (ws !== undefined) {
    return validateWorkstreamName(ws) ? ws : undefined;
  }
  const envWs = process.env.GSD_WORKSTREAM;
  if (!envWs) return undefined;
  return validateWorkstreamName(envWs) ? envWs : undefined;
}

export async function runQueryCliCommand(input: QueryCliAdapterInput): Promise<QueryCliAdapterOutput> {
  const stderrLines: string[] = [];
  const stdoutChunks: string[] = [];
  const ws = resolveQueryWorkstream(input.ws);

  try {
    const projectDir = findProjectRoot(input.projectDir);
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir,
      ws,
      cjsFallbackEnabled: queryFallbackToCjsEnabled(),
      resolveGsdToolsPath,
      dispatchNative: (cmd, argv) => registry.dispatch(cmd, argv, projectDir, ws),
    }, input.queryArgv ?? []);

    stderrLines.push(...out.stderr);
    if (!out.ok) {
      stderrLines.push(out.error.message);
      return { exitCode: out.exit_code, stdoutChunks, stderrLines };
    }
    if (out.stdout) stdoutChunks.push(out.stdout);
    return { exitCode: 0, stdoutChunks, stderrLines };
  } catch (err) {
    if (err instanceof GSDError) {
      stderrLines.push(`Error: ${err.message}`);
      return { exitCode: exitCodeFor(err.classification), stdoutChunks, stderrLines };
    }
    if (err instanceof GSDToolsError) {
      stderrLines.push(`Error: ${err.message}`);
      return { exitCode: err.exitCode ?? 1, stdoutChunks, stderrLines };
    }
    stderrLines.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 1, stdoutChunks, stderrLines };
  }
}
