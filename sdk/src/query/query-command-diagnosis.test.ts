import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { diagnoseUnknownCommand } from './query-command-diagnosis.js';

describe('query-command-diagnosis', () => {
  it('returns structured diagnosis and rendered message with restricted fallback', () => {
    const registry = createRegistry();
    const out = diagnoseUnknownCommand('unknown-cmd', [], registry, true);

    expect(out.normalized).toBe('unknown-cmd');
    expect(Array.isArray(out.hints)).toBe(true);
    expect(out.hints.length).toBeGreaterThan(0);
    expect(out.message).toContain('Unknown command: "unknown-cmd"');
    expect(out.message).toContain('CJS fallback is disabled');
  });

  it('omits disabled-fallback clause when fallback is not restricted', () => {
    const registry = createRegistry();
    const out = diagnoseUnknownCommand('unknown-cmd', [], registry, false);
    expect(out.message).not.toContain('CJS fallback is disabled');
  });
});
