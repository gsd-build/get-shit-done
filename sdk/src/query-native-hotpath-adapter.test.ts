import { describe, it, expect, vi } from 'vitest';
import { QueryNativeHotpathAdapter } from './query-native-hotpath-adapter.js';

describe('QueryNativeHotpathAdapter', () => {
  it('uses native Adapter when native query enabled', async () => {
    const native = {
      dispatchJson: vi.fn().mockResolvedValue({ ok: true }),
      dispatchRaw: vi.fn().mockResolvedValue('ok'),
    } as never;

    const adapter = new QueryNativeHotpathAdapter(
      () => true,
      native,
      vi.fn(),
      vi.fn(),
    );

    await expect(adapter.dispatch('state', ['load'], 'state.load', [], 'json')).resolves.toEqual({ ok: true });
    await expect(adapter.dispatch('commit', ['m'], 'commit', ['m'], 'raw')).resolves.toEqual('ok');
    expect((native as { dispatchJson: ReturnType<typeof vi.fn> }).dispatchJson).toHaveBeenCalledTimes(1);
    expect((native as { dispatchRaw: ReturnType<typeof vi.fn> }).dispatchRaw).toHaveBeenCalledTimes(1);
  });

  it('uses fallback when native query disabled', async () => {
    const execJsonFallback = vi.fn().mockResolvedValue({ from: 'fallback-json' });
    const execRawFallback = vi.fn().mockResolvedValue('fallback-raw');

    const adapter = new QueryNativeHotpathAdapter(
      () => false,
      {
        dispatchJson: vi.fn(),
        dispatchRaw: vi.fn(),
      } as never,
      execJsonFallback,
      execRawFallback,
    );

    await expect(adapter.dispatch('state', ['load'], 'state.load', [], 'json')).resolves.toEqual({ from: 'fallback-json' });
    await expect(adapter.dispatch('commit', ['m'], 'commit', ['m'], 'raw')).resolves.toEqual('fallback-raw');
    expect(execJsonFallback).toHaveBeenCalledTimes(1);
    expect(execRawFallback).toHaveBeenCalledTimes(1);
  });
});
