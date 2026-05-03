import { describe, it, expect } from 'vitest';
import { createRegistry } from './index.js';
import { planQueryDispatch } from './query-dispatch-plan.js';
import { createCommandTopology } from './command-topology.js';

describe('query-dispatch-plan', () => {
  it('selects native mode for registered commands', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['state', 'json'], createCommandTopology(registry), true);
    expect(plan.mode).toBe('native');
    expect(plan.normalized.command).toBe('state.json');
  });

  it('selects cjs mode for unknown command when fallback enabled', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd'], createCommandTopology(registry), true);
    expect(plan.mode).toBe('cjs');
  });

  it('selects error mode for unknown command when fallback disabled', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd'], createCommandTopology(registry), false);
    expect(plan.mode).toBe('error');
  });
});
