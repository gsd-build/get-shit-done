import type { QueryDispatchError, QueryDispatchResult } from './query-dispatch-contract.js';

export function dispatchFailure(error: QueryDispatchError, stderr: string[] = []): QueryDispatchResult {
  return {
    ok: false,
    error,
    stderr,
    exit_code: error.code,
  };
}

export function dispatchSuccess(stdout: string, stderr: string[] = []): QueryDispatchResult {
  return {
    ok: true,
    stdout,
    stderr,
    exit_code: 0,
  };
}
