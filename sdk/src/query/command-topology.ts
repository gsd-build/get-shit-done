import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';
import { resolveQueryCommand } from './query-command-resolution-strategy.js';
import { diagnoseUnknownCommand } from './query-command-diagnosis.js';
import { supportsMutationCommand, supportsRawOutputCommand } from './query-policy-capability.js';

export type CommandTopologyOutputMode = 'json' | 'text' | 'raw';

export interface CommandTopologyMatch {
  kind: 'match';
  canonical: string;
  args: string[];
  output_mode: CommandTopologyOutputMode;
  mutation: boolean;
  adapter: QueryHandler;
}

export interface CommandTopologyNoMatch {
  kind: 'no_match';
  attempted: string[];
  normalized?: string;
  hints: string[];
  message: string;
}

export type CommandTopologyResult = CommandTopologyMatch | CommandTopologyNoMatch;

export interface CommandTopology {
  resolve(tokens: string[], fallbackRestricted?: boolean): CommandTopologyResult;
}

export function createCommandTopology(registry: QueryRegistry): CommandTopology {
  return {
    resolve(tokens: string[], fallbackRestricted = false): CommandTopologyResult {
      const command = tokens[0];
      const args = tokens.slice(1);
      if (!command) {
        return {
          kind: 'no_match',
          attempted: [],
          hints: [],
          message: 'Error: "gsd-sdk query" requires a command',
        };
      }

      const matched = resolveQueryCommand(command, args, registry);
      if (!matched) {
        const diagnosis = diagnoseUnknownCommand(command, args, registry, fallbackRestricted);
        return {
          kind: 'no_match',
          normalized: diagnosis.normalized,
          attempted: diagnosis.attempted,
          hints: diagnosis.hints,
          message: diagnosis.message,
        };
      }

      const adapter = registry.getHandler(matched.cmd);
      if (!adapter) {
        const diagnosis = diagnoseUnknownCommand(command, args, registry, fallbackRestricted);
        return {
          kind: 'no_match',
          normalized: diagnosis.normalized,
          attempted: diagnosis.attempted,
          hints: diagnosis.hints,
          message: diagnosis.message,
        };
      }

      return {
        kind: 'match',
        canonical: matched.cmd,
        args: matched.args,
        output_mode: supportsRawOutputCommand(matched.cmd) ? 'raw' : 'json',
        mutation: supportsMutationCommand(matched.cmd),
        adapter,
      };
    },
  };
}
