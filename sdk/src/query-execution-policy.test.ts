import { describe, it, expect, vi } from 'vitest';
import { QueryExecutionPolicy } from './query-execution-policy.js';
import { setTransportPolicy, clearTransportPolicy } from './gsd-transport-policy.js';

describe('QueryExecutionPolicy', () => {
  it('applies transport policy to transport.run', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true });
    const policy = new QueryExecutionPolicy({ run } as never);

    setTransportPolicy('verify.path-exists', { preferNative: true, allowFallbackToSubprocess: false });

    await policy.execute({
      legacyCommand: 'verify.path-exists',
      legacyArgs: [],
      registryCommand: 'verify.path-exists',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp/project',
      preferNativeQuery: true,
    });

    expect(run).toHaveBeenCalledTimes(1);
    const [, policyArg] = run.mock.calls[0];
    expect(policyArg).toEqual({ preferNative: true, allowFallbackToSubprocess: false });

    clearTransportPolicy();
  });
});
