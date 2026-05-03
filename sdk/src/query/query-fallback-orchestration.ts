import type { QueryRegistry } from './registry.js';
import { normalizeQueryCommand } from './normalize-query-command.js';
import { resolveQueryCommand, type QueryCommandResolution } from './command-resolution.js';

export type QueryDispatchMode = 'native' | 'cjs' | 'error';

export type QueryDispatchReason =
  | 'native-match'
  | 'fallback-to-cjs'
  | 'fallback-disabled'
  | 'missing-command';

export interface QueryDispatchPlan {
  mode: QueryDispatchMode;
  reason: QueryDispatchReason;
  normalized: {
    command: string;
    args: string[];
    tokens: string[];
  };
  matched: QueryCommandResolution | null;
}

export function planQueryDispatch(
  queryArgv: string[],
  registry: QueryRegistry,
  opts: { cjsFallbackEnabled: boolean },
): QueryDispatchPlan {
  const queryCommand = queryArgv[0];
  if (!queryCommand) {
    return {
      mode: 'error',
      reason: 'missing-command',
      normalized: { command: '', args: [], tokens: [] },
      matched: null,
    };
  }

  const [normCmd, normArgs] = normalizeQueryCommand(queryCommand, queryArgv.slice(1));
  const normalizedTokens = [normCmd, ...normArgs];
  const matched = resolveQueryCommand(queryCommand, queryArgv.slice(1), registry);

  if (matched) {
    return {
      mode: 'native',
      reason: 'native-match',
      normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens },
      matched,
    };
  }

  if (opts.cjsFallbackEnabled) {
    return {
      mode: 'cjs',
      reason: 'fallback-to-cjs',
      normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens },
      matched: null,
    };
  }

  return {
    mode: 'error',
    reason: 'fallback-disabled',
    normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens },
    matched: null,
  };
}
