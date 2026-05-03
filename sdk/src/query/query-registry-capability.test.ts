import { describe, it, expect } from 'vitest';
import { supportsMutationCommand, supportsRawOutputCommand } from './query-registry-capability.js';

describe('query-registry-capability', () => {
  it('reports mutation command capability', () => {
    expect(supportsMutationCommand('state.update')).toBe(true);
    expect(supportsMutationCommand('state.json')).toBe(false);
  });

  it('reports raw output capability', () => {
    expect(supportsRawOutputCommand('state.load')).toBe(true);
    expect(supportsRawOutputCommand('state.json')).toBe(false);
  });
});
