export interface UnknownCommandDetails {
  normalized: string;
  attempted: string[];
  hints: string[];
}

export interface NativeErrorDetails {
  command: string;
  args: string[];
  timeout_ms?: number;
}

export interface FallbackErrorDetails {
  command: string;
  args: string[];
  backend: 'cjs';
}

export function unknownCommandDetails(input: UnknownCommandDetails): UnknownCommandDetails {
  return input;
}

export function nativeErrorDetails(input: NativeErrorDetails): NativeErrorDetails {
  return input;
}

export function fallbackErrorDetails(input: FallbackErrorDetails): FallbackErrorDetails {
  return input;
}
