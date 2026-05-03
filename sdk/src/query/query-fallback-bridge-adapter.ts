import { execFile } from 'node:child_process';
import { classifyFallbackOutput } from './query-fallback-output-classifier.js';

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
        const stdoutText = stdout?.toString() ?? '';
        const stderrText = stderr?.toString() ?? '';
        if (err) {
          if (stderrText.trim()) {
            reject(new Error(`${err.message}\n${stderrText.trimEnd()}`));
            return;
          }
          reject(err);
          return;
        }
        resolve({ stdout: stdoutText, stderr: stderrText });
      },
    );
  });
}

export async function runFallbackBridge(input: FallbackBridgeRunInput): Promise<FallbackBridgeOutput> {
  const { stdout, stderr } = await execBridge(input);
  const classified = await classifyFallbackOutput(stdout, input.projectDir);
  return { ...classified, stderr };
}
