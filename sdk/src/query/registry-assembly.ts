import { QueryRegistry } from './registry.js';
import type { AliasCatalogEntry } from './command-catalog.js';
import type { CommandFamily } from './command-manifest.types.js';
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
import { COMMAND_DEFINITIONS_BY_FAMILY, type CommandDefinition } from './command-definition.js';
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

function toAliasCatalogEntry(entry: CommandDefinition): AliasCatalogEntry {
  return {
    canonical: entry.canonical,
    aliases: entry.aliases,
  };
}

function buildAliasGroup(family: CommandFamily): RegistryAssemblyAliasGroup {
  const definitions = COMMAND_DEFINITIONS_BY_FAMILY[family];
  const familyHandlers = FAMILY_HANDLERS[family] as Readonly<Record<string, QueryHandler>>;
  const handlers: Record<string, QueryHandler> = {};

  for (const entry of definitions) {
    const handler = familyHandlers[entry.handler_key];
    if (!handler) continue;
    handlers[entry.canonical] = handler;
  }

  return {
    family,
    aliases: definitions.map(toAliasCatalogEntry),
    handlers,
  };
}

const ALIAS_GROUPS: readonly RegistryAssemblyAliasGroup[] = [
  buildAliasGroup('state'),
  buildAliasGroup('roadmap'),
  buildAliasGroup('verify'),
  buildAliasGroup('validate'),
  buildAliasGroup('phase'),
  buildAliasGroup('phases'),
  buildAliasGroup('init'),
] as const;

const ALIAS_GROUP_BY_FAMILY = Object.fromEntries(
  ALIAS_GROUPS.map((group) => [group.family, group]),
) as Readonly<Record<CommandFamily, RegistryAssemblyAliasGroup>>;

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
  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.state.aliases, ALIAS_GROUP_BY_FAMILY.state.handlers);

  registerStaticCatalog(registry, STATE_SUPPORT_STATIC_CATALOG);
  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.roadmap.aliases, ALIAS_GROUP_BY_FAMILY.roadmap.handlers);

  registerStaticCatalog(registry, MUTATION_SURFACES_STATIC_CATALOG);

  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.verify.aliases, ALIAS_GROUP_BY_FAMILY.verify.handlers);

  registerStaticCatalog(registry, VERIFY_DECISION_STATIC_CATALOG);
  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.validate.aliases, ALIAS_GROUP_BY_FAMILY.validate.handlers);

  registerStaticCatalog(registry, DECISION_ROUTING_STATIC_CATALOG);

  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.phase.aliases, ALIAS_GROUP_BY_FAMILY.phase.handlers);

  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.phases.aliases, ALIAS_GROUP_BY_FAMILY.phases.handlers);

  registerAliasCatalog(registry, ALIAS_GROUP_BY_FAMILY.init.aliases, ALIAS_GROUP_BY_FAMILY.init.handlers);

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
