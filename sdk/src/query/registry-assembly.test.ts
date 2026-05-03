import { describe, it, expect } from 'vitest';
import { QueryRegistry } from './registry.js';
import {
  buildRegistry,
  createRegistry,
  decorateRegistryMutations,
  QUERY_MUTATION_COMMANDS,
} from './registry-assembly.js';
import {
  assertAliasCanonicalsHaveHandlers,
  assertMutationCommandsRegistered,
  assertNoDuplicateRegisteredCommands,
  assertRawOutputPolicyCommandsRegistered,
  collectRegistryAssemblyInvariantReport,
  type RegistryAssemblyAliasGroup,
  type RegistryAssemblyStaticGroup,
} from './registry-assembly-invariants.js';

const noop = async () => ({ data: null });

describe('registry assembly', () => {
  it('buildRegistry returns registered registry', () => {
    const registry = buildRegistry();
    expect(registry.has('state.load')).toBe(true);
    expect(registry.has('verify-summary')).toBe(true);
    expect(registry.has('verify.summary')).toBe(true);
    expect(registry.has('verify summary')).toBe(true);
  });

  it('createRegistry keeps public seam', () => {
    const registry = createRegistry();
    expect(registry).toBeInstanceOf(QueryRegistry);
    expect(registry.commands().length).toBeGreaterThan(0);
  });

  it('decorateRegistryMutations is no-op without event stream', () => {
    const registry = buildRegistry();
    expect(() => decorateRegistryMutations(registry, undefined, 's')).not.toThrow();
  });

  it('QUERY_MUTATION_COMMANDS entries are present in registry', () => {
    const registry = buildRegistry();
    for (const command of QUERY_MUTATION_COMMANDS) {
      expect(registry.has(command), `missing mutation command: ${command}`).toBe(true);
    }
  });
});

describe('registry assembly invariants', () => {
  const staticGroups: RegistryAssemblyStaticGroup[] = [
    { name: 'S1', entries: [['one', noop]] },
  ];
  const aliasGroups: RegistryAssemblyAliasGroup[] = [
    { family: 'f', aliases: [{ canonical: 'canon', aliases: ['alias'] }], handlers: { canon: noop } },
  ];

  it('fails on duplicate command keys', () => {
    expect(() => assertNoDuplicateRegisteredCommands({
      staticGroups: [
        { name: 'S1', entries: [['dup', noop]] },
        { name: 'S2', entries: [['dup', noop]] },
      ],
      aliasGroups: [],
      mutationCommands: new Set<string>(),
      rawOutputPolicyCommands: [],
    })).toThrow(/duplicate command keys/i);
  });

  it('fails on alias canonical without handler', () => {
    expect(() => assertAliasCanonicalsHaveHandlers({
      staticGroups: [],
      aliasGroups: [
        { family: 'f', aliases: [{ canonical: 'missing', aliases: [] }], handlers: {} },
      ],
      mutationCommands: new Set<string>(),
      rawOutputPolicyCommands: [],
    })).toThrow(/alias canonical missing handler/i);
  });

  it('fails when mutation command missing from registry', () => {
    const registry = new QueryRegistry();
    expect(() => assertMutationCommandsRegistered(registry, new Set(['missing.cmd']))).toThrow(/mutation command missing from registry/i);
  });

  it('fails when raw-output policy command missing from registry', () => {
    const registry = new QueryRegistry();
    expect(() => assertRawOutputPolicyCommandsRegistered(registry, ['verify-summary'])).toThrow(/raw-output policy command missing from registry/i);
  });

  it('passes happy path', () => {
    const registry = new QueryRegistry();
    registry.register('one', noop);
    registry.register('canon', noop);
    registry.register('alias', noop);
    expect(() => assertNoDuplicateRegisteredCommands({
      staticGroups,
      aliasGroups,
      mutationCommands: new Set<string>(),
      rawOutputPolicyCommands: [],
    })).not.toThrow();
    expect(() => assertAliasCanonicalsHaveHandlers({
      staticGroups,
      aliasGroups,
      mutationCommands: new Set<string>(),
      rawOutputPolicyCommands: [],
    })).not.toThrow();
    expect(() => assertMutationCommandsRegistered(registry, new Set(['one']))).not.toThrow();
    expect(() => assertRawOutputPolicyCommandsRegistered(registry, ['canon'])).not.toThrow();
  });

  it('collects invariant report for all failure classes', () => {
    const registry = new QueryRegistry();
    const report = collectRegistryAssemblyInvariantReport({
      staticGroups: [
        { name: 'S1', entries: [['dup', noop]] },
        { name: 'S2', entries: [['dup', noop]] },
      ],
      aliasGroups: [
        { family: 'f', aliases: [{ canonical: 'missing', aliases: ['dup'] }], handlers: {} },
      ],
      mutationCommands: new Set(['missing.mutation']),
      rawOutputPolicyCommands: ['missing.raw'],
    }, registry);

    expect(report).toEqual({
      duplicateCommandKeys: ['dup'],
      aliasCanonicalsMissingHandlers: ['f:missing'],
      missingMutationCommands: ['missing.mutation'],
      missingRawOutputPolicyCommands: ['missing.raw'],
    });
  });
});
