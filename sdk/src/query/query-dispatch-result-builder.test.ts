import { describe, it, expect } from 'vitest';
import { dispatchFailure, dispatchSuccess } from './query-dispatch-result-builder.js';

describe('query-dispatch-result-builder', () => {
  it('builds success result', () => {
    expect(dispatchSuccess('ok\n')).toEqual({ ok: true, stdout: 'ok\n', stderr: [], exit_code: 0 });
  });

  it('builds failure result from error code', () => {
    const out = dispatchFailure({ kind: 'internal_error', code: 7, message: 'Error: x' }, ['warn']);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.exit_code).toBe(7);
    expect(out.stderr).toEqual(['warn']);
  });
});
