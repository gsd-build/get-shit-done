import { describe, it, expect, vi } from 'vitest';
import { GSDToolsError } from './gsd-tools-error.js';
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

  it('does not fallback after timeout-like native error', async () => {
    const registry = new QueryRegistry();
    registry.register('state.load', async () => ({ data: { ok: true } }));

    const adapters = {
      dispatchNative: vi.fn(async () => {
        throw new Error('gsd-tools timed out after 500ms: state load');
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
      allowFallbackToSubprocess: true,
    })).rejects.toThrow('timed out after');

    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });

  it('does not fallback after typed timeout native error', async () => {
    const registry = new QueryRegistry();
    registry.register('state.load', async () => ({ data: { ok: true } }));

    const timeoutError = GSDToolsError.timeout('native timed out', 'state', ['load'], '', 500);
    const adapters = {
      dispatchNative: vi.fn(async () => {
        throw timeoutError;
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
      allowFallbackToSubprocess: true,
    })).rejects.toBe(timeoutError);

    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });

  it('formats native raw output via formatNativeRaw when provided', async () => {
    const registry = new QueryRegistry();
    registry.register('commit', async () => ({ data: { hash: 'abc123' } }));

    const adapters = {
      dispatchNative: vi.fn(async () => ({ data: { hash: 'abc123' } })),
      execSubprocessJson: vi.fn(async () => ({ ok: false })),
      execSubprocessRaw: vi.fn(async () => 'subprocess-raw'),
      formatNativeRaw: vi.fn(() => 'raw-native-output'),
    };

    const transport = new GSDTransport(registry, adapters);
    const result = await transport.run({
      legacyCommand: 'commit',
      legacyArgs: ['msg'],
      registryCommand: 'commit',
      registryArgs: ['msg'],
      mode: 'raw',
      projectDir: '/tmp',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: true,
    });

    expect(result).toBe('raw-native-output');
    expect(adapters.formatNativeRaw).toHaveBeenCalledOnce();
    expect(adapters.execSubprocessRaw).not.toHaveBeenCalled();
  });

  it('falls back to internal raw formatter when formatNativeRaw missing', async () => {
    const registry = new QueryRegistry();
    registry.register('commit', async () => ({ data: undefined }));

    const adapters = {
      dispatchNative: vi.fn(async () => ({ data: undefined })),
      execSubprocessJson: vi.fn(async () => ({ ok: false })),
      execSubprocessRaw: vi.fn(async () => 'subprocess-raw'),
    };

    const transport = new GSDTransport(registry, adapters);
    const result = await transport.run({
      legacyCommand: 'commit',
      legacyArgs: ['msg'],
      registryCommand: 'commit',
      registryArgs: ['msg'],
      mode: 'raw',
      projectDir: '/tmp',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: true,
    });

    expect(result).toBe('');
    expect(adapters.execSubprocessRaw).not.toHaveBeenCalled();
  });
  it('routes natively when workstream present (Phase 6 fix)', async () => {
    // Phase 6 fix: GSDTransport no longer forces subprocess for workstream-scoped
    // requests. The per-request dispatchNative closure (Phase 5.1) correctly
    // threads workstream to registry.dispatch(), so native dispatch is used.
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

    // Native dispatch is used — subprocess is NOT called.
    expect(result).toEqual({ ok: true });
    expect(adapters.dispatchNative).toHaveBeenCalledOnce();
    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });

  it('fails when command is unregistered and subprocess fallback is disabled', async () => {
    const registry = new QueryRegistry();

    const adapters = {
      dispatchNative: vi.fn(async () => ({ data: { ok: true } })),
      execSubprocessJson: vi.fn(async () => ({ ok: 'fallback' })),
      execSubprocessRaw: vi.fn(async () => 'fallback-raw'),
    };

    const transport = new GSDTransport(registry, adapters);

    await expect(transport.run({
      legacyCommand: 'unknown',
      legacyArgs: [],
      registryCommand: 'unknown',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: false,
    })).rejects.toThrow("Subprocess fallback disabled");

    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });

  it('routes natively when workstream present and mode is raw (Phase 6 fix)', async () => {
    // Phase 6 fix: workstream no longer forces subprocess. Native dispatch is used
    // even in raw mode — formatNativeRaw (if set) handles the output projection.
    const registry = new QueryRegistry();
    registry.register('commit', async () => ({ data: { hash: 'abc' } }));

    const adapters = {
      dispatchNative: vi.fn(async () => ({ data: { hash: 'abc' } })),
      execSubprocessJson: vi.fn(async () => ({ ok: 'json-subprocess' })),
      execSubprocessRaw: vi.fn(async () => 'raw-subprocess'),
    };

    const transport = new GSDTransport(registry, adapters);
    const result = await transport.run({
      legacyCommand: 'commit',
      legacyArgs: ['msg'],
      registryCommand: 'commit',
      registryArgs: ['msg'],
      mode: 'raw',
      projectDir: '/tmp',
      workstream: 'ws-1',
    }, {
      preferNative: true,
      allowFallbackToSubprocess: true,
    });

    // Native dispatch is used — toRaw serializes data to JSON.
    expect(typeof result).toBe('string');
    expect(adapters.dispatchNative).toHaveBeenCalledOnce();
    expect(adapters.execSubprocessRaw).not.toHaveBeenCalled();
    expect(adapters.execSubprocessJson).not.toHaveBeenCalled();
  });
});
