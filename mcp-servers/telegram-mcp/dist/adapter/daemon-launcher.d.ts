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
/**
 * Check if the daemon is currently running and accepting connections.
 *
 * Attempts to connect to the socket and send a ping-style request.
 * Returns true if successful, false if connection refused or timeout.
 *
 * @param socketPath Unix socket path to try
 */
export declare function isDaemonRunning(socketPath: string): Promise<boolean>;
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
export declare function launchDaemon(socketPath: string): Promise<void>;
/**
 * Ensure the daemon is running. If it is already running, return immediately.
 * If it is not running, spawn it and wait for it to become ready.
 *
 * @param socketPath Unix socket path the daemon should be listening on
 */
export declare function ensureDaemon(socketPath: string): Promise<void>;
