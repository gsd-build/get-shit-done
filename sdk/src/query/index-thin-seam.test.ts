import { describe, it, expect } from 'vitest';
import * as query from './index.js';

describe('query index thin seam', () => {
  it('re-exports registry assembly seam', () => {
    expect(typeof query.createRegistry).toBe('function');
    expect(typeof query.buildRegistry).toBe('function');
    expect(typeof query.decorateRegistryMutations).toBe('function');
    expect(query.QUERY_MUTATION_COMMANDS).toBeInstanceOf(Set);
  });

  it('re-exports shared query helpers', () => {
    expect(typeof query.extractField).toBe('function');
    expect(typeof query.normalizeQueryCommand).toBe('function');
  });
});
