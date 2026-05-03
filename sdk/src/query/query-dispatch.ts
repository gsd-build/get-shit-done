import type { QueryRegistry } from './registry.js';
import { runCjsFallbackDispatch } from './query-fallback-executor.js';
import type { QueryDispatchResult } from './query-dispatch-contract.js';
import type { QueryResult } from './utils.js';
import { mapFallbackDispatchError, mapNativeDispatchError, toDispatchFailure } from './query-dispatch-error-mapper.js';
import { formatSuccess } from './query-dispatch-formatting.js';
import { diagnoseUnknownCommand } from './query-command-diagnosis.js';
import { unknownCommandError, validationError } from './query-error-taxonomy.js';
import { planQueryDispatch } from './query-dispatch-plan.js';
import { validateQueryDispatchInput } from './query-dispatch-input-validation.js';
import { dispatchSuccess } from './query-dispatch-result-builder.js';
import { canUseCjsFallback } from './query-fallback-policy.js';

export interface QueryDispatchDeps {
  registry: QueryRegistry;
  projectDir: string;
  ws?: string;
  cjsFallbackEnabled: boolean;
  resolveGsdToolsPath: (projectDir: string) => string;
  dispatchNative: (cmd: string, args: string[]) => Promise<QueryResult>;
}


function fail(error: ReturnType<typeof validationError> | ReturnType<typeof unknownCommandError>, stderr: string[] = []): QueryDispatchResult {
  return toDispatchFailure(error, stderr);
}


export async function runQueryDispatch(deps: QueryDispatchDeps, queryArgv: string[]): Promise<QueryDispatchResult> {
  const validated = validateQueryDispatchInput(queryArgv);
  if (validated.error) return validated.error;

  const { queryArgs, pickField } = validated;

  const plan = planQueryDispatch(queryArgs, deps.registry, deps.cjsFallbackEnabled);
  const normCmd = plan.normalized.command;
  const normArgs = plan.normalized.args;

  if (!normCmd || !String(normCmd).trim()) {
    return fail(validationError({ message: 'Error: "gsd-sdk query" requires a command', details: { reason: 'empty_normalized_command' } }));
  }

  if (plan.mode === 'error') {
    const diagnosis = diagnoseUnknownCommand(queryArgs[0] ?? normCmd, queryArgs.slice(1), deps.registry, !deps.cjsFallbackEnabled);
    return fail(unknownCommandError({
      message: diagnosis.message,
      normalized: diagnosis.normalized,
      attempted: diagnosis.attempted,
      hints: diagnosis.hints,
    }));
  }

  if (plan.mode === 'cjs') {
    if (canUseCjsFallback({ cjsFallbackEnabled: deps.cjsFallbackEnabled })) {
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
        return toDispatchFailure(mapFallbackDispatchError(e, normCmd, normArgs));
      }
    }
    return toDispatchFailure(mapFallbackDispatchError(new Error('CJS fallback denied by policy'), normCmd, normArgs));
  }

  const matched = plan.matched;
  if (!matched) {
    return toDispatchFailure(mapFallbackDispatchError(new Error('No native match in dispatch plan'), normCmd, normArgs));
  }
  try {
    const result = await deps.dispatchNative(matched.cmd, matched.args);
    return dispatchSuccess(formatSuccess(result.data, result.format, pickField));
  } catch (e) {
    return toDispatchFailure(mapNativeDispatchError(e, matched.cmd, matched.args));
  }
}
