import type { QueryRegistry } from './registry.js';
import { extractField } from './registry.js';
import { normalizeQueryCommand } from './normalize-query-command.js';
import { explainQueryCommandNoMatch, resolveQueryCommand, type QueryCommandResolution } from './command-resolution.js';
import { runCjsFallbackDispatch } from './query-fallback-executor.js';
import type { QueryResult } from './utils.js';
import type { QueryDispatchResult, QueryDispatchErrorKind } from './query-dispatch-contract.js';
import { mapNativeDispatchError, toDispatchFailure } from './query-dispatch-error-mapper.js';

export interface QueryDispatchDeps {
  registry: QueryRegistry;
  projectDir: string;
  ws?: string;
  cjsFallbackEnabled: boolean;
  resolveGsdToolsPath: (projectDir: string) => string;
  dispatchNative: (cmd: string, args: string[]) => Promise<QueryResult>;
}

type DispatchMode = 'native' | 'cjs' | 'error';

interface DispatchPlan {
  mode: DispatchMode;
  normalized: { command: string; args: string[]; tokens: string[] };
  matched: QueryCommandResolution | null;
}

function fail(
  kind: QueryDispatchErrorKind,
  code: number,
  message: string,
  details?: Record<string, unknown>,
  stderr: string[] = [],
): QueryDispatchResult {
  return toDispatchFailure({ kind, code, message, details }, stderr);
}

function success(stdout: string, stderr: string[] = []): QueryDispatchResult {
  return { ok: true, stdout, stderr, exit_code: 0 };
}

function planQueryDispatch(queryArgv: string[], registry: QueryRegistry, cjsFallbackEnabled: boolean): DispatchPlan {
  const queryCommand = queryArgv[0];
  if (!queryCommand) {
    return { mode: 'error', normalized: { command: '', args: [], tokens: [] }, matched: null };
  }

  const [normCmd, normArgs] = normalizeQueryCommand(queryCommand, queryArgv.slice(1));
  const normalizedTokens = [normCmd, ...normArgs];
  const matched = resolveQueryCommand(queryCommand, queryArgv.slice(1), registry);
  if (matched) {
    return { mode: 'native', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched };
  }
  if (cjsFallbackEnabled) {
    return { mode: 'cjs', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: null };
  }
  return { mode: 'error', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: null };
}

function extractPick(queryArgv: string[]): { queryArgs: string[]; pickField?: string; error?: QueryDispatchResult } {
  const queryArgs = [...queryArgv];
  const pickIdx = queryArgs.indexOf('--pick');
  if (pickIdx === -1) return { queryArgs };
  if (pickIdx + 1 >= queryArgs.length) {
    return {
      queryArgs,
      error: fail('validation_error', 10, 'Error: --pick requires a field name', { field: '--pick', reason: 'missing_value' }),
    };
  }
  const pickField = queryArgs[pickIdx + 1];
  queryArgs.splice(pickIdx, 2);
  return { queryArgs, pickField };
}

function formatOutput(data: unknown, format: QueryResult['format'], pickField?: string): string {
  // Text-format responses ignore --pick to match CJS fallback behavior.
  if (format === 'text' && typeof data === 'string') {
    return data.endsWith('\n') ? data : `${data}\n`;
  }
  let output: unknown = data;
  if (pickField) output = extractField(output, pickField);
  return `${JSON.stringify(output, null, 2)}\n`;
}

export async function runQueryDispatch(deps: QueryDispatchDeps, queryArgv: string[]): Promise<QueryDispatchResult> {
  const picked = extractPick(queryArgv);
  if (picked.error) return picked.error;

  const { queryArgs, pickField } = picked;
  if (queryArgs.length === 0 || !queryArgs[0]) {
    return fail('validation_error', 10, 'Error: "gsd-sdk query" requires a command', { reason: 'missing_command' });
  }

  const plan = planQueryDispatch(queryArgs, deps.registry, deps.cjsFallbackEnabled);
  const normCmd = plan.normalized.command;
  const normArgs = plan.normalized.args;

  if (!normCmd || !String(normCmd).trim()) {
    return fail('validation_error', 10, 'Error: "gsd-sdk query" requires a command', { reason: 'empty_normalized_command' });
  }

  if (plan.mode === 'error') {
    const noMatch = queryArgs[0]
      ? explainQueryCommandNoMatch(queryArgs[0], queryArgs.slice(1), deps.registry)
      : null;
    return fail(
      'unknown_command',
      10,
      `Error: Unknown command: "${[normCmd, ...normArgs].join(' ')}". Use a registered \`gsd-sdk query\` subcommand (see sdk/src/query/QUERY-HANDLERS.md) or invoke \`node …/gsd-tools.cjs\` for CJS-only operations. CJS fallback is disabled (GSD_QUERY_FALLBACK=registered). To enable fallback, unset GSD_QUERY_FALLBACK or set it to a non-restricted value.${noMatch ? ` Attempted dotted: ${noMatch.attempted.dotted.slice(0, 2).join(' | ')}.` : ''}`,
      { normalized: [normCmd, ...normArgs].join(' '), attempted: noMatch?.attempted.dotted.slice(0, 2) ?? [] },
    );
  }

  if (plan.mode === 'cjs') {
    try {
      const gsdPath = deps.resolveGsdToolsPath(deps.projectDir);
      return await runCjsFallbackDispatch({
        projectDir: deps.projectDir,
        gsdToolsPath: gsdPath,
        normCmd,
        normArgs,
        ws: deps.ws,
        pickField,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail('fallback_failure', 1, `Error: gsd-tools.cjs fallback failed: ${msg}`, {
        command: normCmd,
        args: normArgs,
        backend: 'cjs',
      });
    }
  }

  const matched = plan.matched!;
  try {
    const result = await deps.dispatchNative(matched.cmd, matched.args);
    return success(formatOutput(result.data, result.format, pickField));
  } catch (e) {
    return toDispatchFailure(mapNativeDispatchError(e, matched.cmd, matched.args));
  }
}
