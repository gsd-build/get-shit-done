import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { diagnoseUnknownCommand } from './query-command-diagnosis.js';

describe('query-command-diagnosis', () => {
  it('returns structured diagnosis and rendered message', () => {
    const registry = createRegistry();
    const out = diagnoseUnknownCommand('unknown-cmd', [], registry);

    expect(out.normalized).toBe('unknown-cmd');
    expect(Array.isArray(out.hints)).toBe(true);
    expect(out.hints.length).toBeGreaterThan(0);
    expect(out.message).toContain('Unknown command: "unknown-cmd"');
    expect(out.message).toContain('CJS fallback is disabled');
  });
});
