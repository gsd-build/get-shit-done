/**
 * Project-scoped Unix socket path computation.
 *
 * Each project gets its own socket file in /tmp/ based on a short hash of the
 * project root path. This prevents collision when multiple GSD projects are
 * open simultaneously on the same machine.
 *
 * Socket path format: /tmp/telegram-mcp-{HASH}.sock
 * where HASH = first 8 hex characters of SHA-1(projectRoot)
 *
 * Usage:
 *   import { getSocketPath } from './shared/socket-path.js';
 *   const socketPath = getSocketPath(); // uses PROJECT_ROOT env or process.cwd()
 *   const socketPath = getSocketPath('/path/to/project'); // explicit root
 */
/**
 * Compute the Unix socket path for the Telegram MCP daemon.
 *
 * @param projectRoot Optional explicit project root path.
 *   If omitted, falls back to process.env.PROJECT_ROOT, then process.cwd().
 * @returns Absolute path to the socket file, e.g. '/tmp/telegram-mcp-a1b2c3d4.sock'
 */
export declare function getSocketPath(projectRoot?: string): string;
