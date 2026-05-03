import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export interface FallbackBridgeRunInput {
  projectDir: string;
  gsdToolsPath: string;
  normCmd: string;
  normArgs: string[];
  ws?: string;
}

export interface FallbackBridgeOutput {
  mode: 'json' | 'text';
  output: unknown;
  stderr: string;
}

function dottedCommandToCjsArgv(normCmd: string, normArgs: string[]): string[] {
  if (normCmd.includes('.')) return [...normCmd.split('.'), ...normArgs];
  return [normCmd, ...normArgs];
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

function execBridge(input: FallbackBridgeRunInput): Promise<{ stdout: string; stderr: string }> {
  const cjsArgv = dottedCommandToCjsArgv(input.normCmd, input.normArgs);
  const wsSuffix = input.ws ? ['--ws', input.ws] : [];
  const fullArgv = [input.gsdToolsPath, ...cjsArgv, ...wsSuffix];

  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      fullArgv,
      { cwd: input.projectDir, maxBuffer: 10 * 1024 * 1024, timeout: 30_000, killSignal: 'SIGKILL', env: { ...process.env } },
      (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
      },
    );
  });
}

export async function runFallbackBridge(input: FallbackBridgeRunInput): Promise<FallbackBridgeOutput> {
  const { stdout, stderr } = await execBridge(input);
  try {
    const output = await parseCliQueryJsonOutput(stdout, input.projectDir);
    return { mode: 'json', output, stderr };
  } catch {
    return { mode: 'text', output: stdout, stderr };
  }
}
