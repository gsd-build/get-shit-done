import { describe, it, expect } from 'vitest';
import {
  mapNativeDispatchError,
  mapFallbackDispatchError,
  toDispatchFailure,
} from './query-dispatch-error-mapper.js';

describe('query dispatch error mapper', () => {
  it('maps native timeout errors', () => {
    const err = mapNativeDispatchError(
      new Error('gsd-tools timed out after 30000ms: state load'),
      'state.load',
      [],
    );
    expect(err.kind).toBe('native_timeout');
    expect(err.code).toBe(1);
    expect(err.details).toMatchObject({ command: 'state.load', args: [], timeout_ms: 30000 });
  });

  it('maps native non-timeout errors', () => {
    const err = mapNativeDispatchError(new Error('boom'), 'state.json', []);
    expect(err.kind).toBe('native_failure');
    expect(err.code).toBe(1);
    expect(err.details).toMatchObject({ command: 'state.json', args: [] });
  });

  it('maps fallback errors', () => {
    const err = mapFallbackDispatchError(new Error('spawn ENOENT'), 'state', ['load']);
    expect(err.kind).toBe('fallback_failure');
    expect(err.code).toBe(1);
    expect(err.details).toMatchObject({ command: 'state', args: ['load'], backend: 'cjs' });
  });

  it('builds failure result union', () => {
    const out = toDispatchFailure({ kind: 'internal_error', code: 1, message: 'Error: x' }, ['warn']);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.exit_code).toBe(1);
    expect(out.stderr).toEqual(['warn']);
    expect(out.error.kind).toBe('internal_error');
  });
});
