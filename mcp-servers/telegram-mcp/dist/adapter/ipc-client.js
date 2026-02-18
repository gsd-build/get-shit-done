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
import net from 'net';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { createLogger } from '../shared/logger.js';
const log = createLogger('ipc-client');
/** Default timeout for most IPC methods (milliseconds) */
const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * Unix socket IPC client with NDJSON protocol.
 *
 * Emits:
 *   'disconnected' — when the socket closes unexpectedly
 */
export class IPCClient extends EventEmitter {
    socketPath;
    socket = null;
    buffer = '';
    pending = new Map();
    connected = false;
    constructor(socketPath) {
        super();
        this.socketPath = socketPath;
    }
    // ─── Connection ─────────────────────────────────────────────────────────────
    /**
     * Connect to the daemon Unix socket.
     *
     * Resolves when the connection is established.
     * Rejects if the connection fails (e.g. ENOENT, ECONNREFUSED).
     */
    async connect() {
        return new Promise((resolve, reject) => {
            const socket = net.connect(this.socketPath);
            socket.once('connect', () => {
                this.socket = socket;
                this.connected = true;
                log.info({ socketPath: this.socketPath }, 'Connected to daemon');
                resolve();
            });
            socket.once('error', (err) => {
                if (!this.connected) {
                    // Connection failed before 'connect' fired
                    reject(new Error(`IPC connect failed: ${err.message}`));
                }
                else {
                    log.warn({ err }, 'IPC socket error after connect');
                }
            });
            socket.on('data', (chunk) => {
                this.buffer += chunk.toString('utf8');
                // Process all complete lines (NDJSON: one JSON object per line)
                const lines = this.buffer.split('\n');
                // Keep the last (potentially incomplete) fragment in the buffer
                this.buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === '')
                        continue;
                    this.handleLine(trimmed);
                }
            });
            socket.on('close', () => {
                this.connected = false;
                log.info('Disconnected from daemon');
                // Reject all pending requests — daemon went away
                for (const [id, pending] of this.pending) {
                    clearTimeout(pending.timer);
                    pending.reject(new Error('IPC connection closed while request was pending'));
                    this.pending.delete(id);
                }
                this.emit('disconnected');
            });
        });
    }
    // ─── Request/response ───────────────────────────────────────────────────────
    /**
     * Send an IPC request and return a Promise that resolves with the result.
     *
     * @param method IPC method name
     * @param params Method-specific parameters
     * @param timeoutMs Optional timeout override in milliseconds
     */
    async request(method, params, timeoutMs) {
        if (!this.socket || !this.connected) {
            throw new Error('IPC client is not connected');
        }
        const id = randomUUID();
        const ipcRequest = { id, method, params };
        const effectiveTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`IPC request timed out after ${effectiveTimeout}ms (method: ${method})`));
            }, effectiveTimeout);
            this.pending.set(id, { resolve, reject, timer });
            try {
                this.socket.write(JSON.stringify(ipcRequest) + '\n');
            }
            catch (err) {
                clearTimeout(timer);
                this.pending.delete(id);
                const message = err instanceof Error ? err.message : String(err);
                reject(new Error(`Failed to write IPC request: ${message}`));
            }
        });
    }
    /**
     * Compute the appropriate timeout for a specific IPC method call.
     *
     * - ask_blocking_question: uses timeoutMinutes param + 60-second buffer
     * - check_question_answers: uses wait_seconds + 10 seconds when wait_seconds provided
     * - everything else: DEFAULT_TIMEOUT_MS
     */
    static methodTimeout(method, params) {
        if (method === 'ask_blocking_question') {
            const timeoutMinutes = typeof params['timeout_minutes'] === 'number'
                ? params['timeout_minutes']
                : 30;
            return (timeoutMinutes * 60 + 60) * 1000;
        }
        if (method === 'check_question_answers') {
            const waitSeconds = typeof params['wait_seconds'] === 'number' ? params['wait_seconds'] : undefined;
            if (waitSeconds !== undefined) {
                return (waitSeconds + 10) * 1000;
            }
        }
        return DEFAULT_TIMEOUT_MS;
    }
    // ─── Internal ───────────────────────────────────────────────────────────────
    handleLine(line) {
        let response;
        try {
            response = JSON.parse(line);
        }
        catch (err) {
            log.warn({ line }, 'Received malformed JSON from daemon');
            return;
        }
        const pending = this.pending.get(response.id);
        if (!pending) {
            log.warn({ id: response.id }, 'Received response for unknown request ID');
            return;
        }
        clearTimeout(pending.timer);
        this.pending.delete(response.id);
        if (response.error) {
            const errMsg = response.error.message ?? 'IPC error';
            const errCode = response.error.code ? ` (${response.error.code})` : '';
            pending.reject(new Error(`${errMsg}${errCode}`));
        }
        else {
            pending.resolve(response.result);
        }
    }
    // ─── Lifecycle ───────────────────────────────────────────────────────────────
    /**
     * Gracefully close the socket connection.
     */
    async disconnect() {
        if (!this.socket)
            return;
        return new Promise((resolve) => {
            this.socket.once('close', resolve);
            this.socket.end();
        });
    }
    /**
     * Returns true if the socket is currently connected to the daemon.
     */
    isConnected() {
        return this.connected;
    }
}
