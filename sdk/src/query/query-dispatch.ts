import type { QueryRegistry } from './registry.js';
import { extractField } from './registry.js';
import { planQueryDispatch } from './query-fallback-orchestration.js';
import { runCjsFallbackQuery } from './query-fallback-executor.js';
import type { QueryResult } from './utils.js';

export interface QueryDispatchError {
  code: number;
  message: string;
}

export interface QueryDispatchResult {
  stdout?: string;
  stderr: string[];
  error?: QueryDispatchError;
}

export interface QueryDispatchDeps {
  registry: QueryRegistry;
  projectDir: string;
  ws?: string;
  cjsFallbackEnabled: boolean;
  resolveGsdToolsPath: (projectDir: string) => string;
  dispatchNative: (cmd: string, args: string[]) => Promise<QueryResult>;
}

function extractPick(queryArgv: string[]): { queryArgs: string[]; pickField?: string; error?: QueryDispatchError } {
  const queryArgs = [...queryArgv];
  const pickIdx = queryArgs.indexOf('--pick');
  if (pickIdx === -1) return { queryArgs };
  if (pickIdx + 1 >= queryArgs.length) {
    return {
      queryArgs,
      error: { code: 10, message: 'Error: --pick requires a field name' },
    };
  }
  const pickField = queryArgs[pickIdx + 1];
  queryArgs.splice(pickIdx, 2);
  return { queryArgs, pickField };
}

function formatOutput(data: unknown, format: QueryResult['format'], pickField?: string): string {
  let output: unknown = data;
  if (pickField) output = extractField(output, pickField);
  if (!pickField && format === 'text' && typeof output === 'string') return output;
  return `${JSON.stringify(output, null, 2)}\n`;
}

export async function runQueryDispatch(deps: QueryDispatchDeps, queryArgv: string[]): Promise<QueryDispatchResult> {
  const picked = extractPick(queryArgv);
  if (picked.error) return { stderr: [], error: picked.error };

  const { queryArgs, pickField } = picked;
  if (queryArgs.length === 0 || !queryArgs[0]) {
    return { stderr: [], error: { code: 10, message: 'Error: "gsd-sdk query" requires a command' } };
  }

  const plan = planQueryDispatch(queryArgs, deps.registry, { cjsFallbackEnabled: deps.cjsFallbackEnabled });
  const normCmd = plan.normalized.command;
  const normArgs = plan.normalized.args;

  if (!normCmd || !String(normCmd).trim()) {
    return { stderr: [], error: { code: 10, message: 'Error: "gsd-sdk query" requires a command' } };
  }

  if (plan.mode === 'error') {
    return {
      stderr: [],
      error: {
        code: 10,
        message: `Error: Unknown command: "${[normCmd, ...normArgs].join(' ')}". Use a registered \`gsd-sdk query\` subcommand (see sdk/src/query/QUERY-HANDLERS.md) or invoke \`node …/gsd-tools.cjs\` for CJS-only operations. Set GSD_QUERY_FALLBACK=registered (default) to allow automatic fallback.`,
      },
    };
  }

  if (plan.mode === 'cjs') {
    const gsdPath = deps.resolveGsdToolsPath(deps.projectDir);
    const fallback = await runCjsFallbackQuery(
      deps.projectDir,
      gsdPath,
      normCmd,
      normArgs,
      deps.ws,
    );
    const stderr = [
      `[gsd-sdk] '${[normCmd, ...normArgs].join(' ')}' not in native registry; falling back to gsd-tools.cjs.`,
      '[gsd-sdk] Transparent bridge — prefer adding a native handler when parity matters.',
    ];
    if (fallback.stderr.trim()) stderr.push(fallback.stderr.trimEnd());

    if (fallback.mode === 'text') {
      const text = String(fallback.output ?? '');
      if (!text.trim()) return { stderr };
      return { stderr, stdout: text.endsWith('\n') ? text : `${text}\n` };
    }

    return {
      stderr,
      stdout: formatOutput(fallback.output, 'json', pickField),
    };
  }

  const matched = plan.matched!;
  const result = await deps.dispatchNative(matched.cmd, matched.args);
  return {
    stderr: [],
    stdout: formatOutput(result.data, result.format, pickField),
  };
}
