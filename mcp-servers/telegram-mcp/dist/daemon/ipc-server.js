/**
 * IPC server for the Telegram MCP daemon.
 *
 * Listens on a Unix socket and communicates with adapter instances using
 * newline-delimited JSON (NDJSON). Each line is one complete JSON object.
 *
 * Protocol:
 *   Request:  { "id": "uuid", "method": "register_session", "params": {...} }\n
 *   Response: { "id": "uuid", "result": {...} }\n
 *            or { "id": "uuid", "error": { "message": "..." } }\n
 */
import net from 'net';
import fs from 'fs';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { createLogger } from '../shared/logger.js';
const log = createLogger('daemon/ipc-server');
/**
 * Unix socket IPC server with newline-delimited JSON protocol.
 *
 * Emits:
 *   'client_disconnected' (clientId: string) — when a client drops the connection
 */
export class IPCServer extends EventEmitter {
    socketPath;
    handlers;
    server;
    /** Map of clientId → net.Socket for all connected clients */
    clients = new Map();
    constructor(socketPath, handlers) {
        super();
        this.socketPath = socketPath;
        this.handlers = handlers;
        this.server = net.createServer((socket) => this.handleConnection(socket));
        this.server.on('error', (err) => {
            log.error({ err }, 'IPC server error');
        });
    }
    // ─── Connection handling ────────────────────────────────────────────────────
    handleConnection(socket) {
        const clientId = randomUUID();
        this.clients.set(clientId, socket);
        log.info({ clientId }, 'Client connected');
        let buffer = '';
        socket.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            // Process all complete lines (NDJSON: one JSON object per line)
            const lines = buffer.split('\n');
            // Keep the last (potentially incomplete) fragment in the buffer
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed === '')
                    continue;
                void this.handleLine(trimmed, clientId, socket);
            }
        });
        socket.on('close', () => {
            this.clients.delete(clientId);
            log.info({ clientId }, 'Client disconnected');
            this.emit('client_disconnected', clientId);
        });
        socket.on('error', (err) => {
            log.warn({ clientId, err }, 'Client socket error');
            // 'close' will be emitted after 'error', so cleanup happens there
        });
    }
    async handleLine(line, clientId, socket) {
        let request;
        try {
            request = JSON.parse(line);
        }
        catch (err) {
            log.warn({ clientId, line }, 'Malformed JSON from client');
            // We can't correlate an error response without an id; send a generic error
            const errorResponse = {
                id: 'unknown',
                error: { message: 'Malformed JSON', code: 'PARSE_ERROR' },
            };
            this.sendResponse(socket, errorResponse);
            return;
        }
        const { id, method, params } = request;
        const handler = this.handlers.get(method);
        if (!handler) {
            log.warn({ clientId, method }, 'No handler registered for method');
            const errorResponse = {
                id,
                error: { message: `Unknown method: ${method}`, code: 'METHOD_NOT_FOUND' },
            };
            this.sendResponse(socket, errorResponse);
            return;
        }
        try {
            const result = await handler(params, clientId);
            const response = { id, result };
            this.sendResponse(socket, response);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.error({ clientId, method, err }, 'Handler threw an error');
            const errorResponse = {
                id,
                error: { message, code: 'HANDLER_ERROR' },
            };
            this.sendResponse(socket, errorResponse);
        }
    }
    sendResponse(socket, response) {
        if (socket.destroyed)
            return;
        try {
            socket.write(JSON.stringify(response) + '\n');
        }
        catch (err) {
            log.warn({ err }, 'Failed to write response to socket');
        }
    }
    // ─── Lifecycle ──────────────────────────────────────────────────────────────
    /**
     * Start listening on the Unix socket.
     *
     * Removes any stale socket file from a previous crashed process before binding.
     * Sets file permissions to 0o600 (owner-only) for security.
     */
    async listen() {
        // Remove stale socket file to recover from EADDRINUSE after a crash
        try {
            fs.unlinkSync(this.socketPath);
            log.debug({ socketPath: this.socketPath }, 'Removed stale socket file');
        }
        catch (err) {
            // ENOENT is expected on a clean start; anything else is unexpected but non-fatal
            if (err.code !== 'ENOENT') {
                log.warn({ err }, 'Unexpected error removing stale socket file');
            }
        }
        await new Promise((resolve, reject) => {
            this.server.listen(this.socketPath, () => {
                // Restrict access to the socket file to the owner only
                try {
                    fs.chmodSync(this.socketPath, 0o600);
                }
                catch (err) {
                    log.warn({ err }, 'Failed to set socket file permissions');
                }
                log.info({ socketPath: this.socketPath }, 'IPC server listening');
                resolve();
            });
            this.server.once('error', reject);
        });
    }
    /**
     * Gracefully close the server and all active client connections.
     * Removes the socket file from the filesystem.
     */
    close() {
        // Destroy all active client connections
        for (const [clientId, socket] of this.clients) {
            log.debug({ clientId }, 'Closing client connection');
            socket.destroy();
        }
        this.clients.clear();
        this.server.close(() => {
            log.info('IPC server closed');
        });
        // Remove socket file
        try {
            fs.unlinkSync(this.socketPath);
        }
        catch {
            // Ignore errors — file may already be gone
        }
    }
}
