/**
 * executeForCjs — synchronous SDK runtime bridge primitive.
 *
 * Provides a synchronous `executeForCjs()` function that CJS callers can use
 * to invoke any registered SDK command without dealing with async/await or
 * top-level-await restrictions that prevent CJS from using the async bridge.
 *
 * ## Mechanism
 *
 * Uses `synckit` (Atomics.wait + SharedArrayBuffer + worker_threads) to run
 * the async `QueryRuntimeBridge.execute()` in a worker thread and block the
 * calling thread until the result is available. The worker is spawned lazily
 * on first call and reused for all subsequent calls.
 *
 * ## Worker overhead
 *
 * - First call (worker startup + native bridge construction): ~80 ms.
 * - Subsequent calls (steady state): ~0.1 ms per call (excluding handler work).
 *
 * ## CRITICAL: Do NOT call from an async context
 *
 * `executeForCjs` uses `Atomics.wait` under the hood, which **blocks the
 * calling thread**. Calling it from inside an async function that is itself
 * running on the Node.js main thread event loop will **deadlock** because
 * the event loop cannot process the worker's response message while blocked.
 *
 * Safe callers:
 * - CJS modules evaluated at require-time (synchronous module initialisation).
 * - Worker threads that are not using the event loop.
 *
 * Unsafe callers:
 * - Any `async function` on the main thread.
 * - Anything inside a `Promise` callback on the main thread.
 *
 * ## CJS consumption
 *
 * ```js
 * const { executeForCjs } = require('@gsd-build/sdk/dist/runtime-bridge-sync/index.js');
 * const result = executeForCjs({ registryCommand: 'generate-slug', registryArgs: ['My Phase'], ... });
 * if (result.ok) console.log(result.data); // { slug: 'my-phase' }
 * ```
 *
 * @module runtime-bridge-sync
 */

import { createSyncFn } from 'synckit';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { RuntimeBridgeExecuteInput } from '../query-runtime-bridge.js';

// Re-export the input type so callers can import it alongside executeForCjs
export type { RuntimeBridgeExecuteInput };

// Convenience alias for callers who prefer a shorter name
export type ExecuteForCjsInput = RuntimeBridgeExecuteInput;

// ─── Result type ─────────────────────────────────────────────────────────────

/**
 * The 6 canonical error kinds from ADR-0001 Dispatch Policy Module.
 */
export type SyncErrorKind =
  | 'unknown_command'
  | 'native_failure'
  | 'native_timeout'
  | 'fallback_failure'
  | 'validation_error'
  | 'internal_error';

/**
 * Discriminated union returned by `executeForCjs`.
 *
 * - `ok: true` — command executed successfully. `data` is the handler's return value.
 * - `ok: false` — command failed. `errorKind` identifies the failure category.
 */
export type RuntimeBridgeSyncResult =
  | { ok: true; data: unknown; exitCode: 0 }
  | {
      ok: false;
      exitCode: number;
      errorKind: SyncErrorKind;
      errorDetails?: unknown;
      stderrLines: string[];
    };

// ─── Lazy sync-fn factory ──────────────────────────────────────────────────

// Resolve worker path to the compiled dist artifact.
//
// The worker MUST be the compiled JS file (dist/runtime-bridge-sync/worker.js),
// NOT the TypeScript source. This is because:
// 1. synckit spawns the worker via Node.js directly (no tsx transform).
// 2. When vitest runs tests from the TS source tree, import.meta.url points to
//    src/, not dist/. We must redirect to dist/ in all cases.
//
// Strategy: navigate from the current file's directory to the package root,
// then resolve to dist/runtime-bridge-sync/worker.js.
// The current file lives either in:
//   src/runtime-bridge-sync/ (vitest TS source context)
//   dist/runtime-bridge-sync/ (compiled CJS/ESM consumer context)
// In both cases, two levels up is the package root (sdk/).
const _moduleUrl = import.meta.url;

function resolveWorkerPath(): string {
  const currentDir = dirname(fileURLToPath(_moduleUrl));
  // currentDir is either src/runtime-bridge-sync or dist/runtime-bridge-sync.
  // Two levels up is the sdk/ package root.
  const pkgRoot = join(currentDir, '..', '..');
  return join(pkgRoot, 'dist', 'runtime-bridge-sync', 'worker.js');
}

let _syncFn: ((input: RuntimeBridgeExecuteInput) => RuntimeBridgeSyncResult) | null = null;

function getSyncFn(): (input: RuntimeBridgeExecuteInput) => RuntimeBridgeSyncResult {
  if (_syncFn) return _syncFn;
  const workerPath = resolveWorkerPath();
  _syncFn = createSyncFn<(input: RuntimeBridgeExecuteInput) => Promise<RuntimeBridgeSyncResult>>(
    workerPath,
    { timeout: 60_000 },
  );
  return _syncFn;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a registered SDK command synchronously.
 *
 * This function blocks the calling thread until the command completes.
 * It must NOT be called from an async context on the main event-loop thread
 * (see module-level JSDoc for details).
 *
 * @param input - The command input, matching RuntimeBridgeExecuteInput.
 * @returns A RuntimeBridgeSyncResult — either ok:true with data, or ok:false with errorKind.
 *
 * @example
 * ```js
 * const { executeForCjs } = require('@gsd-build/sdk/dist/runtime-bridge-sync/index.js');
 * const result = executeForCjs({
 *   registryCommand: 'generate-slug',
 *   registryArgs: ['My Phase'],
 *   legacyCommand: 'generate-slug',
 *   legacyArgs: ['My Phase'],
 *   mode: 'json',
 *   projectDir: '/path/to/project',
 * });
 * if (result.ok) {
 *   console.log(result.data.slug); // 'my-phase'
 * }
 * ```
 */
export function executeForCjs(input: RuntimeBridgeExecuteInput): RuntimeBridgeSyncResult {
  return getSyncFn()(input);
}
