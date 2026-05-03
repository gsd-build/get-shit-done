import type { QueryDispatchError } from './query-dispatch-contract.js';

export function unknownCommandError(input: {
  message: string;
  normalized: string;
  attempted: string[];
  hints: string[];
}): QueryDispatchError {
  return {
    kind: 'unknown_command',
    code: 10,
    message: input.message,
    details: {
      normalized: input.normalized,
      attempted: input.attempted,
      hints: input.hints,
    },
  };
}

export function nativeFailureError(input: {
  message: string;
  command: string;
  args: string[];
}): QueryDispatchError {
  return {
    kind: 'native_failure',
    code: 1,
    message: `Error: ${input.message}`,
    details: {
      command: input.command,
      args: input.args,
    },
  };
}

export function nativeTimeoutError(input: {
  message: string;
  command: string;
  args: string[];
  timeoutMs?: number;
}): QueryDispatchError {
  return {
    kind: 'native_timeout',
    code: 1,
    message: `Error: ${input.message}`,
    details: {
      command: input.command,
      args: input.args,
      ...(input.timeoutMs !== undefined ? { timeout_ms: input.timeoutMs } : {}),
    },
  };
}

export function fallbackFailureError(input: {
  message: string;
  command: string;
  args: string[];
  backend?: 'cjs';
}): QueryDispatchError {
  return {
    kind: 'fallback_failure',
    code: 1,
    message: `Error: gsd-tools.cjs fallback failed: ${input.message}`,
    details: {
      command: input.command,
      args: input.args,
      backend: input.backend ?? 'cjs',
    },
  };
}

export function validationError(input: {
  message: string;
  code?: number;
  details?: Record<string, unknown>;
}): QueryDispatchError {
  return {
    kind: 'validation_error',
    code: input.code ?? 10,
    message: input.message,
    details: input.details,
  };
}

export function internalError(input: {
  message: string;
  code?: number;
  details?: Record<string, unknown>;
}): QueryDispatchError {
  return {
    kind: 'internal_error',
    code: input.code ?? 1,
    message: input.message,
    details: input.details,
  };
}
