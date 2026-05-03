import { describe, it, expect, vi } from 'vitest';
import { QueryRegistry } from './query/registry.js';
import { GSDTransport } from './gsd-transport.js';

describe('GSDTransport', () => {
  it('uses native adapter when command registered and policy prefers native', async () => {
    const registry = new QueryRegistry();
    registry.register('state.load', async () => ({ data: { ok: true } }));

    const adapters = {
      dispatchNative: vi.fn(async () => ({ data: { ok: true } })),
      execSubprocessJson: vi.fn(async () => ({ ok: false })),
      execSubprocessRaw: vi.fn(async () => 'subprocess'),
    };

    const transport = new GSDTransport(registry, adapters);
    const result = await transport.run({
      legacyCommand: 'state',
      legacyArgs: ['load'],
      registryCommand: 'state.load',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: true,
    });

    expect(result).toEqual({ ok: true });
    expect(adapters.dispatchNative).toHaveBeenCalledOnce();
    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });

  it('falls back to subprocess when native throws and policy allows fallback', async () => {
    const registry = new QueryRegistry();
    registry.register('state.load', async () => ({ data: { ok: true } }));

    const adapters = {
      dispatchNative: vi.fn(async () => {
        throw new Error('native failed');
      }),
      execSubprocessJson: vi.fn(async () => ({ ok: 'fallback' })),
      execSubprocessRaw: vi.fn(async () => 'fallback-raw'),
    };

    const transport = new GSDTransport(registry, adapters);
    const result = await transport.run({
      legacyCommand: 'state',
      legacyArgs: ['load'],
      registryCommand: 'state.load',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: true,
    });

    expect(result).toEqual({ ok: 'fallback' });
    expect(adapters.dispatchNative).toHaveBeenCalledOnce();
    expect(adapters.execSubprocessJson).toHaveBeenCalledOnce();
  });

  it('hard-fails when native throws and fallback disabled', async () => {
    const registry = new QueryRegistry();
    registry.register('state.load', async () => ({ data: { ok: true } }));

    const adapters = {
      dispatchNative: vi.fn(async () => {
        throw new Error('native failed');
      }),
      execSubprocessJson: vi.fn(async () => ({ ok: 'fallback' })),
      execSubprocessRaw: vi.fn(async () => 'fallback-raw'),
    };

    const transport = new GSDTransport(registry, adapters);

    await expect(transport.run({
      legacyCommand: 'state',
      legacyArgs: ['load'],
      registryCommand: 'state.load',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: false,
    })).rejects.toThrow('native failed');

    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });

  it('forces subprocess when workstream present', async () => {
    const registry = new QueryRegistry();
    registry.register('state.load', async () => ({ data: { ok: true } }));

    const adapters = {
      dispatchNative: vi.fn(async () => ({ data: { ok: true } })),
      execSubprocessJson: vi.fn(async () => ({ ok: 'ws-subprocess' })),
      execSubprocessRaw: vi.fn(async () => 'ws-subprocess-raw'),
    };

    const transport = new GSDTransport(registry, adapters);
    const result = await transport.run({
      legacyCommand: 'state',
      legacyArgs: ['load'],
      registryCommand: 'state.load',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp',
      workstream: 'ws-1',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: true,
    });

    expect(result).toEqual({ ok: 'ws-subprocess' });
    expect(adapters.dispatchNative).not.toHaveBeenCalled();
    expect(adapters.execSubprocessJson).toHaveBeenCalledOnce();
  });
});
