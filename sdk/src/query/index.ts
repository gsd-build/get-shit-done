/** Query module entry point — thin seam. */

export { createRegistry, buildRegistry, decorateRegistryMutations, QUERY_MUTATION_COMMANDS } from './registry-assembly.js';

export type { QueryResult, QueryHandler } from './utils.js';
export { extractField } from './registry.js';
export { normalizeQueryCommand } from './query-command-resolution-strategy.js';
export { createCommandTopology } from './command-topology.js';
export type { CommandTopology, CommandTopologyResult, CommandTopologyMatch, CommandTopologyNoMatch } from './command-topology.js';
