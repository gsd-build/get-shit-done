export interface QueryDispatchError {
  code: number;
  message: string;
}

export interface QueryDispatchResult {
  stdout?: string;
  stderr: string[];
  error?: QueryDispatchError;
}
