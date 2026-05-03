import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { normalizeQueryCommand, resolveQueryCommand } from './query-command-resolution-strategy.js';

describe('query-command-resolution-strategy', () => {
  it('normalizes family subcommands', () => {
    expect(normalizeQueryCommand('state', ['json'])).toEqual(['state.json', []]);
  });

  it('resolves registered command', () => {
    const registry = createRegistry();
    const out = resolveQueryCommand('state', ['json'], registry);
    expect(out?.cmd).toBe('state.json');
  });
});
