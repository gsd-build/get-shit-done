import type { QueryNativeDirectAdapter } from './query-native-direct-adapter.js';

/**
 * Adapter Module for runner hot-path native commands.
 */
export class QueryNativeHotpathAdapter {
  constructor(
    private readonly shouldUseNativeQuery: () => boolean,
    private readonly nativeDirect: QueryNativeDirectAdapter,
    private readonly execJsonFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>,
    private readonly execRawFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<string>,
  ) {}

  async dispatch(
    legacyCommand: string,
    legacyArgs: string[],
    registryCommand: string,
    registryArgs: string[],
    mode: 'json' | 'raw',
  ): Promise<unknown> {
    if (!this.shouldUseNativeQuery()) {
      return mode === 'raw'
        ? this.execRawFallback(legacyCommand, legacyArgs)
        : this.execJsonFallback(legacyCommand, legacyArgs);
    }

    return mode === 'raw'
      ? this.nativeDirect.dispatchRaw(legacyCommand, legacyArgs, registryCommand, registryArgs)
      : this.nativeDirect.dispatchJson(legacyCommand, legacyArgs, registryCommand, registryArgs);
  }
}
