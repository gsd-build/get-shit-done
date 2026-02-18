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
import { randomUUID } from 'crypto';
import path from 'path';
import { createLogger } from '../shared/logger.js';
const log = createLogger('daemon/session-service');
export class SessionService extends EventEmitter {
    /** All active sessions keyed by session ID */
    sessions = new Map();
    /** Per-project session counter for generating human-readable labels */
    sessionCounter = new Map();
    /** IPC clientId → session ID mapping for O(1) lookup by connection */
    clientToSession = new Map();
    // ─── Registration ───────────────────────────────────────────────────────────
    /**
     * Register a new session for the given IPC client.
     *
     * @param clientId UUID assigned by IPCServer to the connecting socket
     * @param projectRoot Optional path used to derive a human-readable label prefix
     * @returns The newly created Session object
     */
    register(clientId, projectRoot) {
        const id = randomUUID();
        // Derive a short project prefix from the project root basename
        const prefix = typeof projectRoot === 'string' && projectRoot.trim() !== ''
            ? path.basename(projectRoot).slice(0, 6)
            : 'claude';
        // Increment per-project counter to produce unique labels
        const count = (this.sessionCounter.get(prefix) ?? 0) + 1;
        this.sessionCounter.set(prefix, count);
        const label = `${prefix}/${count}`;
        const session = {
            id,
            label,
            status: 'idle',
            connectedAt: new Date().toISOString(),
        };
        this.sessions.set(id, session);
        this.clientToSession.set(clientId, id);
        log.info({ sessionId: id, clientId, label }, 'Session registered');
        this.emit('session:connected', session);
        return session;
    }
    /**
     * Remove a session by its session ID.
     *
     * @param sessionId The UUID of the session to remove
     * @returns The removed Session, or undefined if not found
     */
    unregister(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            log.warn({ sessionId }, 'Attempted to unregister unknown session');
            return undefined;
        }
        this.sessions.delete(sessionId);
        // Clean up the clientId → sessionId reverse mapping
        for (const [clientId, sid] of this.clientToSession) {
            if (sid === sessionId) {
                this.clientToSession.delete(clientId);
                break;
            }
        }
        log.info({ sessionId, label: session.label }, 'Session unregistered');
        this.emit('session:disconnected', session);
        return session;
    }
    // ─── Status updates ─────────────────────────────────────────────────────────
    /**
     * Update the status of an active session in-place.
     *
     * @param sessionId UUID of the session to update
     * @param status New status value
     * @param questionTitle Optional question title (only meaningful when status === 'waiting')
     * @returns The updated Session
     * @throws Error if the session is not found
     */
    updateStatus(sessionId, status, questionTitle) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        session.status = status;
        session.questionTitle =
            status === 'waiting' ? questionTitle : undefined;
        log.info({ sessionId, label: session.label, status }, 'Session status updated');
        return session;
    }
    // ─── Queries ────────────────────────────────────────────────────────────────
    /** Return a session by its UUID, or undefined if not found */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /** Return all active sessions as an array */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Look up a session by the IPC clientId of its underlying connection.
     *
     * @param clientId UUID assigned by IPCServer on socket connection
     * @returns The Session registered for that client, or undefined
     */
    getSessionByClientId(clientId) {
        const sessionId = this.clientToSession.get(clientId);
        return sessionId !== undefined ? this.sessions.get(sessionId) : undefined;
    }
}
