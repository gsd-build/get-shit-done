import type { QueryResult } from './query/utils.js';
import type { QueryRegistry } from './query/registry.js';
import type { TransportMode } from './gsd-transport-policy.js';
import { toFailureSignal } from './query-failure-classification.js';
import { GSDToolsError } from './gsd-tools-error.js';

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

export interface TransportDecision {
  dispatchMode: 'native' | 'subprocess';
  reason?: 'native_not_preferred' | 'native_unregistered' | 'native_failure_fallback';
}

export class GSDTransport {
  constructor(
    private readonly registry: QueryRegistry,
    private readonly adapters: TransportAdapters,
  ) {}

  async run(
    request: TransportRequest,
    policy: TransportPolicyLike,
    onDecision?: (decision: TransportDecision) => void,
  ): Promise<unknown> {
    const useNative = this.shouldUseNative(request, policy);
    if (useNative) {
      try {
        const native = await this.adapters.dispatchNative(request);
        onDecision?.({ dispatchMode: 'native' });
        return this.projectNativeOutput(request, native.data);
      } catch (error) {
        if (this.shouldRethrowNativeError(error, policy)) throw error;
        onDecision?.({ dispatchMode: 'subprocess', reason: 'native_failure_fallback' });
      }
    } else {
      const reason = this.subprocessReason(request, policy);
      if (!policy.allowFallbackToSubprocess && reason === 'native_unregistered') {
        throw GSDToolsError.failure(
          `Subprocess fallback disabled: command '${request.registryCommand}' cannot run without native dispatch`,
          request.legacyCommand,
          request.legacyArgs,
          null,
        );
      }
      onDecision?.({ dispatchMode: 'subprocess', reason });
    }

    return this.dispatchSubprocess(request);
  }

  private shouldUseNative(request: TransportRequest, policy: TransportPolicyLike): boolean {
    // Phase 5.0 worker fix: dispatchNative now correctly threads projectDir and
    // workstream per-request (see worker.ts dispatchNative closure). Workstream
    // commands no longer need to force subprocess — native dispatch handles them.
    return policy.preferNative && this.registry.has(request.registryCommand);
  }

  private subprocessReason(request: TransportRequest, policy: TransportPolicyLike): TransportDecision['reason'] {
    if (!policy.preferNative) return 'native_not_preferred';
    if (!this.registry.has(request.registryCommand)) return 'native_unregistered';

    throw new Error(
      `Unexpected subprocess reason state for command '${request.registryCommand}' with preferNative=${String(policy.preferNative)}`,
    );
  }

  private shouldRethrowNativeError(error: unknown, policy: TransportPolicyLike): boolean {
    if (!policy.allowFallbackToSubprocess) return true;
    // Do not subprocess-fallback after a timed-out native dispatch:
    // the timeout does not cancel the native handler, so falling through
    // would run the same command twice (double-execution race).
    return toFailureSignal(error).kind === 'timeout';
  }

  private dispatchSubprocess(request: TransportRequest): Promise<unknown> {
    if (request.mode === 'raw') {
      return this.adapters.execSubprocessRaw(request.legacyCommand, request.legacyArgs);
    }
    return this.adapters.execSubprocessJson(request.legacyCommand, request.legacyArgs);
  }

  private projectNativeOutput(request: TransportRequest, data: unknown): unknown {
    if (request.mode === 'raw') {
      if (this.adapters.formatNativeRaw) {
        return this.adapters.formatNativeRaw(request.registryCommand, data).trim();
      }
      return this.toRaw(data);
    }
    return data;
  }

  private toRaw(data: unknown): string {
    if (typeof data === 'string') return data.trim();
    const json = JSON.stringify(data, null, 2);
    if (json == null) return '';
    return json.trim();
  }
}
