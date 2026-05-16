/**
 * Bug #3591: createGSDToolsRuntime accepts a `workstream` option, but the
 * native dispatch closure passed to QueryNativeDirectAdapter dropped it
 * before forwarding to registry.dispatch(). The omission silently routed
 * native query handlers to root `.planning` instead of
 * `.planning/workstreams/<name>` whenever a GSDTools instance was created
 * with a workstream and native dispatch was used.
 *
 * The fix passes `opts.workstream` as the 4th argument to
 * `registry.dispatch(command, args, projectDir, workstream)`. This test
 * captures the dispatch closure via a constructor-seam spy on
 * QueryNativeDirectAdapter, builds a mock registry whose dispatch records
 * its arguments, then invokes the captured closure to verify the
 * workstream is forwarded.
 */

import { describe, it, expect, vi } from 'vitest';
import { createGSDToolsRuntime } from './query-gsd-tools-runtime.js';
import * as adapterModule from './query-native-direct-adapter.js';
import * as registryModule from './query/index.js';

describe('bug #3591: createGSDToolsRuntime forwards workstream to registry.dispatch', () => {
  it('native dispatch closure passes opts.workstream as 4th arg to registry.dispatch', async () => {
    // Capture the `dispatch` option passed into QueryNativeDirectAdapter.
    let capturedDispatch:
      | ((command: string, args: string[]) => Promise<unknown>)
      | null = null;
    const adapterSpy = vi
      .spyOn(adapterModule, 'QueryNativeDirectAdapter')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((deps: any) => {
        capturedDispatch = deps.dispatch;
        // Return a minimal stub satisfying the runtime constructor.
        return {
          dispatchResult: vi.fn(),
          dispatchJson: vi.fn(),
          dispatchRaw: vi.fn(),
        } as unknown as adapterModule.QueryNativeDirectAdapter;
      });

    const registry = registryModule.createRegistry();
    const dispatchSpy = vi.spyOn(registry, 'dispatch');
    const createRegistrySpy = vi
      .spyOn(registryModule, 'createRegistry')
      .mockReturnValue(registry);

    try {
      createGSDToolsRuntime({
        projectDir: '/tmp/3591-proj',
        gsdToolsPath: '/tmp/gsd-tools.cjs',
        timeoutMs: 1_000,
        workstream: 'frontend-ws',
        shouldUseNativeQuery: () => true,
        execJsonFallback: vi.fn(async () => ({})),
        execRawFallback: vi.fn(async () => ''),
      });

      expect(adapterSpy).toHaveBeenCalled();
      expect(capturedDispatch).not.toBeNull();
      await capturedDispatch!('__bug-3591-unknown-cmd__', ['x']);
    } catch (err) {
      // unknown command is expected from the real registry
      void err;
    } finally {
      createRegistrySpy.mockRestore();
      adapterSpy.mockRestore();
    }

    expect(dispatchSpy).toHaveBeenCalledWith(
      '__bug-3591-unknown-cmd__',
      ['x'],
      '/tmp/3591-proj',
      'frontend-ws',
    );
  });

  it('forwards undefined workstream when the option is omitted (back-compat)', async () => {
    // Same shape as above but no workstream. The closure must still pass
    // projectDir; passing `undefined` for the 4th slot is the documented
    // signature of registry.dispatch.
    let capturedDispatch:
      | ((command: string, args: string[]) => Promise<unknown>)
      | null = null;
    const registry = registryModule.createRegistry();
    const dispatchSpy = vi.spyOn(registry, 'dispatch');
    const adapterSpy = vi
      .spyOn(adapterModule, 'QueryNativeDirectAdapter')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((deps: any) => {
        capturedDispatch = deps.dispatch;
        return {
          dispatchResult: vi.fn(),
          dispatchJson: vi.fn(),
          dispatchRaw: vi.fn(),
        } as unknown as adapterModule.QueryNativeDirectAdapter;
      });

    const createRegistrySpy = vi
      .spyOn(registryModule, 'createRegistry')
      .mockReturnValue(registry);

    try {
      createGSDToolsRuntime({
        projectDir: '/tmp/3591-proj',
        gsdToolsPath: '/tmp/gsd-tools.cjs',
        timeoutMs: 1_000,
        // workstream intentionally omitted
        shouldUseNativeQuery: () => true,
        execJsonFallback: vi.fn(async () => ({})),
        execRawFallback: vi.fn(async () => ''),
      });

      expect(capturedDispatch).not.toBeNull();
      await capturedDispatch!('__bug-3591-unknown-cmd-2__', []);
    } catch (err) {
      // unknown command is expected from the real registry
      void err;
    } finally {
      createRegistrySpy.mockRestore();
      adapterSpy.mockRestore();
    }

    expect(dispatchSpy).toHaveBeenCalledWith(
      '__bug-3591-unknown-cmd-2__',
      [],
      '/tmp/3591-proj',
      undefined,
    );
  });
});

describe('bug #3591: end-to-end — workstream-aware probe handler receives the workstream', () => {
  it('a registered probe handler receives opts.workstream as its 3rd arg', async () => {
    // End-to-end path: register a probe handler on a real registry (via
    // module-level export), build the runtime with a workstream, and
    // assert the handler observed the workstream when invoked through the
    // native dispatch closure.
    const registryModule = await import('./query/index.js');
    const probeRegistry = registryModule.createRegistry();
    const seen: Array<{ args: string[]; projectDir: string; workstream?: string }> = [];
    probeRegistry.register('__bug-3591-probe__', async (args, projectDir, workstream) => {
      seen.push({ args, projectDir, workstream });
      return { data: { ok: true } };
    });

    // The runtime builds its OWN registry internally; we can't substitute
    // ours unless we mock createRegistry. Hoist a module mock for that.
    const createRegistrySpy = vi
      .spyOn(registryModule, 'createRegistry')
      .mockReturnValue(probeRegistry);

    try {
      const runtime = createGSDToolsRuntime({
        projectDir: '/tmp/3591-proj',
        gsdToolsPath: '/tmp/gsd-tools.cjs',
        timeoutMs: 1_000,
        workstream: 'frontend-ws',
        shouldUseNativeQuery: () => true,
        execJsonFallback: vi.fn(async () => ({})),
        execRawFallback: vi.fn(async () => ''),
      });

      await runtime.bridge.dispatchHotpath(
        '__bug-3591-probe-legacy__',
        [],
        '__bug-3591-probe__',
        ['payload'],
        'json',
      );
    } finally {
      createRegistrySpy.mockRestore();
    }

    expect(seen).toHaveLength(1);
    expect(seen[0]?.args).toEqual(['payload']);
    expect(seen[0]?.projectDir).toBe('/tmp/3591-proj');
    expect(seen[0]?.workstream).toBe('frontend-ws');
  });
});
