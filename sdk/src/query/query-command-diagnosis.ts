import { explainQueryCommandNoMatch, type QueryCommandRegistryLike } from './query-command-semantics.js';
import { UNKNOWN_COMMAND_HINTS } from './query-unknown-command-hints.js';
import { describeFallbackDisabledPolicy } from './query-fallback-policy.js';

export interface UnknownCommandDiagnosis {
  normalized: string;
  attempted: string[];
  hints: string[];
  message: string;
}

export function diagnoseUnknownCommand(
  command: string,
  args: string[],
  registry: QueryCommandRegistryLike,
  fallbackRestricted: boolean,
): UnknownCommandDiagnosis {
  const noMatch = explainQueryCommandNoMatch(command, args, registry);
  const normalized = [noMatch.normalized.command, ...noMatch.normalized.args].join(' ');
  const attempted = noMatch.attempted.dotted.slice(0, 2);
  const hints = [...UNKNOWN_COMMAND_HINTS];
  const attemptedSuffix = attempted.length > 0 ? ` Attempted dotted: ${attempted.join(' | ')}.` : '';
  const fallbackClause = fallbackRestricted ? `${describeFallbackDisabledPolicy()} ` : '';
  const message = `Error: Unknown command: "${normalized}". ${hints[0]} ${hints[1]} ${fallbackClause}${hints[2]}${attemptedSuffix}`;

  return {
    normalized,
    attempted,
    hints,
    message,
  };
}
