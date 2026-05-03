/**
 * Unit tests for QueryRegistry, extractField, and createRegistry factory.
 */

import { describe, it, expect, vi } from 'vitest';
import { QueryRegistry, extractField, resolveQueryArgv } from './registry.js';
import { createRegistry, QUERY_MUTATION_COMMANDS } from './index.js';
import type { QueryResult } from './utils.js';

// ─── extractField ──────────────────────────────────────────────────────────

describe('extractField', () => {
  it('extracts nested value with dot notation', () => {
    expect(extractField({ a: { b: 1 } }, 'a.b')).toBe(1);
  });

  it('extracts top-level value', () => {
    expect(extractField({ slug: 'my-phase' }, 'slug')).toBe('my-phase');
  });

  it('extracts array element with bracket notation', () => {
    expect(extractField({ items: [10, 20, 30] }, 'items[1]')).toBe(20);
  });

  it('extracts array element with negative index', () => {
    expect(extractField({ items: [10, 20, 30] }, 'items[-1]')).toBe(30);
  });

  it('returns undefined for null input', () => {
    expect(extractField(null, 'a')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(extractField(undefined, 'a')).toBeUndefined();
  });

  it('returns undefined for missing nested path', () => {
    expect(extractField({ a: 1 }, 'b.c')).toBeUndefined();
  });

  it('returns undefined when bracket access targets non-array', () => {
    expect(extractField({ items: 'not-array' }, 'items[0]')).toBeUndefined();
  });

  it('handles deeply nested paths', () => {
    expect(extractField({ a: { b: { c: { d: 42 } } } }, 'a.b.c.d')).toBe(42);
  });

  it('handles mixed dot and bracket notation', () => {
    expect(extractField({ data: { items: [{ name: 'x' }] } }, 'data.items[0].name')).toBe('x');
  });
});

// ─── QueryRegistry ─────────────────────────────────────────────────────────

describe('QueryRegistry', () => {
  it('register makes has() return true', () => {
    const registry = new QueryRegistry();
    const handler = async () => ({ data: 'test' });
    registry.register('test-cmd', handler);

    expect(registry.has('test-cmd')).toBe(true);
  });

  it('has() returns false for unregistered command', () => {
    const registry = new QueryRegistry();

    expect(registry.has('nonexistent')).toBe(false);
  });

  it('dispatch calls registered handler', async () => {
    const registry = new QueryRegistry();
    const handler = vi.fn(async (args: string[], _projectDir: string): Promise<QueryResult> => {
      return { data: { value: args[0] } };
    });
    registry.register('test-cmd', handler);

    const result = await registry.dispatch('test-cmd', ['arg1'], '/tmp');

    expect(handler).toHaveBeenCalledWith(['arg1'], '/tmp', undefined);
    expect(result).toEqual({ data: { value: 'arg1' } });
  });

  it('dispatch throws GSDError for unregistered command', async () => {
    const registry = new QueryRegistry();
    // Bridge removed in v3.0 — unknown commands throw, not fallback
    await expect(registry.dispatch('unknown-cmd', ['arg1'], '/tmp/project'))
      .rejects.toThrow('Unknown command: "unknown-cmd"');
  });

  it('commands() returns all registered command names', () => {
    const registry = new QueryRegistry();
    registry.register('alpha', async () => ({ data: 1 }));
    registry.register('beta', async () => ({ data: 2 }));
    expect(registry.commands().sort()).toEqual(['alpha', 'beta']);
  });
});

// ─── QUERY_MUTATION_COMMANDS vs registry ───────────────────────────────────

describe('QUERY_MUTATION_COMMANDS', () => {
  it('has a registered handler for every mutation command name', () => {
    const registry = createRegistry();
    const missing: string[] = [];
    for (const cmd of QUERY_MUTATION_COMMANDS) {
      if (!registry.has(cmd)) missing.push(cmd);
    }
    expect(missing).toEqual([]);
  });
});

// ─── createRegistry ────────────────────────────────────────────────────────

describe('createRegistry', () => {
  it('returns a QueryRegistry instance', () => {
    const registry = createRegistry();

    expect(registry).toBeInstanceOf(QueryRegistry);
  });

  it('has generate-slug registered', () => {
    const registry = createRegistry();

    expect(registry.has('generate-slug')).toBe(true);
  });

  it('has current-timestamp registered', () => {
    const registry = createRegistry();

    expect(registry.has('current-timestamp')).toBe(true);
  });

  it('has summary-extract dash alias (PR #2179 / workflows)', () => {
    const registry = createRegistry();
    expect(registry.has('summary-extract')).toBe(true);
  });

  it('can dispatch generate-slug', async () => {
    const registry = createRegistry();
    const result = await registry.dispatch('generate-slug', ['My Phase'], '/tmp');

    expect(result).toEqual({ data: { slug: 'my-phase' } });
  });
});

// ─── resolveQueryArgv ───────────────────────────────────────────────────────

describe('resolveQueryArgv', () => {
  it('matches longest dotted prefix (state.update + args)', () => {
    const registry = createRegistry();
    const m = resolveQueryArgv(['state', 'update', 'status', 'X'], registry);
    expect(m).toEqual({ cmd: 'state.update', args: ['status', 'X'] });
  });

  it('matches longest prefix (phase.add wins over phase when both registered)', () => {
    const registry = createRegistry();
    const m = resolveQueryArgv(['phase', 'add', 'desc'], registry);
    expect(m).toEqual({ cmd: 'phase.add', args: ['desc'] });
  });

  it('prefers longer match over shorter', () => {
    const registry = createRegistry();
    const m = resolveQueryArgv(['state', 'load'], registry);
    expect(m?.cmd).toBe('state.load');
    expect(m?.args).toEqual([]);
  });

  it('returns null when no prefix matches', () => {
    const registry = createRegistry();
    const m = resolveQueryArgv(['totally-unknown', 'x'], registry);
    expect(m).toBeNull();
  });

  it('matches a single dotted command token', () => {
    const registry = createRegistry();
    expect(resolveQueryArgv(['init.new-project'], registry)).toEqual({
      cmd: 'init.new-project',
      args: [],
    });
  });

  // Regression: #2597 — dotted command token followed by positional args.
  // Before the fix, argv like ['init.execute-phase', '1'] returned null because
  // expansion only ran for single-token input.
  it('matches a dotted command token when positional args follow (#2597)', () => {
    const registry = createRegistry();
    expect(resolveQueryArgv(['init.execute-phase', '1'], registry)).toEqual({
      cmd: 'init.execute-phase',
      args: ['1'],
    });
  });

  it('matches dotted state.update with trailing args (#2597)', () => {
    const registry = createRegistry();
    expect(resolveQueryArgv(['state.update', 'status', 'X'], registry)).toEqual({
      cmd: 'state.update',
      args: ['status', 'X'],
    });
  });

  it('matches dotted phase.add with trailing args (#2597)', () => {
    const registry = createRegistry();
    expect(resolveQueryArgv(['phase.add', 'desc'], registry)).toEqual({
      cmd: 'phase.add',
      args: ['desc'],
    });
  });
});
