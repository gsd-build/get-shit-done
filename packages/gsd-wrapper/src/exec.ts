/**
 * Shared subprocess execution utility for GSD CLI commands
 */

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import type { GsdError, GsdResult } from './types.js';

// Resolve path to gsd-tools.cjs relative to package location
// When compiled: packages/gsd-wrapper/dist/exec.js
// Need to go: dist -> gsd-wrapper -> packages -> (root) -> get-shit-done/bin
// 3 levels: dist(1) -> gsd-wrapper(2) -> packages(3) = repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GSD_TOOLS_PATH = join(__dirname, '..', '..', '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

/**
 * Execute a gsd-tools command and parse JSON output
 *
 * Uses shell redirect to temp file to avoid Node.js process.exit() stdout
 * buffering issues when gsd-tools calls process.exit(0) immediately after
 * process.stdout.write().
 *
 * @param args - Command arguments to pass to gsd-tools
 * @param cwd - Working directory for the command
 * @returns Promise with typed result or error
 */
export async function execGsdTools<T>(
  args: string[],
  cwd: string
): Promise<GsdResult<T>> {
  const tmpFile = join(tmpdir(), `gsd-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

  try {
    // Use shell redirect to temp file to ensure complete output capture
    // This avoids Node.js buffering issues with process.exit() in gsd-tools
    const cmd = `node "${GSD_TOOLS_PATH}" ${args.map(a => `"${a}"`).join(' ')} > "${tmpFile}" 2>&1`;

    try {
      execSync(cmd, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        shell: '/bin/sh',
      });
    } catch (execError) {
      // execSync throws on non-zero exit code
      // Read the temp file for error output
      let errorOutput = '';
      if (existsSync(tmpFile)) {
        errorOutput = readFileSync(tmpFile, 'utf-8');
        unlinkSync(tmpFile);
      }

      return {
        success: false,
        error: {
          code: 'GSD_COMMAND_FAILED',
          message: `gsd-tools ${args[0]} failed`,
          command: `gsd-tools ${args.join(' ')}`,
          stderr: errorOutput.substring(0, 500) || (execError as Error).message,
        },
      };
    }

    // Read the output from temp file
    if (!existsSync(tmpFile)) {
      return {
        success: false,
        error: {
          code: 'GSD_NO_OUTPUT',
          message: 'gsd-tools produced no output',
          command: `gsd-tools ${args.join(' ')}`,
        },
      };
    }

    const stdout = readFileSync(tmpFile, 'utf-8');
    unlinkSync(tmpFile);

    // Handle @file: prefix for large outputs
    if (stdout.startsWith('@file:')) {
      const filePath = stdout.slice(6).trim();
      if (existsSync(filePath)) {
        const fileContent = readFileSync(filePath, 'utf-8');
        unlinkSync(filePath);
        const data = JSON.parse(fileContent) as T;
        return { success: true, data };
      }
    }

    try {
      const data = JSON.parse(stdout) as T;
      return { success: true, data };
    } catch {
      return {
        success: false,
        error: {
          code: 'GSD_PARSE_ERROR',
          message: 'Failed to parse gsd-tools JSON output',
          command: `gsd-tools ${args.join(' ')}`,
          stderr: stdout.substring(0, 200),
        },
      };
    }
  } catch (err) {
    // Clean up temp file on any error
    if (existsSync(tmpFile)) {
      try {
        unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: {
        code: 'GSD_EXEC_ERROR',
        message: (err as Error).message,
        command: `gsd-tools ${args.join(' ')}`,
      },
    };
  }
}
