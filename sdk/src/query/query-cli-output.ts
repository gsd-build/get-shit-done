import { GSDError, exitCodeFor } from '../errors.js';
import { GSDToolsError } from '../gsd-tools.js';
import type { QueryDispatchResult } from './query-dispatch-contract.js';

export interface QueryCliAdapterOutput {
  exitCode: number;
  stdoutChunks: string[];
  stderrLines: string[];
}

export function buildQueryCliOutputFromDispatch(out: QueryDispatchResult): QueryCliAdapterOutput {
  const stderrLines = [...out.stderr];
  const stdoutChunks: string[] = [];
  if (!out.ok) {
    stderrLines.push(out.error.message);
    return { exitCode: out.exit_code, stdoutChunks, stderrLines };
  }
  if (out.stdout) stdoutChunks.push(out.stdout);
  return { exitCode: 0, stdoutChunks, stderrLines };
}

export function buildQueryCliOutputFromError(err: unknown): QueryCliAdapterOutput {
  const stdoutChunks: string[] = [];
  if (err instanceof GSDError) {
    return { stderrLines: [`Error: ${err.message}`], exitCode: exitCodeFor(err.classification), stdoutChunks };
  }
  if (err instanceof GSDToolsError) {
    return { stderrLines: [`Error: ${err.message}`], exitCode: err.exitCode ?? 1, stdoutChunks };
  }
  return { stderrLines: [`Error: ${err instanceof Error ? err.message : String(err)}`], exitCode: 1, stdoutChunks };
}
