import {
  STATE_MUTATION_COMMANDS,
  PHASE_MUTATION_COMMANDS,
  PHASES_MUTATION_COMMANDS,
  ROADMAP_MUTATION_COMMANDS,
} from './command-aliases.generated.js';

/**
 * Shared policy data consumed by query registry wiring and transport policy wiring.
 */

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
