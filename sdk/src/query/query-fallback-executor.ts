import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export interface CjsFallbackQueryResult {
  mode: 'json' | 'text';
  output: unknown;
  stderr: string;
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
      { cwd: projectDir, maxBuffer: 10 * 1024 * 1024, env: { ...process.env } },
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

export async function runCjsFallbackQuery(
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
