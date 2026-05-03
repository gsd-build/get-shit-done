import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import {
  normalizeQueryCommand,
  resolveQueryCommand,
  explainQueryCommandNoMatch,
} from './query-command-resolution-strategy.js';

describe('query-command-resolution-strategy', () => {
  it('normalizes family subcommands', () => {
    expect(normalizeQueryCommand('state', ['json'])).toEqual(['state.json', []]);
  });

  it('resolves registered command', () => {
    const registry = createRegistry();
    const out = resolveQueryCommand('state', ['json'], registry);
    expect(out?.cmd).toBe('state.json');
  });

  it('resolves expanded-token mapping', () => {
    const registry = createRegistry();
    registry.register('custom op', async () => ({ data: { ok: true } }));
    const out = resolveQueryCommand('custom.op', [], registry);
    expect(out?.source).toBe('expanded');
    expect(out?.expanded).toBe(true);
  });

  it('provides attempted variants via no-match explainer', () => {
    const registry = createRegistry();
    const noMatch = explainQueryCommandNoMatch('state', ['made-up-op', 'x'], registry);
    expect(noMatch.attempted.dotted.length).toBeGreaterThan(0);
    expect(noMatch.normalized.command).toBe('state');
  });
});
