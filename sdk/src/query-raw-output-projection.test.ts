import { describe, it, expect } from 'vitest';
import { formatQueryRawOutput } from './query-raw-output-projection.js';

describe('formatQueryRawOutput', () => {
  it('formats commit hash', () => {
    expect(formatQueryRawOutput('commit', { committed: true, hash: 'abc123' })).toBe('abc123');
  });

  it('formats config-set key=value', () => {
    expect(formatQueryRawOutput('config-set', { updated: true, key: 'mode', value: 'yolo' })).toBe('mode=yolo');
  });

  it('formats state.begin-phase boolean result', () => {
    expect(formatQueryRawOutput('state.begin-phase', { updated: ['x'] })).toBe('true');
    expect(formatQueryRawOutput('state.begin-phase', { updated: [] })).toBe('false');
  });
});
