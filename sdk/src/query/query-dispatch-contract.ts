export type QueryDispatchErrorKind =
  | 'unknown_command'
  | 'native_failure'
  | 'native_timeout'
  | 'fallback_failure'
  | 'validation_error'
  | 'internal_error';

export interface QueryDispatchError {
  kind: QueryDispatchErrorKind;
  code: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface QueryDispatchSuccessResult {
  ok: true;
  stdout: string;
  stderr: string[];
  exit_code: 0;
}

export interface QueryDispatchFailureResult {
  ok: false;
  error: QueryDispatchError;
  stderr: string[];
  exit_code: number;
}

export type QueryDispatchResult = QueryDispatchSuccessResult | QueryDispatchFailureResult;
