import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';

export interface AliasCatalogEntry {
  canonical: string;
  aliases: string[];
}

export function registerAliasCatalog(
  registry: QueryRegistry,
  aliases: readonly AliasCatalogEntry[],
  handlers: Readonly<Record<string, QueryHandler>>,
): void {
  for (const entry of aliases) {
    const handler = handlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }
}

export function registerStaticCatalog(
  registry: QueryRegistry,
  entries: ReadonlyArray<readonly [command: string, handler: QueryHandler]>,
): void {
  for (const [command, handler] of entries) {
    registry.register(command, handler);
  }
}
