import { formatSuccess } from './query-dispatch-formatting.js';
import type { QueryDispatchResult } from './query-dispatch-contract.js';
import { mapFallbackDispatchError, toDispatchFailure } from './query-dispatch-error-mapper.js';
import { runFallbackBridge } from './query-fallback-bridge-adapter.js';

export interface RunCjsFallbackDispatchInput {
  projectDir: string;
  gsdToolsPath: string;
  normCmd: string;
  normArgs: string[];
  ws?: string;
  pickField?: string;
}


function formatFallbackOutput(data: unknown, mode: 'json' | 'text', pickField?: string): string | undefined {
  if (mode === 'text') {
    const text = String(data ?? '');
    if (!text.trim()) return undefined;
  }
  return formatSuccess(data, mode, pickField);
}

export async function runCjsFallbackDispatch(input: RunCjsFallbackDispatchInput): Promise<QueryDispatchResult> {
  const { projectDir, gsdToolsPath, normCmd, normArgs, ws, pickField } = input;
  const stderr = [
    `[gsd-sdk] '${normCmd}' not in native registry; falling back to gsd-tools.cjs.`,
    '[gsd-sdk] Transparent bridge — prefer adding a native handler when parity matters.',
  ];

  try {
    const fallback = await runFallbackBridge({ projectDir, gsdToolsPath, normCmd, normArgs, ws });
    if (fallback.stderr.trim()) stderr.push(fallback.stderr.trimEnd());
    return {
      ok: true,
      stderr,
      stdout: formatFallbackOutput(fallback.output, fallback.mode, pickField) ?? '',
      exit_code: 0,
    };
  } catch (err) {
    return toDispatchFailure(
      mapFallbackDispatchError(err, normCmd, normArgs),
      stderr,
    );
  }
}
