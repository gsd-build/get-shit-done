import { resolveTransportPolicy } from './gsd-transport-policy.js';
import type { GSDTransport } from './gsd-transport.js';
import type { TransportMode } from './gsd-transport-policy.js';

export interface QueryExecutionRequest {
  legacyCommand: string;
  legacyArgs: string[];
  registryCommand: string;
  registryArgs: string[];
  mode: TransportMode;
  projectDir: string;
  workstream?: string;
  preferNativeQuery: boolean;
}

/**
 * Execution policy for query command dispatch.
 * Owns routing decision inputs for native/subprocess dispatch.
 */
export class QueryExecutionPolicy {
  constructor(private readonly transport: GSDTransport) {}

  async execute(request: QueryExecutionRequest): Promise<unknown> {
    const policy = resolveTransportPolicy(request.registryCommand);

    return this.transport.run(
      {
        legacyCommand: request.legacyCommand,
        legacyArgs: request.legacyArgs,
        registryCommand: request.registryCommand,
        registryArgs: request.registryArgs,
        mode: request.mode,
        projectDir: request.projectDir,
        workstream: request.workstream,
      },
      {
        preferNative: request.preferNativeQuery && policy.preferNative,
        allowFallbackToSubprocess: policy.allowFallbackToSubprocess,
      },
    );
  }
}
