import { COMMAND_MANIFEST } from './command-manifest.js';
import type { CommandFamily, OutputMode } from './command-manifest.types.js';

export interface CommandDefinition {
  family: CommandFamily;
  canonical: string;
  aliases: string[];
  mutation: boolean;
  output_mode: OutputMode;
  handler_key: string;
}

export const COMMAND_DEFINITIONS: readonly CommandDefinition[] = COMMAND_MANIFEST.map((entry) => ({
  family: entry.family,
  canonical: entry.canonical,
  aliases: [...entry.aliases],
  mutation: entry.mutation,
  output_mode: entry.outputMode,
  handler_key: entry.handlerKey ?? entry.canonical,
})) as readonly CommandDefinition[];

function byFamily(family: CommandFamily): readonly CommandDefinition[] {
  return COMMAND_DEFINITIONS.filter((entry) => entry.family === family);
}

export const COMMAND_DEFINITIONS_BY_FAMILY: Readonly<Record<CommandFamily, readonly CommandDefinition[]>> = {
  state: byFamily('state'),
  verify: byFamily('verify'),
  init: byFamily('init'),
  phase: byFamily('phase'),
  phases: byFamily('phases'),
  validate: byFamily('validate'),
  roadmap: byFamily('roadmap'),
} as const;

export const FAMILY_MUTATION_COMMANDS: readonly string[] = COMMAND_DEFINITIONS
  .filter((entry) => entry.mutation)
  .flatMap((entry) => [entry.canonical, ...entry.aliases]);

export const FAMILY_RAW_OUTPUT_COMMANDS: readonly string[] = COMMAND_DEFINITIONS
  .filter((entry) => entry.output_mode === 'raw')
  .flatMap((entry) => [entry.canonical, ...entry.aliases]);
