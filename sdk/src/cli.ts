#!/usr/bin/env node
/**
 * CLI entry point for gsd-sdk.
 *
 * Usage: gsd-sdk run "<prompt>" [--project-dir <dir>] [--ws-port <port>]
 *                                [--model <model>] [--max-budget <n>]
 */

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GSD } from './index.js';
import { CLITransport } from './cli-transport.js';
import { WSTransport } from './ws-transport.js';
import { InitRunner } from './init-runner.js';

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
  help: boolean;
  version: boolean;
}

/**
 * Parse CLI arguments into a structured object.
 * Exported for testing — the main() function uses this internally.
 */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      'project-dir': { type: 'string', default: process.cwd() },
      'ws-port': { type: 'string' },
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
    help: values.help as boolean,
    version: values.version as boolean,
  };
}

// ─── Usage ───────────────────────────────────────────────────────────────────

export const USAGE = `
Usage: gsd-sdk <command> [args] [options]

Commands:
  run <prompt>          Run a full milestone from a text prompt
  auto                  Run the full autonomous lifecycle (discover → execute → advance)
  init [input]          Bootstrap a new project from a PRD or description
                        input can be:
                          @path/to/prd.md   Read input from a file
                          "description"     Use text directly
                          (empty)           Read from stdin

Options:
  --init <input>        Bootstrap from a PRD before running (auto only)
                        Accepts @path/to/prd.md or "description text"
  --project-dir <dir>   Project directory (default: cwd)
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

  if (args.command !== 'run' && args.command !== 'init' && args.command !== 'auto') {
    console.error('Error: Expected "gsd-sdk run <prompt>", "gsd-sdk auto", or "gsd-sdk init [input]"');
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
    const gsd = new GSD({
      projectDir: args.projectDir,
      model: args.model,
      maxBudgetUsd: args.maxBudget,
      autoMode: true,
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
