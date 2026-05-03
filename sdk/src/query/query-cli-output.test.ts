import { describe, expect, it } from 'vitest';
import { GSDToolsError } from '../gsd-tools.js';
import { buildQueryCliOutputFromError } from './query-cli-output.js';

describe('query-cli-output', () => {
  it('prefers raw gsd-tools stderr when present', () => {
    const err = new GSDToolsError('failed', 'list', ['json'], 2, 'line one\nline two\n');
    const out = buildQueryCliOutputFromError(err);
    expect(out.exitCode).toBe(2);
    expect(out.stderrLines).toEqual(['line one', 'line two']);
  });

  it('falls back to Error: message when gsd-tools stderr is empty', () => {
    const err = new GSDToolsError('failed', 'list', ['json'], null, '');
    const out = buildQueryCliOutputFromError(err);
    expect(out.exitCode).toBe(1);
    expect(out.stderrLines).toEqual(['Error: failed']);
  });

  it('falls back to Error: message when gsd-tools stderr is whitespace-only', () => {
    const err = new GSDToolsError('failed', 'build', ['json'], null, '   \n');
    const out = buildQueryCliOutputFromError(err);
    expect(out.exitCode).toBe(1);
    expect(out.stderrLines).toEqual(['Error: failed']);
  });

  it('uses exitCode 1 when gsd-tools exitCode is null and stderr is non-empty', () => {
    const err = new GSDToolsError('failed', 'build', ['json'], null, 'line');
    const out = buildQueryCliOutputFromError(err);
    expect(out.exitCode).toBe(1);
    expect(out.stderrLines).toEqual(['line']);
  });
});
