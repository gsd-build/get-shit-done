import { describe, it, expect } from 'vitest';
import { verifyGoldenPolicyComplete } from './golden-policy.js';

describe('golden policy', () => {
  it('every canonical registry command is integration-covered or excepted', () => {
    expect(() => verifyGoldenPolicyComplete()).not.toThrow();
  });
});
