#!/usr/bin/env node
/**
 * CLI entry point for gsd-sdk.
 *
 * Usage: gsd-sdk run "<prompt>" [--project-dir <dir>] [--ws-port <port>]
 *                                [--model <model>] [--max-budget <n>]
 */

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GSD } from './index.js';
import { CLITransport } from './cli-transport.js';
import { WSTransport } from './ws-transport.js';
import { InitRunner } from './init-runner.js';
import { validateWorkstreamName } from './workstream-utils.js';
import { loadConfig } from './config.js';
import { assertRuntimeSupportsAutoMode } from './runtime-gate.js';

// ─── Parsed CLI args ─────────────────────────────────────────────────────────

export interface ParsedCliArgs {
  command: string | undefined;
  prompt: string | undefined;
  /** For 'init' command: the raw input source (@file, text, or undefined for stdin). */
  initInput: string | undefined;
  /** For 'auto --init': bootstrap from a PRD before running the autonomous loop. */
  init: string | undefined;
  projectDir: string;
  wsPort: number | undefined;
  model: string | undefined;
  maxBudget: number | undefined;
  /** Workstream name for multi-workstream projects. Routes .planning/ to .planning/workstreams/<name>/. */
  ws: string | undefined;
  help: boolean;
  version: boolean;
  /**
   * When `command === 'query'`, tokens after `query` with only known SDK flags removed.
   * Extra flags are kept so handlers that share gsd-tools-style argv (e.g. `--pick`) still receive them.
   */
  queryArgv?: string[];
}

/**
 * Parse `gsd-sdk query …` without rejecting unknown flags (query argv is forwarded to the registry).
 */
function parseCliArgsQueryPermissive(argv: string[]): ParsedCliArgs {
  let projectDir = process.cwd();
  let ws: string | undefined;
  let wsPort: number | undefined;
  let model: string | undefined;
  let maxBudget: number | undefined;
  let help = false;
  let version = false;
  const queryArgv: string[] = [];

  let i = 1;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--project-dir' && argv[i + 1]) {
      projectDir = argv[i + 1];
      i += 2;
      continue;
    }
    if (a === '--ws' && argv[i + 1]) {
      ws = argv[i + 1];
      i += 2;
      continue;
    }
    if (a === '--ws-port' && argv[i + 1]) {
      wsPort = Number(argv[i + 1]);
      i += 2;
      continue;
    }
    if (a === '--model' && argv[i + 1]) {
      model = argv[i + 1];
      i += 2;
      continue;
    }
    if (a === '--max-budget' && argv[i + 1]) {
      maxBudget = Number(argv[i + 1]);
      i += 2;
      continue;
    }
    // #3019: do NOT consume -h / --help here unconditionally. Pushing the
    // flag onto queryArgv lets the registered handler (or the gsd-tools.cjs
    // fallback) render contextual subcommand help. We still set the global
    // `help` flag when the flag appears, but only short-circuit dispatch in
    // main() when there is no real subcommand to dispatch to (i.e. the only
    // tokens in queryArgv are the help flags themselves). That preserves
    // `gsd-sdk query --help` → top-level USAGE while letting
    // `gsd-sdk query phase add --help` reach the handler.
    if (a === '-h' || a === '--help') {
      help = true;
      queryArgv.push(a);
      i += 1;
      continue;
    }
    if (a === '-v' || a === '--version') {
      version = true;
      i += 1;
      continue;
    }
    queryArgv.push(a);
    i += 1;
  }

  // If the user typed a real subcommand (anything other than help flags
  // alone in queryArgv), do NOT short-circuit to top-level USAGE on help.
  // The handler/fallback will render contextual help.
  const nonHelpTokens = queryArgv.filter((t) => t !== '-h' && t !== '--help');
  if (help && nonHelpTokens.length > 0) {
    help = false;
  }

  return {
    command: 'query',
    prompt: undefined,
    initInput: undefined,
    init: undefined,
    projectDir,
    wsPort,
    model,
    maxBudget,
    ws,
    help,
    version,
    queryArgv,
  };
}

