import { normalizeQueryCommand } from './normalize-query-command.js';

export interface QueryCommandRegistryLike {
  has(command: string): boolean;
}

export type QueryMatchMode = 'dotted' | 'spaced';
export type QueryResolutionSource = 'normalized' | 'expanded';

export interface QueryCommandResolution {
  cmd: string;
  args: string[];
  matchedBy: QueryMatchMode;
  expanded: boolean;
  source: QueryResolutionSource;
}

function expandFirstDottedToken(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens;
  const first = tokens[0];
  if (first.startsWith('--') || !first.includes('.')) return tokens;
  return [...first.split('.'), ...tokens.slice(1)];
}

function matchRegisteredPrefix(
  tokens: string[],
  registry: QueryCommandRegistryLike,
): { cmd: string; args: string[]; matchedBy: QueryMatchMode } | null {
  for (let i = tokens.length; i >= 1; i--) {
    const head = tokens.slice(0, i);
    const dotted = head.join('.');
    const spaced = head.join(' ');
    if (registry.has(dotted)) {
      return { cmd: dotted, args: tokens.slice(i), matchedBy: 'dotted' };
    }
    if (registry.has(spaced)) {
      return { cmd: spaced, args: tokens.slice(i), matchedBy: 'spaced' };
    }
  }
  return null;
}

export function resolveQueryTokens(
  tokens: string[],
  registry: QueryCommandRegistryLike,
): QueryCommandResolution | null {
  const direct = matchRegisteredPrefix(tokens, registry);
  if (direct) {
    return { ...direct, expanded: false, source: 'normalized' };
  }

  const expanded = expandFirstDottedToken(tokens);
  if (expanded !== tokens) {
    const afterExpand = matchRegisteredPrefix(expanded, registry);
    if (afterExpand) {
      return { ...afterExpand, expanded: true, source: 'expanded' };
    }
  }

  return null;
}

export function resolveQueryCommand(
  command: string,
  args: string[],
  registry: QueryCommandRegistryLike,
): QueryCommandResolution | null {
  const [normCmd, normArgs] = normalizeQueryCommand(command, args);
  return resolveQueryTokens([normCmd, ...normArgs], registry);
}
