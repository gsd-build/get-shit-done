import { describe, it, expect } from 'vitest';
import { QUERY_POLICY_SNAPSHOT, supportsMutationCommand, supportsRawOutputCommand } from './query-policy-capability.js';

describe('query-policy-capability', () => {
  it('exposes snapshot + predicates', () => {
    expect(QUERY_POLICY_SNAPSHOT.mutation_commands.length).toBeGreaterThan(0);
    expect(supportsMutationCommand('state.update')).toBe(true);
    expect(supportsRawOutputCommand('state.load')).toBe(true);
  });
});
