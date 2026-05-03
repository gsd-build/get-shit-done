import { describe, it, expect } from 'vitest';
import { UNKNOWN_COMMAND_HINTS } from './query-unknown-command-hints.js';

describe('query-unknown-command-hints', () => {
  it('exports stable hint catalog', () => {
    expect(UNKNOWN_COMMAND_HINTS.length).toBeGreaterThan(1);
    expect(UNKNOWN_COMMAND_HINTS[0]).toContain('registered `gsd-sdk query`');
  });
});
