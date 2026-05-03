import type { QueryDispatchError, QueryDispatchErrorKind, QueryDispatchResult } from './query-dispatch-contract.js';

export function toDispatchFailure(
  error: QueryDispatchError,
  stderr: string[] = [],
): QueryDispatchResult {
  return {
    ok: false,
    stderr,
    exit_code: error.code,
    error,
  };
}

export function mapNativeDispatchError(error: unknown, command: string, args: string[]): QueryDispatchError {
  const message = error instanceof Error ? error.message : String(error);
  const kind: QueryDispatchErrorKind = message.includes('timed out after')
    ? 'native_timeout'
    : 'native_failure';
  return {
    kind,
    code: 1,
    message: `Error: ${message}`,
    details: {
      command,
      args,
      ...(kind === 'native_timeout' ? { timeout_ms: parseTimeoutMs(message) } : {}),
    },
  };
}

export function mapFallbackDispatchError(error: unknown, command: string, args: string[]): QueryDispatchError {
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: 'fallback_failure',
    code: 1,
    message: `Error: gsd-tools.cjs fallback failed: ${message}`,
    details: {
      command,
      args,
      backend: 'cjs',
    },
  };
}

function parseTimeoutMs(message: string): number | undefined {
  const m = message.match(/timed out after\s+(\d+)ms/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}
