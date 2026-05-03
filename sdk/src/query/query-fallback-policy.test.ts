import { describe, it, expect } from 'vitest';
import { canUseCjsFallback, describeFallbackDisabledPolicy } from './query-fallback-policy.js';

describe('query-fallback-policy', () => {
  it('describes disabled fallback policy', () => {
    expect(describeFallbackDisabledPolicy()).toContain('GSD_QUERY_FALLBACK=registered');
  });

  it('reports fallback capability', () => {
    expect(canUseCjsFallback({ cjsFallbackEnabled: true })).toBe(true);
    expect(canUseCjsFallback({ cjsFallbackEnabled: false })).toBe(false);
  });
});
