import { QueryRegistry } from './registry.js';
import {
  STATE_COMMAND_ALIASES,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASES_COMMAND_ALIASES,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
} from './command-aliases.generated.js';
import { GSDEventStream } from '../event-stream.js';
import type { QueryHandler } from './utils.js';
import { registerAliasCatalog, registerStaticCatalog } from './command-catalog.js';
import {
  FOUNDATION_STATIC_CATALOG,
  STATE_SUPPORT_STATIC_CATALOG,
  MUTATION_SURFACES_STATIC_CATALOG,
  VERIFY_DECISION_STATIC_CATALOG,
  DECISION_ROUTING_STATIC_CATALOG,
} from './command-static-catalog-foundation.js';
import { DOMAIN_STATIC_CATALOG } from './command-static-catalog-domain.js';
import { QUERY_MUTATION_COMMAND_LIST, TRANSPORT_RAW_COMMANDS } from './policy-convergence.js';
import { decorateMutationsWithEvents } from './mutation-event-decorator.js';
import { FAMILY_HANDLERS } from './command-family-handlers.js';
import {
  assertAliasCanonicalsHaveHandlers,
  assertMutationCommandsRegistered,
  assertNoDuplicateRegisteredCommands,
  assertRawOutputPolicyCommandsRegistered,
  type RegistryAssemblyAliasGroup,
  type RegistryAssemblyStaticGroup,
} from './registry-assembly-invariants.js';

/**
 * Command names that perform durable writes (disk, git, or global profile store).
 */
export const QUERY_MUTATION_COMMANDS = new Set<string>(QUERY_MUTATION_COMMAND_LIST);

const STATIC_CATALOG_GROUPS: readonly RegistryAssemblyStaticGroup[] = [
  { name: 'FOUNDATION_STATIC_CATALOG', entries: FOUNDATION_STATIC_CATALOG },
  { name: 'STATE_SUPPORT_STATIC_CATALOG', entries: STATE_SUPPORT_STATIC_CATALOG },
  { name: 'MUTATION_SURFACES_STATIC_CATALOG', entries: MUTATION_SURFACES_STATIC_CATALOG },
  { name: 'VERIFY_DECISION_STATIC_CATALOG', entries: VERIFY_DECISION_STATIC_CATALOG },
  { name: 'DECISION_ROUTING_STATIC_CATALOG', entries: DECISION_ROUTING_STATIC_CATALOG },
  { name: 'DOMAIN_STATIC_CATALOG', entries: DOMAIN_STATIC_CATALOG },
] as const;

const ALIAS_GROUPS: readonly RegistryAssemblyAliasGroup[] = [
  { family: 'state', aliases: STATE_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.state as Record<string, QueryHandler> },
  { family: 'roadmap', aliases: ROADMAP_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.roadmap as Record<string, QueryHandler> },
  { family: 'verify', aliases: VERIFY_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.verify as Record<string, QueryHandler> },
  { family: 'validate', aliases: VALIDATE_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.validate as Record<string, QueryHandler> },
  { family: 'phase', aliases: PHASE_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.phase as Record<string, QueryHandler> },
  { family: 'phases', aliases: PHASES_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.phases as Record<string, QueryHandler> },
  { family: 'init', aliases: INIT_COMMAND_ALIASES, handlers: FAMILY_HANDLERS.init as Record<string, QueryHandler> },
] as const;

export function buildRegistry(): QueryRegistry {
  assertAliasCanonicalsHaveHandlers({
    staticGroups: STATIC_CATALOG_GROUPS,
    aliasGroups: ALIAS_GROUPS,
    mutationCommands: QUERY_MUTATION_COMMANDS,
    rawOutputPolicyCommands: TRANSPORT_RAW_COMMANDS,
  });
  assertNoDuplicateRegisteredCommands({
    staticGroups: STATIC_CATALOG_GROUPS,
    aliasGroups: ALIAS_GROUPS,
    mutationCommands: QUERY_MUTATION_COMMANDS,
    rawOutputPolicyCommands: TRANSPORT_RAW_COMMANDS,
  });

  const registry = new QueryRegistry();

  registerStaticCatalog(registry, FOUNDATION_STATIC_CATALOG);
  registerAliasCatalog(registry, STATE_COMMAND_ALIASES, FAMILY_HANDLERS.state as Record<string, QueryHandler>);

  registerStaticCatalog(registry, STATE_SUPPORT_STATIC_CATALOG);
  registerAliasCatalog(registry, ROADMAP_COMMAND_ALIASES, FAMILY_HANDLERS.roadmap as Record<string, QueryHandler>);

  registerStaticCatalog(registry, MUTATION_SURFACES_STATIC_CATALOG);

  registerAliasCatalog(registry, VERIFY_COMMAND_ALIASES, FAMILY_HANDLERS.verify as Record<string, QueryHandler>);

  registerStaticCatalog(registry, VERIFY_DECISION_STATIC_CATALOG);
  registerAliasCatalog(registry, VALIDATE_COMMAND_ALIASES, FAMILY_HANDLERS.validate as Record<string, QueryHandler>);

  registerStaticCatalog(registry, DECISION_ROUTING_STATIC_CATALOG);

  registerAliasCatalog(registry, PHASE_COMMAND_ALIASES, FAMILY_HANDLERS.phase as Record<string, QueryHandler>);

  registerAliasCatalog(registry, PHASES_COMMAND_ALIASES, FAMILY_HANDLERS.phases as Record<string, QueryHandler>);

  registerAliasCatalog(registry, INIT_COMMAND_ALIASES, FAMILY_HANDLERS.init as Record<string, QueryHandler>);

  registerStaticCatalog(registry, DOMAIN_STATIC_CATALOG);

  assertMutationCommandsRegistered(registry, QUERY_MUTATION_COMMANDS);
  assertRawOutputPolicyCommandsRegistered(registry, TRANSPORT_RAW_COMMANDS);

  return registry;
}

export function decorateRegistryMutations(
  registry: QueryRegistry,
  eventStream?: GSDEventStream,
  correlationSessionId?: string,
): void {
  if (!eventStream) return;
  const mutationSessionId = correlationSessionId ?? '';
  decorateMutationsWithEvents(registry, QUERY_MUTATION_COMMANDS, eventStream, mutationSessionId);
}

export function createRegistry(
  eventStream?: GSDEventStream,
  correlationSessionId?: string,
): QueryRegistry {
  const registry = buildRegistry();
  decorateRegistryMutations(registry, eventStream, correlationSessionId);
  return registry;
}
