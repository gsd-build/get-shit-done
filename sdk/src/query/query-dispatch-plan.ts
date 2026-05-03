import type { QueryRegistry } from './registry.js';
import { normalizeQueryCommand } from './normalize-query-command.js';
import { resolveQueryCommand, type QueryCommandResolution } from './command-resolution.js';

export type DispatchMode = 'native' | 'cjs' | 'error';

export interface DispatchPlan {
  mode: DispatchMode;
  normalized: { command: string; args: string[]; tokens: string[] };
  matched: QueryCommandResolution | null;
}

export function planQueryDispatch(
  queryArgv: string[],
  registry: QueryRegistry,
  cjsFallbackEnabled: boolean,
): DispatchPlan {
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
