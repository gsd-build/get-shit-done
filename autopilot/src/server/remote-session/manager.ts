// RemoteSessionManager - Claude Code remote session integration
// Spawns `claude remote-control` as a child process for interactive access
// Manages session lifecycle: spawn, URL parsing, process cleanup

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface RemoteSessionManagerOptions {
  logger?: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
  onUrlDetected?: (url: string) => void;
}

/**
 * RemoteSessionManager spawns and manages a `claude remote-control` session.
 * Captures the session URL from stdout and manages process lifecycle with
 * graceful shutdown (SIGTERM -> 5s -> SIGKILL).
 */
export class RemoteSessionManager {
  private process: ChildProcess | null = null;
  private sessionUrl: string | null = null;
  private logger?: RemoteSessionManagerOptions['logger'];
  private onUrlDetected?: (url: string) => void;

  constructor(options: RemoteSessionManagerOptions = {}) {
    this.logger = options.logger;
    this.onUrlDetected = options.onUrlDetected;
  }

  /**
   * Start the remote session by spawning `claude remote-control`.
   * @param projectDir Working directory for the claude process
   * @returns Session URL once detected from stdout
   * @throws Error if process fails to start or URL not captured within 30s
   */
  async start(projectDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Spawn claude remote-control with shell on Windows for .cmd resolution
      // Strip CLAUDECODE env var so the child process doesn't refuse to start
      // (claude detects nested sessions via this env var and exits immediately)
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const proc = spawn('claude', ['remote-control'], {
        cwd: projectDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        env,
      });

      this.process = proc;
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.logger?.error('Remote session URL not detected within 30 seconds');
          reject(new Error('Timeout waiting for remote session URL'));
        }
      }, 30_000);
      timeout.unref(); // Don't block Node.js exit

      // Parse stdout line-by-line looking for session URL
      const rl = createInterface({ input: proc.stdout! });
      rl.on('line', (line: string) => {
        // Strip ANSI escape codes before matching (claude output uses terminal formatting)
        const clean = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
        // Match Claude Code session URL pattern (claude.ai/code/session_... not sessions/)
        const match = clean.match(/https:\/\/claude\.ai\/code\/session_[a-zA-Z0-9_-]+(?:\?[^\s]*)?/);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.sessionUrl = match[0];
          this.logger?.info(`Remote session URL detected: ${this.sessionUrl}`);
          this.onUrlDetected?.(this.sessionUrl);
          resolve(this.sessionUrl);

          // After URL is captured, monitor for unexpected process death
          proc.on('exit', (code, signal) => {
            if (code !== null && code !== 0) {
              this.logger?.warn(
                `Remote session process exited unexpectedly (code: ${code})`,
              );
            } else if (signal) {
              this.logger?.warn(
                `Remote session process killed by signal: ${signal}`,
              );
            }
          });
        }
      });

      // Handle stderr for debugging
      if (proc.stderr) {
        proc.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          // Log stderr but don't fail on it (Claude may print informational messages)
          this.logger?.info(`Remote session stderr: ${text.trim()}`);
        });
      }

      // Handle spawn errors (command not found, etc.)
      proc.on('error', (err: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Failed to spawn claude remote-control: ${err.message}`));
        }
      });

      // Handle early exit before URL is captured
      proc.on('exit', (code, signal) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const reason = signal ? `signal ${signal}` : `code ${code}`;
          reject(
            new Error(
              `Remote session process exited before URL was captured (${reason})`,
            ),
          );
        }
      });
    });
  }

  /**
   * Stop the remote session process gracefully.
   * Sends SIGTERM, waits up to 5 seconds, then sends SIGKILL if still running.
   * Safe to call multiple times.
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return; // Nothing to stop
    }

    const proc = this.process;
    this.process = null;
    this.sessionUrl = null;

    // Check if process is already dead
    if (proc.killed || proc.exitCode !== null) {
      return;
    }

    return new Promise((resolve) => {
      let forceKilled = false;

      // Set up 5-second timeout for graceful shutdown
      const killTimeout = setTimeout(() => {
        if (proc.exitCode === null && !proc.killed) {
          this.logger?.warn('Remote session did not exit gracefully, sending SIGKILL');
          proc.kill('SIGKILL');
          forceKilled = true;
        }
      }, 5000);

      // Wait for process to exit
      proc.on('exit', () => {
        clearTimeout(killTimeout);
        if (forceKilled) {
          this.logger?.info('Remote session process force-killed');
        } else {
          this.logger?.info('Remote session process stopped gracefully');
        }
        resolve();
      });

      // Send SIGTERM (on Windows, process.kill sends equivalent via taskkill)
      try {
        proc.kill('SIGTERM');
        this.logger?.info('Sent SIGTERM to remote session process');
      } catch (err) {
        // Process may have already exited
        clearTimeout(killTimeout);
        resolve();
      }
    });
  }

  /**
   * Get the current session URL, or null if not started/failed.
   */
  get url(): string | null {
    return this.sessionUrl;
  }
}
