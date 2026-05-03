import { QUERY_POLICY_SNAPSHOT } from './query-policy-snapshot.js';

const MUTATION_SET = new Set(QUERY_POLICY_SNAPSHOT.mutation_commands);
const RAW_OUTPUT_SET = new Set(QUERY_POLICY_SNAPSHOT.raw_output_commands);

export function supportsMutationCommand(command: string): boolean {
  return MUTATION_SET.has(command);
}

export function supportsRawOutputCommand(command: string): boolean {
  return RAW_OUTPUT_SET.has(command);
}
