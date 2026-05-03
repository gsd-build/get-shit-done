import { describe, it, expect } from 'vitest';
import { QUERY_MUTATION_COMMAND_LIST, TRANSPORT_RAW_COMMANDS, isQueryMutationCommand } from './query-policy-capability.js';

describe('policy convergence', () => {
  it('contains expected raw transport aliases', () => {
    expect(TRANSPORT_RAW_COMMANDS).toEqual([
      'state.load',
      'commit',
      'config-set',
      'verify-summary',
      'verify.summary',
      'verify summary',
    ]);
  });

  it('contains key mutation commands and aliases', () => {
    expect(QUERY_MUTATION_COMMAND_LIST).toContain('state.update');
    expect(QUERY_MUTATION_COMMAND_LIST).toContain('phase complete');
    expect(QUERY_MUTATION_COMMAND_LIST).toContain('roadmap.update-plan-progress');
    expect(QUERY_MUTATION_COMMAND_LIST).toContain('workstream.progress');
    expect(QUERY_MUTATION_COMMAND_LIST).toContain('learnings prune');
  });

  it('classifies mutation commands via semantic helper', () => {
    expect(isQueryMutationCommand('state.update')).toBe(true);
    expect(isQueryMutationCommand('state.json')).toBe(false);
  });
});
