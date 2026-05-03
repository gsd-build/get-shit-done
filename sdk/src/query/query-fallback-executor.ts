import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extractField } from './registry.js';
import type { QueryDispatchResult } from './query-dispatch-contract.js';
import { mapFallbackDispatchError, toDispatchFailure } from './query-dispatch-error-mapper.js';

interface CjsFallbackQueryResult {
  mode: 'json' | 'text';
  output: unknown;
  stderr: string;
}

export interface RunCjsFallbackDispatchInput {
  projectDir: string;
  gsdToolsPath: string;
  normCmd: string;
  normArgs: string[];
  ws?: string;
  pickField?: string;
}

function dottedCommandToCjsArgv(normCmd: string, normArgs: string[]): string[] {
  if (normCmd.includes('.')) return [...normCmd.split('.'), ...normArgs];
  return [normCmd, ...normArgs];
}

function execGsdToolsCjsQuery(
  projectDir: string,
  gsdToolsPath: string,
  normCmd: string,
  normArgs: string[],
  ws: string | undefined,
): Promise<{ stdout: string; stderr: string }> {
  const cjsArgv = dottedCommandToCjsArgv(normCmd, normArgs);
  const wsSuffix = ws ? ['--ws', ws] : [];
  const fullArgv = [gsdToolsPath, ...cjsArgv, ...wsSuffix];

  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      fullArgv,
      { cwd: projectDir, maxBuffer: 10 * 1024 * 1024, timeout: 30_000, killSignal: 'SIGKILL', env: { ...process.env } },
      (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
      },
    );
  });
}

async function parseCliQueryJsonOutput(raw: string, projectDir: string): Promise<unknown> {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  let jsonStr = trimmed;
  if (jsonStr.startsWith('@file:')) {
    const rel = jsonStr.slice(6).trim();
    const { resolvePathUnderProject } = await import('./helpers.js');
    const filePath = await resolvePathUnderProject(projectDir, rel);
    jsonStr = await readFile(filePath, 'utf-8');
  }
  return JSON.parse(jsonStr);
}

async function runCjsFallbackQuery(
  projectDir: string,
  gsdToolsPath: string,
  normCmd: string,
  normArgs: string[],
  ws: string | undefined,
): Promise<CjsFallbackQueryResult> {
  const { stdout, stderr } = await execGsdToolsCjsQuery(projectDir, gsdToolsPath, normCmd, normArgs, ws);

  try {
    const output = await parseCliQueryJsonOutput(stdout, projectDir);
    return { mode: 'json', output, stderr };
  } catch {
    return { mode: 'text', output: stdout, stderr };
  }
}

function formatFallbackOutput(data: unknown, mode: 'json' | 'text', pickField?: string): string | undefined {
  if (mode === 'text') {
    const text = String(data ?? '');
    if (!text.trim()) return undefined;
    return text.endsWith('\n') ? text : `${text}\n`;
  }
  let output: unknown = data;
  if (pickField) output = extractField(output, pickField);
  return `${JSON.stringify(output, null, 2)}\n`;
}

export async function runCjsFallbackDispatch(input: RunCjsFallbackDispatchInput): Promise<QueryDispatchResult> {
  const { projectDir, gsdToolsPath, normCmd, normArgs, ws, pickField } = input;
  const stderr = [
    `[gsd-sdk] '${normCmd}' not in native registry; falling back to gsd-tools.cjs.`,
    '[gsd-sdk] Transparent bridge — prefer adding a native handler when parity matters.',
  ];

  try {
    const fallback = await runCjsFallbackQuery(projectDir, gsdToolsPath, normCmd, normArgs, ws);
    if (fallback.stderr.trim()) stderr.push(fallback.stderr.trimEnd());
    return {
      ok: true,
      stderr,
      stdout: formatFallbackOutput(fallback.output, fallback.mode, pickField) ?? '',
      exit_code: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return toDispatchFailure(
      mapFallbackDispatchError(msg, normCmd, normArgs),
      stderr,
    );
  }
}
