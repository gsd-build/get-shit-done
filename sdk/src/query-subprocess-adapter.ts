import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { GSDToolsError } from './gsd-tools-error.js';

export interface QuerySubprocessAdapterDeps {
  projectDir: string;
  gsdToolsPath: string;
  timeoutMs: number;
  workstream?: string;
  createToolsError: (
    message: string,
    command: string,
    args: string[],
    exitCode: number | null,
    stderr: string,
  ) => GSDToolsError;
}

export class QuerySubprocessAdapter {
  constructor(private readonly deps: QuerySubprocessAdapterDeps) {}

  async execJson(command: string, args: string[]): Promise<unknown> {
    const wsArgs = this.deps.workstream ? ['--ws', this.deps.workstream] : [];
    const fullArgs = [this.deps.gsdToolsPath, command, ...args, ...wsArgs];

    return new Promise<unknown>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        fullArgs,
        {
          cwd: this.deps.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.deps.timeoutMs,
          env: { ...process.env },
        },
        async (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';

          if (error) {
            if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
              reject(
                this.deps.createToolsError(
                  `gsd-tools timed out after ${this.deps.timeoutMs}ms: ${command} ${args.join(' ')}`,
                  command,
                  args,
                  null,
                  stderrStr,
                ),
              );
              return;
            }

            reject(
              this.deps.createToolsError(
                `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
                command,
                args,
                typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
                stderrStr,
              ),
            );
            return;
          }

          const raw = stdout?.toString() ?? '';
          try {
            const parsed = await this.parseOutput(raw);
            resolve(parsed);
          } catch (parseErr) {
            reject(
              this.deps.createToolsError(
                `Failed to parse gsd-tools output for "${command}": ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw output: ${raw.slice(0, 500)}`,
                command,
                args,
                0,
                stderrStr,
              ),
            );
          }
        },
      );

      child.on('error', (err) => {
        reject(this.deps.createToolsError(`Failed to execute gsd-tools: ${err.message}`, command, args, null, ''));
      });
    });
  }

  async execRaw(command: string, args: string[]): Promise<string> {
    const wsArgs = this.deps.workstream ? ['--ws', this.deps.workstream] : [];
    const fullArgs = [this.deps.gsdToolsPath, command, ...args, ...wsArgs, '--raw'];

    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        fullArgs,
        {
          cwd: this.deps.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.deps.timeoutMs,
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';
          if (error) {
            if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
              reject(
                this.deps.createToolsError(
                  `gsd-tools timed out after ${this.deps.timeoutMs}ms: ${command} ${args.join(' ')}`,
                  command,
                  args,
                  null,
                  stderrStr,
                ),
              );
              return;
            }
            reject(
              this.deps.createToolsError(
                `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
                command,
                args,
                typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
                stderrStr,
              ),
            );
            return;
          }
          resolve((stdout?.toString() ?? '').trim());
        },
      );

      child.on('error', (err) => {
        reject(this.deps.createToolsError(`Failed to execute gsd-tools: ${err.message}`, command, args, null, ''));
      });
    });
  }

  private async parseOutput(raw: string): Promise<unknown> {
    const trimmed = raw.trim();

    if (trimmed === '') {
      return null;
    }

    let jsonStr = trimmed;
    if (jsonStr.startsWith('@file:')) {
      const filePath = jsonStr.slice(6).trim();
      try {
        jsonStr = await readFile(filePath, 'utf-8');
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to read gsd-tools @file: indirection at "${filePath}": ${reason}`);
      }
    }

    return JSON.parse(jsonStr);
  }
}
