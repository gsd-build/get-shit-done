import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';
import type { AliasCatalogEntry } from './command-catalog.js';

export interface RegistryAssemblyAliasGroup {
  family: string;
  aliases: readonly AliasCatalogEntry[];
  handlers: Readonly<Record<string, QueryHandler>>;
}

export interface RegistryAssemblyStaticGroup {
  name: string;
  entries: ReadonlyArray<readonly [command: string, handler: QueryHandler]>;
}

export interface RegistryAssemblyInputs {
  staticGroups: readonly RegistryAssemblyStaticGroup[];
  aliasGroups: readonly RegistryAssemblyAliasGroup[];
  mutationCommands: ReadonlySet<string>;
  rawOutputPolicyCommands: readonly string[];
}

function toSortedList(values: Iterable<string>): string[] {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function assertNoDuplicateRegisteredCommands(inputs: RegistryAssemblyInputs): void {
  const counts = new Map<string, number>();

  for (const group of inputs.staticGroups) {
    for (const [command] of group.entries) {
      counts.set(command, (counts.get(command) ?? 0) + 1);
    }
  }

  for (const group of inputs.aliasGroups) {
    for (const entry of group.aliases) {
      counts.set(entry.canonical, (counts.get(entry.canonical) ?? 0) + 1);
      for (const alias of entry.aliases) {
        counts.set(alias, (counts.get(alias) ?? 0) + 1);
      }
    }
  }

  const duplicates = toSortedList(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([command]) => command),
  );

  if (duplicates.length > 0) {
    throw new Error(`registry assembly invariant failed: duplicate command keys: ${duplicates.join(', ')}`);
  }
}

export function assertAliasCanonicalsHaveHandlers(inputs: RegistryAssemblyInputs): void {
  const missing: string[] = [];
  for (const group of inputs.aliasGroups) {
    for (const entry of group.aliases) {
      if (!group.handlers[entry.canonical]) {
        missing.push(`${group.family}:${entry.canonical}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`registry assembly invariant failed: alias canonical missing handler: ${toSortedList(missing).join(', ')}`);
  }
}

export function assertMutationCommandsRegistered(
  registry: QueryRegistry,
  mutationCommands: ReadonlySet<string>,
): void {
  const missing = toSortedList(Array.from(mutationCommands).filter((command) => !registry.has(command)));
  if (missing.length > 0) {
    throw new Error(`registry assembly invariant failed: mutation command missing from registry: ${missing.join(', ')}`);
  }
}

export function assertRawOutputPolicyCommandsRegistered(
  registry: QueryRegistry,
  rawOutputPolicyCommands: readonly string[],
): void {
  const missing = toSortedList(rawOutputPolicyCommands.filter((command) => !registry.has(command)));
  if (missing.length > 0) {
    throw new Error(`registry assembly invariant failed: raw-output policy command missing from registry: ${missing.join(', ')}`);
  }
}
