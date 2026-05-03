import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { createCommandTopology } from './command-topology.js';

describe('command-topology', () => {
  it('resolves native command with adapter', () => {
    const registry = createRegistry();
    const topology = createCommandTopology(registry);

    const out = topology.resolve(['state', 'json']);
    expect(out.kind).toBe('match');
    if (out.kind !== 'match') throw new Error('expected match');
    expect(out.canonical).toBe('state.json');
    expect(out.args).toEqual([]);
    expect(typeof out.adapter).toBe('function');
  });

  it('returns no_match with diagnosis', () => {
    const registry = createRegistry();
    const topology = createCommandTopology(registry);

    const out = topology.resolve(['unknown-cmd'], true);
    expect(out.kind).toBe('no_match');
    if (out.kind !== 'no_match') throw new Error('expected no_match');
    expect(out.message).toContain('Unknown command');
    expect(out.attempted.length).toBeGreaterThanOrEqual(0);
  });
});
