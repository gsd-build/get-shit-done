import { describe, it, expect } from 'vitest';
import { COMMAND_DEFINITIONS, COMMAND_DEFINITIONS_BY_FAMILY, FAMILY_MUTATION_COMMANDS } from './command-definition.js';

describe('command-definition module', () => {
  it('exposes canonical metadata with handler_key', () => {
    expect(COMMAND_DEFINITIONS.length).toBeGreaterThan(0);
    for (const entry of COMMAND_DEFINITIONS) {
      expect(entry.handler_key).toBeTruthy();
      expect(entry.canonical).toContain('.');
      expect(Array.isArray(entry.aliases)).toBe(true);
    }
  });

  it('keeps family index in sync with flat list', () => {
    const indexed = Object.values(COMMAND_DEFINITIONS_BY_FAMILY).flat();
    expect(indexed.length).toBe(COMMAND_DEFINITIONS.length);
  });

  it('derives family mutation command aliases from one source', () => {
    expect(FAMILY_MUTATION_COMMANDS).toContain('state.update');
    expect(FAMILY_MUTATION_COMMANDS).toContain('phase complete');
    expect(FAMILY_MUTATION_COMMANDS).toContain('roadmap.update-plan-progress');
  });
});
