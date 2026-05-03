import type { QueryRegistry } from './registry.js';
import { normalizeQueryCommand } from './normalize-query-command.js';
import { resolveQueryCommand, type QueryCommandResolution } from './command-resolution.js';
import { runCjsFallbackDispatch } from './query-fallback-executor.js';
import type { QueryDispatchResult } from './query-dispatch-contract.js';
import type { QueryResult } from './utils.js';
import { mapNativeDispatchError, toDispatchFailure } from './query-dispatch-error-mapper.js';
import { formatSuccess } from './query-dispatch-formatting.js';
import { diagnoseUnknownCommand } from './query-command-diagnosis.js';
import { fallbackFailureError, unknownCommandError, validationError } from './query-error-taxonomy.js';

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

function fail(error: ReturnType<typeof validationError> | ReturnType<typeof unknownCommandError> | ReturnType<typeof fallbackFailureError>, stderr: string[] = []): QueryDispatchResult {
  return toDispatchFailure(error, stderr);
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
      error: fail(validationError({ message: 'Error: --pick requires a field name', details: { field: '--pick', reason: 'missing_value' } })),
    };
  }
  const pickField = queryArgs[pickIdx + 1];
  queryArgs.splice(pickIdx, 2);
  return { queryArgs, pickField };
}


export async function runQueryDispatch(deps: QueryDispatchDeps, queryArgv: string[]): Promise<QueryDispatchResult> {
  const picked = extractPick(queryArgv);
  if (picked.error) return picked.error;

  const { queryArgs, pickField } = picked;
  if (queryArgs.length === 0 || !queryArgs[0]) {
    return fail(validationError({ message: 'Error: "gsd-sdk query" requires a command', details: { reason: 'missing_command' } }));
  }

  const plan = planQueryDispatch(queryArgs, deps.registry, deps.cjsFallbackEnabled);
  const normCmd = plan.normalized.command;
  const normArgs = plan.normalized.args;

  if (!normCmd || !String(normCmd).trim()) {
    return fail(validationError({ message: 'Error: "gsd-sdk query" requires a command', details: { reason: 'empty_normalized_command' } }));
  }

  if (plan.mode === 'error') {
    const diagnosis = diagnoseUnknownCommand(queryArgs[0] ?? normCmd, queryArgs.slice(1), deps.registry);
    return fail(unknownCommandError({
      message: diagnosis.message,
      normalized: diagnosis.normalized,
      attempted: diagnosis.attempted,
      hints: diagnosis.hints,
    }));
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
      return fail(fallbackFailureError({
        message: msg,
        command: normCmd,
        args: normArgs,
        backend: 'cjs',
      }));
    }
  }

  const matched = plan.matched!;
  try {
    const result = await deps.dispatchNative(matched.cmd, matched.args);
    return success(formatSuccess(result.data, result.format, pickField));
  } catch (e) {
    return toDispatchFailure(mapNativeDispatchError(e, matched.cmd, matched.args));
  }
}
