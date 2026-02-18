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
import { EventEmitter } from 'events';
import type { IPCMethod } from '../shared/types.js';
/** Handler function type for a single IPC method */
export type MethodHandler = (params: Record<string, unknown>, clientId: string) => Promise<unknown>;
/**
 * Unix socket IPC server with newline-delimited JSON protocol.
 *
 * Emits:
 *   'client_disconnected' (clientId: string) — when a client drops the connection
 */
export declare class IPCServer extends EventEmitter {
    private readonly socketPath;
    private readonly handlers;
    private server;
    /** Map of clientId → net.Socket for all connected clients */
    private clients;
    constructor(socketPath: string, handlers: Map<IPCMethod, MethodHandler>);
    private handleConnection;
    private handleLine;
    private sendResponse;
    /**
     * Start listening on the Unix socket.
     *
     * Removes any stale socket file from a previous crashed process before binding.
     * Sets file permissions to 0o600 (owner-only) for security.
     */
    listen(): Promise<void>;
    /**
     * Gracefully close the server and all active client connections.
     * Removes the socket file from the filesystem.
     */
    close(): void;
}