/**
 * Parse CLI arguments into a structured object.
 * Exported for testing — the main() function uses this internally.
 */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  if (argv[0] === 'query') {
    return parseCliArgsQueryPermissive(argv);
  }

  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      'project-dir': { type: 'string', default: process.cwd() },
      'ws-port': { type: 'string' },
      ws: { type: 'string' },
      model: { type: 'string' },
      'max-budget': { type: 'string' },
      init: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  const command = positionals[0] as string | undefined;
  const prompt = positionals.slice(1).join(' ') || undefined;

  // For 'init' command, the positional after 'init' is the input source.
  // For 'run' command, it's the prompt. Both use positionals[1+].
  const initInput = command === 'init' ? prompt : undefined;

  return {
    command,
    prompt,
    initInput,
    init: values.init as string | undefined,
    projectDir: values['project-dir'] as string,
    wsPort: values['ws-port'] ? Number(values['ws-port']) : undefined,
    model: values.model as string | undefined,
    maxBudget: values['max-budget'] ? Number(values['max-budget']) : undefined,
    ws: values.ws as string | undefined,
    help: values.help as boolean,
    version: values.version as boolean,
  };
}

// ─── Usage ───────────────────────────────────────────────────────────────────

export const USAGE = `
Usage: gsd-sdk <command> [args] [options]

Commands:
  run <prompt>          Run a full milestone from a text prompt
  auto                  Run the full autonomous lifecycle (discover -> execute -> advance)
  init [input]          Bootstrap a new project from a PRD or description
                        input can be:
                          @path/to/prd.md   Read input from a file
                          "description"     Use text directly
                          (empty)           Read from stdin
  query <argv...>       Registered query handlers only (longest-prefix argv match; see QUERY-HANDLERS.md)
                        Use --pick <field> to extract a specific field from JSON output

Options:
  --init <input>        Bootstrap from a PRD before running (auto only)
                        Accepts @path/to/prd.md or "description text"
  --project-dir <dir>   Project directory (default: cwd)
  --ws <name>           Route .planning/ to .planning/workstreams/<name>/
  --ws-port <port>      Enable WebSocket transport on <port>
  --model <model>       Override LLM model
  --max-budget <n>      Max budget per step in USD
  -h, --help            Show this help
  -v, --version         Show version
`.trim();

/**
 * Read the package version from package.json.
 */
