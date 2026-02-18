/**
 * In-memory session registry for the Telegram MCP daemon.
 *
 * Tracks all active Claude Code adapter sessions, emits lifecycle events, and
 * provides status update utilities. The registry is intentionally in-memory
 * (not persisted) — sessions are ephemeral for the lifetime of a daemon run.
 *
 * Events emitted:
 *   'session:connected'    (session: Session) — when a new session is registered
 *   'session:disconnected' (session: Session) — when a session is unregistered
 */
import { EventEmitter } from 'events';
import type { Session } from '../shared/types.js';
export declare class SessionService extends EventEmitter {
    /** All active sessions keyed by session ID */
    private sessions;
    /** Per-project session counter for generating human-readable labels */
    private sessionCounter;
    /** IPC clientId → session ID mapping for O(1) lookup by connection */
    private clientToSession;
    /**
     * Register a new session for the given IPC client.
     *
     * @param clientId UUID assigned by IPCServer to the connecting socket
     * @param projectRoot Optional path used to derive a human-readable label prefix
     * @returns The newly created Session object
     */
    register(clientId: string, projectRoot?: string): Session;
    /**
     * Remove a session by its session ID.
     *
     * @param sessionId The UUID of the session to remove
     * @returns The removed Session, or undefined if not found
     */
    unregister(sessionId: string): Session | undefined;
    /**
     * Update the status of an active session in-place.
     *
     * @param sessionId UUID of the session to update
     * @param status New status value
     * @param questionTitle Optional question title (only meaningful when status === 'waiting')
     * @returns The updated Session
     * @throws Error if the session is not found
     */
    updateStatus(sessionId: string, status: Session['status'], questionTitle?: string): Session;
    /** Return a session by its UUID, or undefined if not found */
    getSession(sessionId: string): Session | undefined;
    /** Return all active sessions as an array */
    getAllSessions(): Session[];
    /**
     * Look up a session by the IPC clientId of its underlying connection.
     *
     * @param clientId UUID assigned by IPCServer on socket connection
     * @returns The Session registered for that client, or undefined
     */
    getSessionByClientId(clientId: string): Session | undefined;
}
