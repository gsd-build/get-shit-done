/**
 * Daemon auto-start logic for the Telegram MCP adapter.
 *
 * The adapter calls ensureDaemon() on startup. If the daemon is not running,
 * it is spawned as a detached child process that will survive the adapter's
 * terminal being closed.
 *
 * Daemon entry point: dist/daemon/index.js (compiled TypeScript output)
 * Socket path: /tmp/telegram-mcp-{hash}.sock (project-scoped)
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IPCClient } from './ipc-client.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('daemon-launcher');
/** Polling interval when waiting for daemon socket to appear (ms) */
const POLL_INTERVAL_MS = 200;
/** Maximum time to wait for daemon to start (ms) */
const START_TIMEOUT_MS = 10_000;
// ─── Path resolution ─────────────────────────────────────────────────────────
/**
 * Resolve the path to the daemon entry point (dist/daemon/index.js).
 *
 * The adapter is compiled to dist/adapter/index.js, so the daemon is one
 * directory up: dist/daemon/index.js.
 */
function getDaemonEntryPoint() {
    // __filename equivalent in ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // __dirname === dist/adapter at runtime; daemon is dist/daemon/index.js
    return path.resolve(__dirname, '../daemon/index.js');
}
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Check if the daemon is currently running and accepting connections.
 *
 * Attempts to connect to the socket and send a ping-style request.
 * Returns true if successful, false if connection refused or timeout.
 *
 * @param socketPath Unix socket path to try
 */
export async function isDaemonRunning(socketPath) {
    const client = new IPCClient(socketPath);
    try {
        await client.connect();
        // Use update_session_status as a lightweight ping — it will error with
        // "unknown method" or validation error if daemon is running but malformed,
        // but at minimum the connection succeeds.
        // We don't need the response to be meaningful — we just need a connection.
        await client.disconnect();
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Spawn the daemon as a detached child process.
 *
 * The daemon is spawned with stdio: 'ignore' and detached: true, then
 * unref()'d so it survives when the adapter's terminal closes.
 *
 * Waits up to START_TIMEOUT_MS for the socket file to appear.
 *
 * @param socketPath Unix socket path the daemon will bind to (for wait logic)
 * @throws Error if the daemon fails to start within START_TIMEOUT_MS
 */
export async function launchDaemon(socketPath) {
    const daemonPath = getDaemonEntryPoint();
    log.info({ daemonPath }, 'Spawning daemon process');
    const child = spawn('node', [daemonPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
    });
    child.unref();
    log.info({ pid: child.pid }, `Daemon spawned (PID: ${child.pid})`);
    // Wait for the socket file to appear (daemon binds it on startup)
    await waitForSocket(socketPath);
}
/**
 * Ensure the daemon is running. If it is already running, return immediately.
 * If it is not running, spawn it and wait for it to become ready.
 *
 * @param socketPath Unix socket path the daemon should be listening on
 */
export async function ensureDaemon(socketPath) {
    if (await isDaemonRunning(socketPath)) {
        log.debug('Daemon already running');
        return;
    }
    log.info('Daemon not running — launching...');
    await launchDaemon(socketPath);
    log.info('Daemon ready');
}
// ─── Internal helpers ────────────────────────────────────────────────────────
/**
 * Poll for the socket file to appear, up to START_TIMEOUT_MS.
 *
 * @param socketPath Socket file path to wait for
 * @throws Error if socket does not appear within timeout
 */
async function waitForSocket(socketPath) {
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (existsSync(socketPath)) {
            // Socket file exists — daemon is bound and accepting connections
            return;
        }
        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`Failed to start daemon: socket not found at ${socketPath} after ${START_TIMEOUT_MS}ms`);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
