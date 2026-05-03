import { FAMILY_MUTATION_COMMANDS, FAMILY_RAW_OUTPUT_COMMANDS } from './command-definition.js';

export const QUERY_MUTATION_COMMAND_LIST: readonly string[] = [
  ...FAMILY_MUTATION_COMMANDS,
  'frontmatter.set', 'frontmatter.merge', 'frontmatter.validate', 'frontmatter validate',
  'config-set', 'config-set-model-profile', 'config-new-project', 'config-ensure-section',
  'commit', 'check-commit', 'commit-to-subrepo',
  'template.fill', 'template.select', 'template select',
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

const NON_FAMILY_RAW_OUTPUT_COMMANDS = [
  'commit',
  'config-set',
  'verify-summary',
  'verify.summary',
  'verify summary',
] as const;

export const TRANSPORT_RAW_COMMANDS: readonly string[] = [
  ...FAMILY_RAW_OUTPUT_COMMANDS,
  ...NON_FAMILY_RAW_OUTPUT_COMMANDS,
] as const;

const QUERY_MUTATION_COMMAND_SET = new Set(QUERY_MUTATION_COMMAND_LIST);

export function isQueryMutationCommand(command: string): boolean {
  return QUERY_MUTATION_COMMAND_SET.has(command);
}

export {
  normalizeQueryCommand,
  resolveQueryTokens,
  resolveQueryCommand,
  explainQueryCommandNoMatch,
  type QueryCommandRegistryLike,
  type QueryCommandResolution,
  type QueryMatchMode,
  type QueryResolutionSource,
  type QueryCommandNoMatch,
} from './query-command-resolution-strategy.js';
