import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { planQueryDispatch } from './query-fallback-orchestration.js';

describe('planQueryDispatch', () => {
  it('returns native plan when command matches registry', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['state', 'json'], registry, { cjsFallbackEnabled: true });
    expect(plan.mode).toBe('native');
    expect(plan.reason).toBe('native-match');
    expect(plan.matched?.cmd).toBe('state.json');
  });

  it('returns cjs plan when unknown and fallback enabled', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd', 'x'], registry, { cjsFallbackEnabled: true });
    expect(plan.mode).toBe('cjs');
    expect(plan.reason).toBe('fallback-to-cjs');
    expect(plan.normalized.tokens).toEqual(['unknown-cmd', 'x']);
  });

  it('returns error plan when unknown and fallback disabled', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd', 'x'], registry, { cjsFallbackEnabled: false });
    expect(plan.mode).toBe('error');
    expect(plan.reason).toBe('fallback-disabled');
  });

  it('returns missing-command error plan for empty argv', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch([], registry, { cjsFallbackEnabled: true });
    expect(plan.mode).toBe('error');
    expect(plan.reason).toBe('missing-command');
  });
});
