import { formatQueryRawOutput } from './query-raw-output-projection.js';
import type { QueryResult } from './query/utils.js';

export interface QueryNativeDirectAdapterDeps {
  timeoutMs: number;
  dispatch: (registryCommand: string, registryArgs: string[]) => Promise<QueryResult>;
  createTimeoutError: (message: string, command: string, args: string[]) => Error;
}

/**
 * Adapter Module for direct native registry dispatch with timeout policy.
 */
export class QueryNativeDirectAdapter {
  constructor(private readonly deps: QueryNativeDirectAdapterDeps) {}

  async dispatchResult(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<QueryResult> {
    return this.withTimeout(legacyCommand, legacyArgs, this.deps.dispatch(registryCommand, registryArgs));
  }

  async dispatchJson(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<unknown> {
    const result = await this.dispatchResult(legacyCommand, legacyArgs, registryCommand, registryArgs);
    return result.data;
  }

  async dispatchRaw(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<string> {
    const result = await this.dispatchResult(legacyCommand, legacyArgs, registryCommand, registryArgs);
    return formatQueryRawOutput(registryCommand, result.data).trim();
  }

  private async withTimeout<T>(legacyCommand: string, legacyArgs: string[], work: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          this.deps.createTimeoutError(
            `gsd-tools timed out after ${this.deps.timeoutMs}ms: ${legacyCommand} ${legacyArgs.join(' ')}`,
            legacyCommand,
            legacyArgs,
          ),
        );
      }, this.deps.timeoutMs);
    });

    try {
      return await Promise.race([work, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }
}
