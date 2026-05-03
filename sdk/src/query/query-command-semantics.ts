import {
  STATE_SUBCOMMANDS,
  VERIFY_SUBCOMMANDS,
  INIT_SUBCOMMANDS,
  PHASE_SUBCOMMANDS,
  PHASES_SUBCOMMANDS,
  VALIDATE_SUBCOMMANDS,
  ROADMAP_SUBCOMMANDS,
  STATE_MUTATION_COMMANDS,
  PHASE_MUTATION_COMMANDS,
  PHASES_MUTATION_COMMANDS,
  ROADMAP_MUTATION_COMMANDS,
} from './command-aliases.generated.js';

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

export interface QueryCommandNoMatch {
  normalized: { command: string; args: string[]; tokens: string[] };
  attempted: { dotted: string[]; spaced: string[]; expandedTokens: string[] | null };
}

const MERGE_FIRST_WITH_SUBCOMMAND = new Set<string>([
  'state',
  'template',
  'frontmatter',
  'verify',
  'phase',
  'requirements',
  'init',
  'workstream',
  'intel',
  'learnings',
  'uat',
  'todo',
  'milestone',
  'check',
  'detect',
  'route',
]);

export const QUERY_MUTATION_COMMAND_LIST: readonly string[] = [
  ...STATE_MUTATION_COMMANDS,
  'frontmatter.set', 'frontmatter.merge', 'frontmatter.validate', 'frontmatter validate',
  'config-set', 'config-set-model-profile', 'config-new-project', 'config-ensure-section',
  'commit', 'check-commit', 'commit-to-subrepo',
  'template.fill', 'template.select', 'template select',
  ...PHASE_MUTATION_COMMANDS,
  ...PHASES_MUTATION_COMMANDS,
  ...ROADMAP_MUTATION_COMMANDS,
  'requirements.mark-complete', 'requirements mark-complete',
  'todo.complete', 'todo complete',
  'milestone.complete', 'milestone complete',
  'workstream.create', 'workstream.set', 'workstream.complete', 'workstream.progress',
  'workstream create', 'workstream set', 'workstream complete', 'workstream progress',
  'docs-init',
  'learnings.copy', 'learnings copy',
  'learnings.prune', 'learnings prune',
  'learnings.delete', 'learnings delete',
  'intel.snapshot', 'intel.patch-meta', 'intel snapshot', 'intel patch-meta',
  'write-profile', 'generate-claude-profile', 'generate-dev-preferences', 'generate-claude-md',
] as const;

export const TRANSPORT_RAW_COMMANDS: readonly string[] = [
  'commit',
  'config-set',
  'verify-summary',
  'verify.summary',
  'verify summary',
] as const;

const QUERY_MUTATION_COMMAND_SET = new Set(QUERY_MUTATION_COMMAND_LIST);

export function isQueryMutationCommand(command: string): boolean {
  return QUERY_MUTATION_COMMAND_SET.has(command);
}

export function normalizeQueryCommand(command: string, args: string[]): [string, string[]] {
  if (command === 'scaffold') return ['phase.scaffold', args];
  if (command === 'state' && args.length === 0) return ['state.load', []];

  if (command === 'state' && args.length > 0) {
    const sub = args[0];
    if (STATE_SUBCOMMANDS.has(sub)) return [`state.${sub}`, args.slice(1)];
    return [command, args];
  }
  if (command === 'verify' && args.length > 0) {
    const sub = args[0];
    if (VERIFY_SUBCOMMANDS.has(sub)) return [`verify.${sub}`, args.slice(1)];
    return [command, args];
  }
  if (command === 'init' && args.length > 0) {
    const sub = args[0];
    if (INIT_SUBCOMMANDS.has(sub)) return [`init.${sub}`, args.slice(1)];
    return [command, args];
  }
  if (command === 'phase' && args.length > 0) {
    const sub = args[0];
    if (PHASE_SUBCOMMANDS.has(sub)) return [`phase.${sub}`, args.slice(1)];
    return [command, args];
  }
  if (command === 'phases' && args.length > 0) {
    const sub = args[0];
    if (PHASES_SUBCOMMANDS.has(sub)) return [`phases.${sub}`, args.slice(1)];
    return [command, args];
  }
  if (command === 'validate' && args.length > 0) {
    const sub = args[0];
    if (VALIDATE_SUBCOMMANDS.has(sub)) return [`validate.${sub}`, args.slice(1)];
    return [command, args];
  }
  if (command === 'roadmap' && args.length > 0) {
    const sub = args[0];
    if (ROADMAP_SUBCOMMANDS.has(sub)) return [`roadmap.${sub}`, args.slice(1)];
    return [command, args];
  }

  if (MERGE_FIRST_WITH_SUBCOMMAND.has(command) && args.length > 0) {
    return [`${command}.${args[0]}`, args.slice(1)];
  }
  if ((command === 'progress' || command === 'stats') && args.length > 0 && !args[0].startsWith('-')) {
    return [`${command}.${args[0]}`, args.slice(1)];
  }
  return [command, args];
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
  track?: { dotted: string[]; spaced: string[] },
): { cmd: string; args: string[]; matchedBy: QueryMatchMode } | null {
  for (let i = tokens.length; i >= 1; i--) {
    const head = tokens.slice(0, i);
    const dotted = head.join('.');
    const spaced = head.join(' ');
    track?.dotted.push(dotted);
    track?.spaced.push(spaced);
    if (registry.has(dotted)) return { cmd: dotted, args: tokens.slice(i), matchedBy: 'dotted' };
    if (registry.has(spaced)) return { cmd: spaced, args: tokens.slice(i), matchedBy: 'spaced' };
  }
  return null;
}

export function resolveQueryTokens(
  tokens: string[],
  registry: QueryCommandRegistryLike,
): QueryCommandResolution | null {
  const direct = matchRegisteredPrefix(tokens, registry);
  if (direct) return { ...direct, expanded: false, source: 'normalized' };

  const expanded = expandFirstDottedToken(tokens);
  if (expanded !== tokens) {
    const afterExpand = matchRegisteredPrefix(expanded, registry);
    if (afterExpand) return { ...afterExpand, expanded: true, source: 'expanded' };
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

export function explainQueryCommandNoMatch(
  command: string,
  args: string[],
  registry: QueryCommandRegistryLike,
): QueryCommandNoMatch {
  const [normalizedCommand, normalizedArgs] = normalizeQueryCommand(command, args);
  const normalizedTokens = [normalizedCommand, ...normalizedArgs];
  const attempted = { dotted: [] as string[], spaced: [] as string[] };
  matchRegisteredPrefix(normalizedTokens, registry, attempted);

  const expandedTokens = expandFirstDottedToken(normalizedTokens);
  if (expandedTokens !== normalizedTokens) {
    matchRegisteredPrefix(expandedTokens, registry, attempted);
  }

  return {
    normalized: {
      command: normalizedCommand,
      args: normalizedArgs,
      tokens: normalizedTokens,
    },
    attempted: {
      dotted: attempted.dotted,
      spaced: attempted.spaced,
      expandedTokens: expandedTokens !== normalizedTokens ? expandedTokens : null,
    },
  };
}
