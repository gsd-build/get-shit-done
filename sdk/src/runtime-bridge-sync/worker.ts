/**
 * Synckit worker for executeForCjs.
 *
 * Loaded by synckit's worker pool. Constructs a native-only QueryRuntimeBridge
 * lazily (once per worker lifetime) and handles async execution, projecting
 * results into the RuntimeBridgeSyncResult discriminated union.
 *
 * The bridge is configured with:
 * - allowFallbackToSubprocess: false — keeps the worker self-contained with no
 *   child-process spawning. Unknown commands surface as 'unknown_command' errors.
 * - strictSdk: false — lets the transport surface 'unknown_command' rather than
 *   throwing before dispatch.
 */
import { runAsWorker } from 'synckit';
import { createRegistry } from '../query/index.js';
import { GSDTransport } from '../gsd-transport.js';
import { QueryExecutionPolicy } from '../query-execution-policy.js';
import { QueryNativeDirectAdapter } from '../query-native-direct-adapter.js';
import { QueryNativeHotpathAdapter } from '../query-native-hotpath-adapter.js';
import { QueryRuntimeBridge } from '../query-runtime-bridge.js';
import { GSDToolsError } from '../gsd-tools-error.js';
import { GSDError, ErrorClassification } from '../errors.js';
import { createQueryNativeErrorFactory } from '../query-tools-error-factory.js';
import { formatQueryRawOutput } from '../query-raw-output-projection.js';
import type { RuntimeBridgeExecuteInput } from '../query-runtime-bridge.js';
import type { RuntimeBridgeSyncResult, SyncErrorKind } from './index.js';

// ─── Lazy bridge singleton ──────────────────────────────────────────────────

let bridgeInstance: QueryRuntimeBridge | null = null;

function getBridge(): QueryRuntimeBridge {
  if (bridgeInstance) return bridgeInstance;

  const registry = createRegistry();

  const NATIVE_TIMEOUT_MS = 30_000; // 30 s ceiling for any single handler
  const nativeErrorFactory = createQueryNativeErrorFactory(NATIVE_TIMEOUT_MS);

  // Build a per-request adapter inside dispatchNative so that projectDir and
  // workstream from the request close over the correct values. The Phase 5.0
  // bug was a module-scoped adapter that hardcoded projectDir = '' — any
  // handler reading .planning/ (e.g. state.*) received an empty path and
  // silently failed or read from the process CWD. Constructing per-request
  // adds microseconds; correctness wins. (fix for latent bug, Phase 5.1)
  const transport = new GSDTransport(registry, {
    dispatchNative: (request) => {
      const adapter = new QueryNativeDirectAdapter({
        timeoutMs: NATIVE_TIMEOUT_MS,
        dispatch: (registryCommand, registryArgs) =>
          registry.dispatch(registryCommand, registryArgs, request.projectDir, request.workstream),
        ...nativeErrorFactory,
      });
      return adapter.dispatchResult(
        request.legacyCommand,
        request.legacyArgs,
        request.registryCommand,
        request.registryArgs,
      );
    },
    // #3631: forward raw-mode projection so mode:'raw' returns the per-command
    // scalar string (next-decimal token, get-phase section, etc.) instead of
    // falling back to generic JSON-stringify. Without this, family-router
    // sdkHandlers requesting mode:'raw' under --raw receive a stringified
    // JSON IR — the regression #3577 introduced for every family router.
    formatNativeRaw: (registryCommand, data) => formatQueryRawOutput(registryCommand, data),
    // Subprocess fallback stubs — never called because allowFallbackToSubprocess=false
    execSubprocessJson: () =>
      Promise.reject(new Error('Subprocess fallback disabled in sync bridge worker')),
    execSubprocessRaw: () =>
      Promise.reject(new Error('Subprocess fallback disabled in sync bridge worker')),
  });

  const executionPolicy = new QueryExecutionPolicy(transport);

  // Hotpath adapter: construct a stub that satisfies the QueryRuntimeBridge
  // constructor. executeForCjs does not invoke dispatchHotpath so this
  // adapter is never actually called. We still need a valid instance because
  // QueryRuntimeBridge requires one at construction time.
  const stubDirectAdapter = new QueryNativeDirectAdapter({
    timeoutMs: NATIVE_TIMEOUT_MS,
    dispatch: () => Promise.reject(new Error('stub: hotpath direct adapter not used')),
    ...nativeErrorFactory,
  });
  const hotpathAdapter = new QueryNativeHotpathAdapter(
    () => true,
    stubDirectAdapter,
    () => Promise.reject(new Error('hotpath json fallback disabled')),
    () => Promise.reject(new Error('hotpath raw fallback disabled')),
  );

  bridgeInstance = new QueryRuntimeBridge(
    registry,
    executionPolicy,
    hotpathAdapter,
    () => true, // always prefer native
    {
      allowFallbackToSubprocess: false,
      strictSdk: false,
    },
  );

  return bridgeInstance;
}

