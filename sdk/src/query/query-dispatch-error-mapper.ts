import type { QueryDispatchError, QueryDispatchResult } from './query-dispatch-contract.js';
import { fallbackFailureError, nativeFailureError, nativeTimeoutError } from './query-error-taxonomy.js';
import { dispatchFailure } from './query-dispatch-result-builder.js';

export function toDispatchFailure(
  error: QueryDispatchError,
  stderr: string[] = [],
): QueryDispatchResult {
  return dispatchFailure(error, stderr);
}

export function mapNativeDispatchError(error: unknown, command: string, args: string[]): QueryDispatchError {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out after/i.test(message)) {
    return nativeTimeoutError({ message, command, args, timeoutMs: parseTimeoutMs(message) });
  }
  return nativeFailureError({ message, command, args });
}

export function mapFallbackDispatchError(error: unknown, command: string, args: string[]): QueryDispatchError {
  const message = error instanceof Error ? error.message : String(error);
  return fallbackFailureError({ message, command, args, backend: 'cjs' });
}

function parseTimeoutMs(message: string): number | undefined {
  const m = message.match(/timed out after\s+(\d+)ms/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}
