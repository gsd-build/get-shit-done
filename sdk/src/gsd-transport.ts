import type { QueryResult } from './query/utils.js';
import type { QueryRegistry } from './query/registry.js';
import type { TransportMode } from './gsd-transport-policy.js';

export interface TransportRequest {
  legacyCommand: string;
  legacyArgs: string[];
  registryCommand: string;
  registryArgs: string[];
  mode: TransportMode;
  projectDir: string;
  workstream?: string;
}

export interface TransportAdapters {
  dispatchNative: (request: TransportRequest) => Promise<QueryResult>;
  execSubprocessJson: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>;
  execSubprocessRaw: (legacyCommand: string, legacyArgs: string[]) => Promise<string>;
  formatNativeRaw?: (registryCommand: string, data: unknown) => string;
}

export interface TransportPolicyLike {
  preferNative: boolean;
  allowFallbackToSubprocess: boolean;
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  return error.message.includes('timed out after');
}

export class GSDTransport {
  constructor(
    private readonly registry: QueryRegistry,
    private readonly adapters: TransportAdapters,
  ) {}

  async run(request: TransportRequest, policy: TransportPolicyLike): Promise<unknown> {
    const forceSubprocess = Boolean(request.workstream);

    if (!forceSubprocess && policy.preferNative && this.registry.has(request.registryCommand)) {
      try {
        const native = await this.adapters.dispatchNative(request);
        if (request.mode === 'raw') {
          if (this.adapters.formatNativeRaw) {
            return this.adapters.formatNativeRaw(request.registryCommand, native.data).trim();
          }
          return this.toRaw(native.data);
        }
        return native.data;
      } catch (error) {
        if (!policy.allowFallbackToSubprocess) throw error;
        // Do not subprocess-fallback after a timed-out native dispatch:
        // the timeout does not cancel the native handler, so falling through
        // would run the same command twice (double-execution race).
        if (isTimeoutLikeError(error)) throw error;
      }
    }

    if (request.mode === 'raw') {
      return this.adapters.execSubprocessRaw(request.legacyCommand, request.legacyArgs);
    }
    return this.adapters.execSubprocessJson(request.legacyCommand, request.legacyArgs);
  }

  private toRaw(data: unknown): string {
    if (typeof data === 'string') return data.trim();
    const json = JSON.stringify(data, null, 2);
    if (json == null) return '';
    return json.trim();
  }
}
