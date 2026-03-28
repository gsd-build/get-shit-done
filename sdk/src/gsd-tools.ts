/**
 * GSD Tools Bridge — shells out to `gsd-tools.cjs` for state management.
 *
 * All `.planning/` state operations go through gsd-tools.cjs rather than
 * reimplementing 12K+ lines of logic.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { InitNewProjectInfo, PhaseOpInfo, PhasePlanIndex, RoadmapAnalysis } from './types.js';

// ─── Error type ──────────────────────────────────────────────────────────────

export class GSDToolsError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GSDToolsError';
  }
}

// ─── GSDTools class ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

export class GSDTools {
  private readonly projectDir: string;
  private readonly gsdToolsPath: string;
  private readonly timeoutMs: number;

  constructor(opts: {
    projectDir: string;
    gsdToolsPath?: string;
    timeoutMs?: number;
  }) {
    this.projectDir = opts.projectDir;
    this.gsdToolsPath =
      opts.gsdToolsPath ?? resolveGsdToolsPath(opts.projectDir);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // ─── Core exec ───────────────────────────────────────────────────────────

  /**
   * Execute a gsd-tools command and return parsed JSON output.
   * Handles the `@file:` prefix pattern for large results.
   */
  async exec(command: string, args: string[] = []): Promise<unknown> {
    const fullArgs = [this.gsdToolsPath, command, ...args];

    return new Promise<unknown>((resolve, reject) => {
      const child = execFile(
        'node',
        fullArgs,
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: this.timeoutMs,
          env: { ...process.env },
        },
        async (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';

          if (error) {
            // Distinguish timeout from other errors
            if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
              reject(
                new GSDToolsError(
                  `gsd-tools timed out after ${this.timeoutMs}ms: ${command} ${args.join(' ')}`,
                  command,
                  args,
                  null,
                  stderrStr,
                ),
              );
              return;
            }

            reject(
              new GSDToolsError(
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
              new GSDToolsError(
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

      // Safety net: kill if child doesn't respond to timeout signal
      child.on('error', (err) => {
        reject(
          new GSDToolsError(
            `Failed to execute gsd-tools: ${err.message}`,
            command,
            args,
            null,
            '',
          ),
        );
      });
    });
  }

  /**
   * Parse gsd-tools output, handling `@file:` prefix.
   */
  private async parseOutput(raw: string): Promise<unknown> {
    const trimmed = raw.trim();

    if (trimmed === '') {
      return null;
    }

    let jsonStr = trimmed;
    if (jsonStr.startsWith('@file:')) {
      const filePath = jsonStr.slice(6).trim();
      jsonStr = await readFile(filePath, 'utf-8');
    }

    return JSON.parse(jsonStr);
  }

  // ─── Raw exec (no JSON parsing) ───────────────────────────────────────

  /**
   * Execute a gsd-tools command and return raw stdout without JSON parsing.
   * Use for commands like `config-set` that return plain text, not JSON.
   */
  async execRaw(command: string, args: string[] = []): Promise<string> {
    const fullArgs = [this.gsdToolsPath, command, ...args, '--raw'];

    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        'node',
        fullArgs,
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.timeoutMs,
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';
          if (error) {
            reject(
              new GSDToolsError(
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
        reject(
          new GSDToolsError(
            `Failed to execute gsd-tools: ${err.message}`,
            command,
            args,
            null,
            '',
          ),
        );
      });
    });
  }

  // ─── Typed convenience methods ─────────────────────────────────────────

  async stateLoad(): Promise<string> {
    return this.execRaw('state', ['load']);
  }

  async roadmapAnalyze(): Promise<RoadmapAnalysis> {
    return this.exec('roadmap', ['analyze']) as Promise<RoadmapAnalysis>;
  }

  async phaseComplete(phase: string): Promise<string> {
    return this.execRaw('phase', ['complete', phase]);
  }

  async commit(message: string, files?: string[]): Promise<string> {
    const args = [message];
    if (files?.length) {
      args.push('--files', ...files);
    }
    return this.execRaw('commit', args);
  }

  async verifySummary(path: string): Promise<string> {
    return this.execRaw('verify-summary', [path]);
  }

  async initExecutePhase(phase: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phase]);
  }

  /**
   * Query phase state from gsd-tools.cjs `init phase-op`.
   * Returns a typed PhaseOpInfo describing what exists on disk for this phase.
   */
  async initPhaseOp(phaseNumber: string): Promise<PhaseOpInfo> {
    const result = await this.exec('init', ['phase-op', phaseNumber]);
    return result as PhaseOpInfo;
  }

  /**
   * Get a config value from gsd-tools.cjs.
   */
  async configGet(key: string): Promise<string | null> {
    const result = await this.exec('config', ['get', key]);
    return result as string | null;
  }

  /**
   * Begin phase state tracking in gsd-tools.cjs.
   */
  async stateBeginPhase(phaseNumber: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phaseNumber]);
  }

  /**
   * Get the plan index for a phase, grouping plans into dependency waves.
   * Returns typed PhasePlanIndex with wave assignments and completion status.
   */
  async phasePlanIndex(phaseNumber: string): Promise<PhasePlanIndex> {
    const result = await this.exec('phase-plan-index', [phaseNumber]);
    return result as PhasePlanIndex;
  }

  /**
   * Query new-project init state from gsd-tools.cjs `init new-project`.
   * Returns project metadata, model configs, brownfield detection, etc.
   */
  async initNewProject(): Promise<InitNewProjectInfo> {
    const result = await this.exec('init', ['new-project']);
    return result as InitNewProjectInfo;
  }

  /**
   * Set a config value via gsd-tools.cjs `config-set`.
   * Handles type coercion (booleans, numbers, JSON) on the gsd-tools side.
   * Note: config-set returns `key=value` text, not JSON, so we use execRaw.
   */
  async configSet(key: string, value: string): Promise<string> {
    return this.execRaw('config-set', [key, value]);
  }
}

// ─── Path resolution ────────────────────────────────────────────────────────

/**
 * Resolve gsd-tools.cjs path with repo-local fallback.
 * Probe order: repo-local → global home directory.
 */
export function resolveGsdToolsPath(projectDir: string): string {
  const localPath = join(projectDir, '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs');
  if (existsSync(localPath)) return localPath;
  return join(homedir(), '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs');
}
