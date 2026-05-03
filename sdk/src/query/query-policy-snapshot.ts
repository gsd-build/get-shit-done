import {
  QUERY_MUTATION_COMMAND_LIST,
  TRANSPORT_RAW_COMMANDS,
  isQueryMutationCommand,
} from './query-command-semantics.js';

export const QUERY_POLICY_SNAPSHOT = {
  mutation_commands: QUERY_MUTATION_COMMAND_LIST,
  raw_output_commands: TRANSPORT_RAW_COMMANDS,
} as const;

export {
  QUERY_MUTATION_COMMAND_LIST,
  TRANSPORT_RAW_COMMANDS,
  isQueryMutationCommand,
};
