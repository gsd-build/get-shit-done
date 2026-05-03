export type TransportMode = 'json' | 'raw';

export interface TransportPolicy {
  preferNative: boolean;
  allowFallbackToSubprocess: boolean;
  outputMode: TransportMode;
}

const DEFAULT_POLICY: TransportPolicy = {
  preferNative: true,
  allowFallbackToSubprocess: true,
  outputMode: 'json',
};

const BUILTIN_COMMAND_POLICY: Record<string, Partial<TransportPolicy>> = {
  // raw stdout contracts
  commit: { outputMode: 'raw' },
  'config-set': { outputMode: 'raw' },
  'verify-summary': { outputMode: 'raw' },
  'verify.summary': { outputMode: 'raw' },
  'verify summary': { outputMode: 'raw' },

  // native-first/hard-fail examples (can expand later)
  // 'state.load': { allowFallbackToSubprocess: false, outputMode: 'raw' },
};

const COMMAND_POLICY_OVERRIDES: Record<string, Partial<TransportPolicy>> = {};

export function resolveTransportPolicy(command: string): TransportPolicy {
  const override = {
    ...(BUILTIN_COMMAND_POLICY[command] ?? {}),
    ...(COMMAND_POLICY_OVERRIDES[command] ?? {}),
  };
  return {
    preferNative: override.preferNative ?? DEFAULT_POLICY.preferNative,
    allowFallbackToSubprocess:
      override.allowFallbackToSubprocess ?? DEFAULT_POLICY.allowFallbackToSubprocess,
    outputMode: override.outputMode ?? DEFAULT_POLICY.outputMode,
  };
}

export function setTransportPolicy(command: string, override: Partial<TransportPolicy>): void {
  COMMAND_POLICY_OVERRIDES[command] = { ...(COMMAND_POLICY_OVERRIDES[command] ?? {}), ...override };
}

export function clearTransportPolicy(command?: string): void {
  if (command) {
    delete COMMAND_POLICY_OVERRIDES[command];
    return;
  }
  for (const key of Object.keys(COMMAND_POLICY_OVERRIDES)) {
    delete COMMAND_POLICY_OVERRIDES[key];
  }
}
