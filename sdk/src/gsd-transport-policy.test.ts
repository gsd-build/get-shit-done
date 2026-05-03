import { describe, it, expect, afterEach } from 'vitest';
import { resolveTransportPolicy, setTransportPolicy, clearTransportPolicy } from './gsd-transport-policy.js';

describe('gsd-transport-policy', () => {
  afterEach(() => {
    clearTransportPolicy();
  });

  it('uses legacy-safe defaults for unknown command', () => {
    const policy = resolveTransportPolicy('unknown-cmd');
    expect(policy.preferNative).toBe(true);
    expect(policy.allowFallbackToSubprocess).toBe(true);
    expect(policy.outputMode).toBe('json');
  });

  it('applies built-in raw output override', () => {
    const policy = resolveTransportPolicy('config-set');
    expect(policy.outputMode).toBe('raw');
    expect(policy.allowFallbackToSubprocess).toBe(true);
  });

  it('applies verify-summary alias raw overrides', () => {
    expect(resolveTransportPolicy('verify-summary').outputMode).toBe('raw');
    expect(resolveTransportPolicy('verify.summary').outputMode).toBe('raw');
    expect(resolveTransportPolicy('verify summary').outputMode).toBe('raw');
  });

  it('supports per-command override updates', () => {
    setTransportPolicy('state', { allowFallbackToSubprocess: false, outputMode: 'raw' });
    const policy = resolveTransportPolicy('state');
    expect(policy.allowFallbackToSubprocess).toBe(false);
    expect(policy.outputMode).toBe('raw');
  });
});
