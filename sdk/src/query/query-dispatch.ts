import type { QueryRegistry } from './registry.js';
import { extractField } from './registry.js';
import { normalizeQueryCommand } from './normalize-query-command.js';
import { explainQueryCommandNoMatch, resolveQueryCommand, type QueryCommandResolution } from './command-resolution.js';
import { runCjsFallbackDispatch } from './query-fallback-executor.js';
import type { QueryResult } from './utils.js';
import type { QueryDispatchError, QueryDispatchResult } from './query-dispatch-contract.js';

export interface QueryDispatchDeps {
  registry: QueryRegistry;
  projectDir: string;
  ws?: string;
  cjsFallbackEnabled: boolean;
  resolveGsdToolsPath: (projectDir: string) => string;
  dispatchNative: (cmd: string, args: string[]) => Promise<QueryResult>;
}

type DispatchMode = 'native' | 'cjs' | 'error';

interface DispatchPlan {
  mode: DispatchMode;
  normalized: { command: string; args: string[]; tokens: string[] };
  matched: QueryCommandResolution | null;
}

function planQueryDispatch(queryArgv: string[], registry: QueryRegistry, cjsFallbackEnabled: boolean): DispatchPlan {
  const queryCommand = queryArgv[0];
  if (!queryCommand) {
    return { mode: 'error', normalized: { command: '', args: [], tokens: [] }, matched: null };
  }

  const [normCmd, normArgs] = normalizeQueryCommand(queryCommand, queryArgv.slice(1));
  const normalizedTokens = [normCmd, ...normArgs];
  const matched = resolveQueryCommand(queryCommand, queryArgv.slice(1), registry);
  if (matched) {
    return { mode: 'native', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched };
  }
  if (cjsFallbackEnabled) {
    return { mode: 'cjs', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: null };
  }
  return { mode: 'error', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: null };
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
  // Text-format responses ignore --pick to match CJS fallback behavior.
  if (format === 'text' && typeof data === 'string') {
    return data.endsWith('\n') ? data : `${data}\n`;
  }
  let output: unknown = data;
  if (pickField) output = extractField(output, pickField);
  return `${JSON.stringify(output, null, 2)}\n`;
}

export async function runQueryDispatch(deps: QueryDispatchDeps, queryArgv: string[]): Promise<QueryDispatchResult> {
  const picked = extractPick(queryArgv);
  if (picked.error) return { stderr: [], error: picked.error };

  const { queryArgs, pickField } = picked;
  if (queryArgs.length === 0 || !queryArgs[0]) {
    return { stderr: [], error: { code: 10, message: 'Error: "gsd-sdk query" requires a command' } };
  }

  const plan = planQueryDispatch(queryArgs, deps.registry, deps.cjsFallbackEnabled);
  const normCmd = plan.normalized.command;
  const normArgs = plan.normalized.args;

  if (!normCmd || !String(normCmd).trim()) {
    return { stderr: [], error: { code: 10, message: 'Error: "gsd-sdk query" requires a command' } };
  }

  if (plan.mode === 'error') {
    const noMatch = queryArgs[0]
      ? explainQueryCommandNoMatch(queryArgs[0], queryArgs.slice(1), deps.registry)
      : null;
    return {
      stderr: [],
      error: {
        code: 10,
        message: `Error: Unknown command: "${[normCmd, ...normArgs].join(' ')}". Use a registered \`gsd-sdk query\` subcommand (see sdk/src/query/QUERY-HANDLERS.md) or invoke \`node …/gsd-tools.cjs\` for CJS-only operations. CJS fallback is disabled (GSD_QUERY_FALLBACK=registered). To enable fallback, unset GSD_QUERY_FALLBACK or set it to a non-restricted value.${noMatch ? ` Attempted dotted: ${noMatch.attempted.dotted.slice(0, 2).join(' | ')}.` : ''}`,
      },
    };
  }

  if (plan.mode === 'cjs') {
    const gsdPath = deps.resolveGsdToolsPath(deps.projectDir);
    return runCjsFallbackDispatch({
      projectDir: deps.projectDir,
      gsdToolsPath: gsdPath,
      normCmd,
      normArgs,
      ws: deps.ws,
      pickField,
    });
  }

  const matched = plan.matched!;
  try {
    const result = await deps.dispatchNative(matched.cmd, matched.args);
    return {
      stderr: [],
      stdout: formatOutput(result.data, result.format, pickField),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      stderr: [],
      error: { code: 1, message: `Error: ${msg}` },
    };
  }
}
