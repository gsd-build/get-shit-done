import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { explainQueryCommandNoMatch, resolveQueryCommand, resolveQueryTokens } from './query-command-resolution-strategy.js';

describe('command resolution', () => {
  it('resolves normalized tokens with metadata', () => {
    const registry = createRegistry();
    const resolved = resolveQueryTokens(['state', 'update', 'status', 'X'], registry);
    expect(resolved).toEqual({
      cmd: 'state.update',
      args: ['status', 'X'],
      matchedBy: 'dotted',
      expanded: false,
      source: 'normalized',
    });
  });

  it('resolves dotted token directly when canonical is registered', () => {
    const registry = createRegistry();
    const resolved = resolveQueryTokens(['init.execute-phase', '1'], registry);
    expect(resolved).toEqual({
      cmd: 'init.execute-phase',
      args: ['1'],
      matchedBy: 'dotted',
      expanded: false,
      source: 'normalized',
    });
  });

  it('marks expanded source when only spaced command exists', () => {
    const registry = {
      has(command: string) {
        return command === 'init execute-phase';
      },
    };
    const resolved = resolveQueryTokens(['init.execute-phase', '1'], registry);
    expect(resolved).toEqual({
      cmd: 'init execute-phase',
      args: ['1'],
      matchedBy: 'spaced',
      expanded: true,
      source: 'expanded',
    });
  });

  it('resolves from raw command+args using normalize rules', () => {
    const registry = createRegistry();
    const resolved = resolveQueryCommand('state', ['json'], registry);
    expect(resolved?.cmd).toBe('state.json');
    expect(resolved?.args).toEqual([]);
    expect(resolved?.source).toBe('normalized');
  });

  it('returns null for unknown command', () => {
    const registry = createRegistry();
    expect(resolveQueryCommand('totally-unknown', ['x'], registry)).toBeNull();
  });

  it('returns structured no-match metadata', () => {
    const registry = createRegistry();
    const noMatch = explainQueryCommandNoMatch('state', ['made-up-op', 'x'], registry);
    expect(noMatch.normalized).toEqual({
      command: 'state',
      args: ['made-up-op', 'x'],
      tokens: ['state', 'made-up-op', 'x'],
    });
    expect(noMatch.attempted.dotted[0]).toBe('state.made-up-op.x');
    expect(noMatch.attempted.spaced[0]).toBe('state made-up-op x');
  });
});
