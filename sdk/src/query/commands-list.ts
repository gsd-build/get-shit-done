import type { QueryHandler } from './utils.js';
import { createRegistry } from './index.js';

/**
 * `commands` — return the full list of registered query command strings.
 *
 * Closes #3121: the `commands` verb was referenced in workflow files
 * (references/workstream-flag.md) but had no native SDK handler, causing
 * a fallback to gsd-tools.cjs which threw "Unknown command: commands".
 *
 * Returns: JSON array of all canonical + alias command strings the SDK
 * registry accepts, sorted alphabetically. Suitable for discoverability
 * and for agent auto-complete when constructing `gsd-sdk query` calls.
 */
export const commandsList: QueryHandler<string[]> = async (_args, _projectDir) => {
  const registry = createRegistry();
  const cmds = registry.commands().sort((a, b) => a.localeCompare(b));
  return { data: cmds };
};
