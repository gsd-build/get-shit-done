import { describe, it, expect } from 'vitest';
import { COMMAND_DEFINITIONS, COMMAND_DEFINITIONS_BY_FAMILY, FAMILY_MUTATION_COMMANDS } from './command-definition.js';
import { COMMAND_MANIFEST } from './command-manifest.js';

describe('command-definition module', () => {
  it('exposes canonical metadata with handler_key normalization contract', () => {
    expect(COMMAND_DEFINITIONS).toHaveLength(COMMAND_MANIFEST.length);
    for (const [index, manifestEntry] of COMMAND_MANIFEST.entries()) {
      const definition = COMMAND_DEFINITIONS[index];
      expect(definition.handler_key).toBe(manifestEntry.handlerKey ?? manifestEntry.canonical);
      expect(definition.canonical).toBe(manifestEntry.canonical);
      expect(definition.aliases).toEqual(manifestEntry.aliases);
      expect(definition.canonical).toContain('.');
      expect(Array.isArray(definition.aliases)).toBe(true);
    }
  });

  it('keeps family index canonicals in sync with flat list', () => {
    const indexed = Object.values(COMMAND_DEFINITIONS_BY_FAMILY).flat();
    expect(indexed).toHaveLength(COMMAND_DEFINITIONS.length);
    expect(indexed.map((entry) => entry.canonical).sort()).toEqual(
      [...COMMAND_DEFINITIONS.map((entry) => entry.canonical)].sort(),
    );
  });

  it('derives family mutation command aliases from one source', () => {
    expect(FAMILY_MUTATION_COMMANDS).toContain('state.update');
    expect(FAMILY_MUTATION_COMMANDS).toContain('phase complete');
    expect(FAMILY_MUTATION_COMMANDS).toContain('roadmap.update-plan-progress');
  });
});
