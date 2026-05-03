import {
  QUERY_MUTATION_COMMAND_LIST,
  TRANSPORT_RAW_COMMANDS,
  isQueryMutationCommand,
} from './query-command-semantics.js';

export const QUERY_POLICY_SNAPSHOT = {
  mutation_commands: QUERY_MUTATION_COMMAND_LIST,
  raw_output_commands: TRANSPORT_RAW_COMMANDS,
} as const;

const MUTATION_SET = new Set(QUERY_POLICY_SNAPSHOT.mutation_commands);
const RAW_OUTPUT_SET = new Set(QUERY_POLICY_SNAPSHOT.raw_output_commands);

export function supportsMutationCommand(command: string): boolean {
  return MUTATION_SET.has(command);
}

export function supportsRawOutputCommand(command: string): boolean {
  return RAW_OUTPUT_SET.has(command);
}

export {
  QUERY_MUTATION_COMMAND_LIST,
  TRANSPORT_RAW_COMMANDS,
  isQueryMutationCommand,
};
