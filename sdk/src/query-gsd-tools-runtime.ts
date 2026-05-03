import type { GSDEventStream } from './event-stream.js';
import { createRegistry } from './query/index.js';
import type { QueryResult } from './query/utils.js';
import { GSDTransport } from './gsd-transport.js';
import { QueryExecutionPolicy } from './query-execution-policy.js';
import { QuerySubprocessAdapter } from './query-subprocess-adapter.js';
import { QueryNativeDirectAdapter } from './query-native-direct-adapter.js';
import { QueryNativeHotpathAdapter } from './query-native-hotpath-adapter.js';
import { formatQueryRawOutput } from './query-raw-output-projection.js';
import { GSDToolsError } from './gsd-tools-error.js';

export interface GSDToolsRuntime {
  registry: ReturnType<typeof createRegistry>;
  executionPolicy: QueryExecutionPolicy;
  nativeHotpathAdapter: QueryNativeHotpathAdapter;
}

export function createGSDToolsRuntime(opts: {
  projectDir: string;
  gsdToolsPath: string;
  timeoutMs: number;
  workstream?: string;
  eventStream?: GSDEventStream;
  sessionId?: string;
  shouldUseNativeQuery: () => boolean;
  execJsonFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>;
  execRawFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<string>;
}): GSDToolsRuntime {
  const registry = createRegistry(opts.eventStream, opts.sessionId);

  const subprocessAdapter = new QuerySubprocessAdapter({
    projectDir: opts.projectDir,
    gsdToolsPath: opts.gsdToolsPath,
    timeoutMs: opts.timeoutMs,
    workstream: opts.workstream,
    createToolsError: (message, command, args, exitCode, stderr) =>
      new GSDToolsError(message, command, args, exitCode, stderr),
  });

  const nativeDirectAdapter = new QueryNativeDirectAdapter({
    timeoutMs: opts.timeoutMs,
    dispatch: (registryCommand, registryArgs) => registry.dispatch(registryCommand, registryArgs, opts.projectDir),
    createTimeoutError: (message, command, args) => new GSDToolsError(message, command, args, null, ''),
  });

  const transport = new GSDTransport(registry, {
    dispatchNative: async (request) => nativeDirectAdapter.dispatchResult(
      request.legacyCommand,
      request.legacyArgs,
      request.registryCommand,
      request.registryArgs,
    ) as Promise<QueryResult>,
    execSubprocessJson: async (legacyCommand, legacyArgs) => subprocessAdapter.execJson(legacyCommand, legacyArgs),
    execSubprocessRaw: async (legacyCommand, legacyArgs) => subprocessAdapter.execRaw(legacyCommand, legacyArgs),
    formatNativeRaw: (registryCommand, data) => formatQueryRawOutput(registryCommand, data),
  });

  const executionPolicy = new QueryExecutionPolicy(transport);
  const nativeHotpathAdapter = new QueryNativeHotpathAdapter(
    opts.shouldUseNativeQuery,
    nativeDirectAdapter,
    opts.execJsonFallback,
    opts.execRawFallback,
  );

  return { registry, executionPolicy, nativeHotpathAdapter };
}
