import { describe, expect, it } from 'vitest';
import { GSDToolsError } from '../gsd-tools.js';
import { buildQueryCliOutputFromError } from './query-cli-output.js';

describe('query-cli-output', () => {
  it('prefers raw gsd-tools stderr when present', () => {
    const err = new GSDToolsError('failed', 'state', ['json'], 2, 'line one\nline two\n');
    const out = buildQueryCliOutputFromError(err);
    expect(out.exitCode).toBe(2);
    expect(out.stderrLines).toEqual(['line one', 'line two']);
  });

  it('falls back to Error: message when gsd-tools stderr is empty', () => {
    const err = new GSDToolsError('failed', 'state', ['json'], null, '');
    const out = buildQueryCliOutputFromError(err);
    expect(out.exitCode).toBe(1);
    expect(out.stderrLines).toEqual(['Error: failed']);
  });
});
