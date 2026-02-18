/**
 * IPC client for the Telegram MCP adapter.
 *
 * Connects to the daemon's Unix socket and communicates using
 * newline-delimited JSON (NDJSON). Each method call generates a UUID request
 * ID and returns a Promise that resolves when the matching response arrives.
 *
 * Protocol:
 *   Request:  { "id": "uuid", "method": "register_session", "params": {...} }\n
 *   Response: { "id": "uuid", "result": {...} }\n
 *            or { "id": "uuid", "error": { "message": "..." } }\n
 */
import { EventEmitter } from 'events';
import type { IPCMethod } from '../shared/types.js';
/**
 * Unix socket IPC client with NDJSON protocol.
 *
 * Emits:
 *   'disconnected' — when the socket closes unexpectedly
 */
export declare class IPCClient extends EventEmitter {
    private readonly socketPath;
    private socket;
    private buffer;
    private pending;
    private connected;
    constructor(socketPath: string);
    /**
     * Connect to the daemon Unix socket.
     *
     * Resolves when the connection is established.
     * Rejects if the connection fails (e.g. ENOENT, ECONNREFUSED).
     */
    connect(): Promise<void>;
    /**
     * Send an IPC request and return a Promise that resolves with the result.
     *
     * @param method IPC method name
     * @param params Method-specific parameters
     * @param timeoutMs Optional timeout override in milliseconds
     */
    request(method: IPCMethod, params: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
    /**
     * Compute the appropriate timeout for a specific IPC method call.
     *
     * - ask_blocking_question: uses timeoutMinutes param + 60-second buffer
     * - check_question_answers: uses wait_seconds + 10 seconds when wait_seconds provided
     * - everything else: DEFAULT_TIMEOUT_MS
     */
    static methodTimeout(method: IPCMethod, params: Record<string, unknown>): number;
    private handleLine;
    /**
     * Gracefully close the socket connection.
     */
    disconnect(): Promise<void>;
    /**
     * Returns true if the socket is currently connected to the daemon.
     */
    isConnected(): boolean;
}