async function getVersion(): Promise<string> {
  try {
    const pkgPath = resolve(fileURLToPath(import.meta.url), '..', '..', 'package.json');
    const raw = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Init input resolution ───────────────────────────────────────────────────

/**
 * Resolve the init command input to a string.
 *
 * - `@path/to/file.md` → reads the file contents
 * - Raw text → returns as-is
 * - No input → reads from stdin (with TTY detection)
 *
 * Exported for testing.
 */
export async function resolveInitInput(args: ParsedCliArgs): Promise<string> {
  const input = args.initInput;

  if (input && input.startsWith('@')) {
    // File path: strip @ prefix, resolve relative to projectDir
    const filePath = resolve(args.projectDir, input.slice(1));
    try {
      return await readFile(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Cannot read input file "${filePath}": ${(err as NodeJS.ErrnoException).code === 'ENOENT' ? 'file not found' : (err as Error).message}`);
    }
  }

  if (input) {
    // Raw text
    return input;
  }

  // No input — read from stdin
  return readStdin();
}

/**
 * Read all data from stdin. Rejects if stdin is a TTY with no piped data.
 */
async function readStdin(): Promise<string> {
  const { stdin } = process;

  if (stdin.isTTY) {
    throw new Error(
      'No input provided. Usage:\n' +
      '  gsd-sdk init @path/to/prd.md\n' +
      '  gsd-sdk init "build a todo app"\n' +
      '  cat prd.md | gsd-sdk init'
    );
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stdin.on('error', reject);
  });
}

/** When false, unknown `gsd-sdk query` commands error instead of shelling out to gsd-tools.cjs. */
function queryFallbackToCjsEnabled(): boolean {
  const v = process.env.GSD_QUERY_FALLBACK?.toLowerCase();
  if (v === 'off' || v === 'never' || v === 'false' || v === '0') return false;
  return true;
}


// ─── Main ────────────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let args: ParsedCliArgs;

  try {
    args = parseCliArgs(argv);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (args.version) {
    const ver = await getVersion();
    console.log(`gsd-sdk v${ver}`);
    return;
  }

  // Validate --ws flag if provided
  if (args.ws !== undefined && !validateWorkstreamName(args.ws)) {
    console.error(`Error: Invalid workstream name "${args.ws}". Use alphanumeric, hyphens, underscores, or dots only.`);
    process.exitCode = 1;
    return;
  }

  // Fall back to GSD_WORKSTREAM env var when --ws is not supplied (#2791).
  // gsd-tools.cjs resolves the active workstream via this env var; parity
  // means gsd-sdk query commands see the same .planning/ path as gsd-tools.
  if (args.ws === undefined && process.env.GSD_WORKSTREAM) {
    const envWs = process.env.GSD_WORKSTREAM;
    if (validateWorkstreamName(envWs)) {
      args = { ...args, ws: envWs };
    }
    // If the env var contains an invalid name, silently ignore it (same as CJS).
  }

  // Multi-repo project-root resolution (issue #2623).
  //
  // When the user launches `gsd-sdk` from inside a `sub_repos`-listed child repo,
  // `projectDir` defaults to `process.cwd()` which points at the child, not the
  // parent workspace that owns `.planning/`. Mirror the legacy `gsd-tools.cjs`
  // walk-up semantics so handlers see the correct project root.
  //
  // Idempotent: if `projectDir` already has its own `.planning/` (including an
  // explicit `--project-dir` pointing at the workspace root), findProjectRoot
  // returns it unchanged.
  {
    const { findProjectRoot } = await import('./query/helpers.js');
    args = { ...args, projectDir: findProjectRoot(args.projectDir) };
  }

  // ─── Query command ──────────────────────────────────────────────────────
  if (args.command === 'query') {
    const { createRegistry } = await import('./query/index.js');
    const { runQueryDispatch } = await import('./query/query-dispatch.js');
    const { resolveGsdToolsPath, GSDToolsError } = await import('./gsd-tools.js');
    const { GSDError, exitCodeFor } = await import('./errors.js');

    try {
      const registry = createRegistry();
      const out = await runQueryDispatch({
        registry,
        projectDir: args.projectDir,
        ws: args.ws,
        cjsFallbackEnabled: queryFallbackToCjsEnabled(),
        resolveGsdToolsPath,
        dispatchNative: (cmd, argv) => registry.dispatch(cmd, argv, args.projectDir, args.ws),
      }, args.queryArgv ?? []);

      for (const line of out.stderr) console.error(line);
      if (!out.ok) {
        console.error(out.error.message);
        process.exitCode = out.exit_code;
        return;
      }
      if (out.stdout) process.stdout.write(out.stdout);
    } catch (err) {
      if (err instanceof GSDError) {
        console.error(`Error: ${err.message}`);
        process.exitCode = exitCodeFor(err.classification);
      } else if (err instanceof GSDToolsError) {
        console.error(`Error: ${err.message}`);
        process.exitCode = err.exitCode ?? 1;
      } else {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    }
    return;
  }

  if (args.command !== 'run' && args.command !== 'init' && args.command !== 'auto') {
    console.error('Error: Expected "gsd-sdk run <prompt>", "gsd-sdk auto", "gsd-sdk init [input]", or "gsd-sdk query <command>"');
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (args.command === 'run' && !args.prompt) {
    console.error('Error: "gsd-sdk run" requires a prompt');
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  // ─── Init command ─────────────────────────────────────────────────────────
  if (args.command === 'init') {
    let input: string;
    try {
      input = await resolveInitInput(args);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }

    console.log(`[init] Resolved input: ${input.length} chars`);

    // Build GSD instance for tools and event stream
    const gsd = new GSD({
      projectDir: args.projectDir,
      model: args.model,
      maxBudgetUsd: args.maxBudget,
      workstream: args.ws,
    });

    // Wire CLI transport
    const cliTransport = new CLITransport();
    gsd.addTransport(cliTransport);

    // Optional WebSocket transport
    let wsTransport: WSTransport | undefined;
    if (args.wsPort !== undefined) {
      wsTransport = new WSTransport({ port: args.wsPort });
      await wsTransport.start();
      gsd.addTransport(wsTransport);
      console.log(`WebSocket transport listening on port ${args.wsPort}`);
    }

    try {
      const tools = gsd.createTools();
      const runner = new InitRunner({
        projectDir: args.projectDir,
        tools,
        eventStream: gsd.eventStream,
        config: {
          maxBudgetPerSession: args.maxBudget,
          orchestratorModel: args.model,
        },
      });

      const result = await runner.run(input);

      // Print completion summary
      const status = result.success ? 'SUCCESS' : 'FAILED';
      const stepCount = result.steps.length;
      const passedSteps = result.steps.filter(s => s.success).length;
      const cost = result.totalCostUsd.toFixed(2);
      const duration = (result.totalDurationMs / 1000).toFixed(1);
      const artifactList = result.artifacts.join(', ');

      console.log(`\n[${status}] ${passedSteps}/${stepCount} steps, $${cost}, ${duration}s`);
      if (result.artifacts.length > 0) {
        console.log(`Artifacts: ${artifactList}`);
      }

      if (!result.success) {
        // Log failed steps
        for (const step of result.steps) {
          if (!step.success && step.error) {
            console.error(`  ✗ ${step.step}: ${step.error}`);
          }
        }
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Fatal error: ${(err as Error).message}`);
      process.exitCode = 1;
    } finally {
      cliTransport.close();
      if (wsTransport) {
        wsTransport.close();
      }
    }
    return;
  }

  // ─── Auto command ─────────────────────────────────────────────────────────
  if (args.command === 'auto') {
    // #2832: refuse to silently route non-Claude runtime projects through the
    // Claude Agent SDK. Load project config (best effort — falls back to
    // defaults when missing) and gate before constructing GSD/InitRunner.
    try {
      const cfg = await loadConfig(args.projectDir, args.ws);
      assertRuntimeSupportsAutoMode(cfg);
    } catch (err) {
      console.error(`Fatal error: ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }

    const gsd = new GSD({
      projectDir: args.projectDir,
      model: args.model,
      maxBudgetUsd: args.maxBudget,
      autoMode: true,
      workstream: args.ws,
    });

    // Wire CLI transport (always active)
    const cliTransport = new CLITransport();
    gsd.addTransport(cliTransport);

    // Optional WebSocket transport
    let wsTransport: WSTransport | undefined;
    if (args.wsPort !== undefined) {
      wsTransport = new WSTransport({ port: args.wsPort });
      await wsTransport.start();
      gsd.addTransport(wsTransport);
      console.log(`WebSocket transport listening on port ${args.wsPort}`);
    }

    try {
      // If --init provided, bootstrap project first
      if (args.init) {
        const initInput = await resolveInitInput({
          ...args,
          command: 'init',
          initInput: args.init,
        });

        console.log(`[auto] Bootstrapping project from --init (${initInput.length} chars)`);

        const tools = gsd.createTools();
        const runner = new InitRunner({
          projectDir: args.projectDir,
          tools,
          eventStream: gsd.eventStream,
          config: {
            maxBudgetPerSession: args.maxBudget,
            orchestratorModel: args.model,
          },
        });

        const initResult = await runner.run(initInput);

        const initStatus = initResult.success ? 'SUCCESS' : 'FAILED';
        const stepCount = initResult.steps.length;
        const passedSteps = initResult.steps.filter(s => s.success).length;
        const initCost = initResult.totalCostUsd.toFixed(2);
        const initDuration = (initResult.totalDurationMs / 1000).toFixed(1);
        console.log(`[init ${initStatus}] ${passedSteps}/${stepCount} steps, $${initCost}, ${initDuration}s`);

        if (!initResult.success) {
          for (const step of initResult.steps) {
            if (!step.success && step.error) {
              console.error(`  ✗ ${step.step}: ${step.error}`);
            }
          }
          process.exitCode = 1;
          return;
        }
      }

      const result = await gsd.run('');

      // Final summary
      const status = result.success ? 'SUCCESS' : 'FAILED';
      const phases = result.phases.length;
      const cost = result.totalCostUsd.toFixed(2);
      const duration = (result.totalDurationMs / 1000).toFixed(1);
      console.log(`\n[${status}] ${phases} phase(s), $${cost}, ${duration}s`);

      if (!result.success) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Fatal error: ${(err as Error).message}`);
      process.exitCode = 1;
    } finally {
      cliTransport.close();
      if (wsTransport) {
        wsTransport.close();
      }
    }
    return;
  }

  // ─── Run command ─────────────────────────────────────────────────────────

  // Build GSD instance
  const gsd = new GSD({
    projectDir: args.projectDir,
    model: args.model,
    maxBudgetUsd: args.maxBudget,
    workstream: args.ws,
  });

  // Wire CLI transport (always active)
  const cliTransport = new CLITransport();
  gsd.addTransport(cliTransport);

  // Optional WebSocket transport
  let wsTransport: WSTransport | undefined;
  if (args.wsPort !== undefined) {
    wsTransport = new WSTransport({ port: args.wsPort });
    await wsTransport.start();
    gsd.addTransport(wsTransport);
    console.log(`WebSocket transport listening on port ${args.wsPort}`);
  }

  try {
    const result = await gsd.run(args.prompt!);

    // Final summary
    const status = result.success ? 'SUCCESS' : 'FAILED';
    const phases = result.phases.length;
    const cost = result.totalCostUsd.toFixed(2);
    const duration = (result.totalDurationMs / 1000).toFixed(1);
    console.log(`\n[${status}] ${phases} phase(s), $${cost}, ${duration}s`);

    if (!result.success) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Fatal error: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    // Clean up transports
    cliTransport.close();
    if (wsTransport) {
      wsTransport.close();
    }
  }
}

// ─── Auto-run when invoked directly ──────────────────────────────────────────

main();
