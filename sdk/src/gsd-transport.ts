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
  dispatchNative: (registryCommand: string, registryArgs: string[]) => Promise<QueryResult>;
  execSubprocessJson: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>;
  execSubprocessRaw: (legacyCommand: string, legacyArgs: string[]) => Promise<string>;
  formatNativeRaw?: (registryCommand: string, data: unknown) => string;
}

export interface TransportPolicyLike {
  preferNative: boolean;
  allowFallbackToSubprocess: boolean;
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
        const native = await this.adapters.dispatchNative(request.registryCommand, request.registryArgs);
        if (request.mode === 'raw') {
          if (this.adapters.formatNativeRaw) {
            return this.adapters.formatNativeRaw(request.registryCommand, native.data).trim();
          }
          return this.toRaw(native.data);
        }
        return native.data;
      } catch (error) {
        if (!policy.allowFallbackToSubprocess) throw error;
      }
    }

    if (request.mode === 'raw') {
      return this.adapters.execSubprocessRaw(request.legacyCommand, request.legacyArgs);
    }
    return this.adapters.execSubprocessJson(request.legacyCommand, request.legacyArgs);
  }

  private toRaw(data: unknown): string {
    if (typeof data === 'string') return data.trim();
    return JSON.stringify(data, null, 2).trim();
  }
}
