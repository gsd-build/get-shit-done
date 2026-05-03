import { normalizeQueryCommand } from './query-command-resolution-strategy.js';
import type { CommandTopology, CommandTopologyMatch } from './command-topology.js';

export type DispatchMode = 'native' | 'cjs' | 'error';

export interface DispatchPlan {
  mode: DispatchMode;
  normalized: { command: string; args: string[]; tokens: string[] };
  matched: CommandTopologyMatch | null;
  noMatchMessage?: string;
  noMatchNormalized?: string;
  noMatchAttempted?: string[];
  noMatchHints?: string[];
}

export function planQueryDispatch(
  queryArgv: string[],
  topology: CommandTopology,
  cjsFallbackEnabled: boolean,
): DispatchPlan {
  const queryCommand = queryArgv[0];
  if (!queryCommand) {
    return { mode: 'error', normalized: { command: '', args: [], tokens: [] }, matched: null };
  }

  const [normCmd, normArgs] = normalizeQueryCommand(queryCommand, queryArgv.slice(1));
  const normalizedTokens = [normCmd, ...normArgs];
  const resolved = topology.resolve(queryArgv, !cjsFallbackEnabled);

  if (resolved.kind === 'match') {
    return { mode: 'native', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: resolved };
  }

  if (cjsFallbackEnabled) {
    return { mode: 'cjs', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: null };
  }

  return {
    mode: 'error',
    normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens },
    matched: null,
    noMatchMessage: resolved.message,
    noMatchNormalized: resolved.normalized,
    noMatchAttempted: resolved.attempted,
    noMatchHints: resolved.hints,
  };
}
