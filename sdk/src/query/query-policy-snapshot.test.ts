import { describe, it, expect } from 'vitest';
import { QUERY_POLICY_SNAPSHOT, QUERY_MUTATION_COMMAND_LIST, TRANSPORT_RAW_COMMANDS } from './query-policy-snapshot.js';

describe('query-policy-snapshot', () => {
  it('exposes policy constants through one snapshot interface', () => {
    expect(QUERY_POLICY_SNAPSHOT.mutation_commands).toBe(QUERY_MUTATION_COMMAND_LIST);
    expect(QUERY_POLICY_SNAPSHOT.raw_output_commands).toBe(TRANSPORT_RAW_COMMANDS);
  });
});
