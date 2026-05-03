import { explainQueryCommandNoMatch, type QueryCommandRegistryLike } from './query-command-semantics.js';

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
): UnknownCommandDiagnosis {
  const noMatch = explainQueryCommandNoMatch(command, args, registry);
  const normalized = [noMatch.normalized.command, ...noMatch.normalized.args].join(' ');
  const attempted = noMatch.attempted.dotted.slice(0, 2);
  const hints = [
    'Use a registered `gsd-sdk query` subcommand (see sdk/src/query/QUERY-HANDLERS.md).',
    'Invoke `node …/gsd-tools.cjs` for CJS-only operations.',
    'Unset GSD_QUERY_FALLBACK or set it to a non-restricted value to enable fallback.',
  ];
  const attemptedSuffix = attempted.length > 0 ? ` Attempted dotted: ${attempted.join(' | ')}.` : '';
  const message = `Error: Unknown command: "${normalized}". ${hints[0]} ${hints[1]} CJS fallback is disabled (GSD_QUERY_FALLBACK=registered). ${hints[2]}${attemptedSuffix}`;

  return {
    normalized,
    attempted,
    hints,
    message,
  };
}