// ─── Error classification ───────────────────────────────────────────────────

/**
 * Map a caught error into the 6-kind ADR-0001 error taxonomy.
 *
 * GSDToolsError.classification.kind: 'timeout' | 'failure'
 * GSDError.classification: ErrorClassification enum
 *
 * Mapping:
 * - 'Subprocess fallback disabled' message → unknown_command (no native adapter for command)
 * - GSDToolsError timeout kind → native_timeout
 * - GSDError Validation → validation_error
 * - GSDError Blocked → validation_error (semantic: prerequisite missing)
 * - TypeError (programming error) → internal_error
 * - GSDToolsError failure + TypeError cause → internal_error
 * - GSDToolsError failure → native_failure
 * - Unknown Error → internal_error
 */
function readReason(error: unknown): string | undefined {
  // Handlers can pin a CJS-style ERROR_REASON snake_case code on the GSDError
  // they throw (e.g. configGet → 'config_key_not_found'). The worker
  // propagates it through errorDetails so the CJS dispatcher can call
  // `error(msg, reason)` and `--json-errors` clients see a typed reason
  // rather than the generic 'unknown'. (Bugs #2943, #3086.)
  if (error && typeof error === 'object' && 'reason' in error) {
    const r = (error as { reason?: unknown }).reason;
    if (typeof r === 'string' && r.length > 0) return r;
  }
  return undefined;
}

function classifyError(error: unknown): { kind: SyncErrorKind; exitCode: number; message: string; reason?: string } {
  if (error instanceof GSDToolsError) {
    const { classification, exitCode, message } = error;

    // Unknown command: transport throws 'Subprocess fallback disabled: command ... cannot run without native dispatch'
    if (
      classification.kind === 'failure' &&
      message.includes('Subprocess fallback disabled:') &&
      message.includes('cannot run without native dispatch')
    ) {
      return { kind: 'unknown_command', exitCode: exitCode ?? 1, message };
    }

    if (classification.kind === 'timeout') {
      return { kind: 'native_timeout', exitCode: exitCode ?? 1, message };
    }

    // Unwrap the cause once.  The native direct adapter wraps every non-
    // GSDToolsError thrown by a handler in a GSDToolsError via
    // `createNativeFailureError`, preserving the original via `cause`.
    // Classification of validation / blocked errors therefore has to walk
    // through to the cause — otherwise every GSDError validation surfaces
    // as `native_failure` and callers cannot distinguish "you gave me bad
    // input" from "the SDK crashed."  (Phase 6 / #3592 contract bug.)
    const cause = (error as NodeJS.ErrnoException & { cause?: unknown }).cause;
    if (cause instanceof GSDError) {
      const reason = readReason(cause);
      if (
        cause.classification === ErrorClassification.Validation ||
        cause.classification === ErrorClassification.Blocked
      ) {
        return { kind: 'validation_error', exitCode: 10, message: cause.message, reason };
      }
      // Execution-classified GSDError is a 'handler said no' result —
      // exitCode 1, internal_error kind for taxonomy purposes, but pass
      // the structured reason through so the CJS dispatcher can render
      // the proper `--json-errors` shape.
      return { kind: 'internal_error', exitCode: 1, message: cause.message, reason };
    }
    if (cause instanceof TypeError) {
      return { kind: 'internal_error', exitCode: exitCode ?? 1, message };
    }

    return { kind: 'native_failure', exitCode: exitCode ?? 1, message };
  }

  if (error instanceof GSDError) {
    const { classification, message } = error;
    const reason = readReason(error);
    if (
      classification === ErrorClassification.Validation ||
      classification === ErrorClassification.Blocked
    ) {
      return { kind: 'validation_error', exitCode: 10, message, reason };
    }
    return { kind: 'internal_error', exitCode: 1, message, reason };
  }

  if (error instanceof TypeError) {
    const message = error.message;
    return { kind: 'internal_error', exitCode: 1, message };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'internal_error', exitCode: 1, message };
}

// ─── Worker entry point ─────────────────────────────────────────────────────

runAsWorker(async (input: RuntimeBridgeExecuteInput): Promise<RuntimeBridgeSyncResult> => {
  const bridge = getBridge();

  try {
    const data = await bridge.execute(input);
    return { ok: true, data, exitCode: 0 };
  } catch (error: unknown) {
    const { kind, exitCode, message, reason } = classifyError(error);
    const errorDetails: { message: string; reason?: string } = { message };
    if (reason) errorDetails.reason = reason;
    return {
      ok: false,
      exitCode,
      errorKind: kind,
      errorDetails,
      stderrLines: [],
    };
  }
});
