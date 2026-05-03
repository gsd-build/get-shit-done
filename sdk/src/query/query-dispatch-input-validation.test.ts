import { describe, it, expect } from 'vitest';
import { validateQueryDispatchInput } from './query-dispatch-input-validation.js';

describe('query-dispatch-input-validation', () => {
  it('fails when --pick value missing', () => {
    const out = validateQueryDispatchInput(['state', 'json', '--pick']);
    expect(out.error?.ok).toBe(false);
  });

  it('extracts pick field and query args', () => {
    const out = validateQueryDispatchInput(['state', 'json', '--pick', 'x.y']);
    expect(out.error).toBeUndefined();
    expect(out.queryArgs).toEqual(['state', 'json']);
    expect(out.pickField).toBe('x.y');
  });

  it('fails when --pick is the only command token', () => {
    const out = validateQueryDispatchInput(['--pick', 'x.y']);
    expect(out.error?.ok).toBe(false);
    if (out.error?.ok) throw new Error('expected failure');
    expect(out.error?.error.kind).toBe('validation_error');
  });
});
