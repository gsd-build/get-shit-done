/**
 * Shared type definitions for the Telegram MCP daemon architecture.
 *
 * Used by both the daemon process and the adapter (thin MCP stdio server).
 * Import from 'shared/types.js' to reference these types.
 */
/**
 * An active Claude Code terminal session registered with the daemon.
 */
export interface Session {
    /** UUID assigned by daemon on register */
    id: string;
    /** Human-readable label in "project-short/index" format, e.g. "gsd/1" or "claude-1" */
    label: string;
    /** Current session status (updated via update_session_status tool calls) */
    status: 'idle' | 'busy' | 'waiting';
    /** ISO timestamp when the session connected to the daemon */
    connectedAt: string;
    /** Title of the current pending question (populated when status === 'waiting') */
    questionTitle?: string;
}
/**
 * A blocking question sent from a Claude session to the user via Telegram.
 */
export interface Question {
    /** UUID */
    id: string;
    /** ID of the Session that asked this question */
    sessionId: string;
    /** Short title shown in Telegram thread name */
    title: string;
    /** Full question body displayed inside the thread */
    body: string;
    /** Optional execution context appended to the body */
    context?: string;
    /** Telegram forum topic ID (set after thread creation) */
    threadId?: number;
    /** User's answer text (set after reply received) */
    answer?: string;
    /** ISO timestamp when the answer was recorded */
    answeredAt?: string;
    /** ISO timestamp when the question was created */
    createdAt: string;
    /** Maximum wait time in minutes before the question times out */
    timeoutMinutes: number;
}
/**
 * A request sent from the adapter (MCP stdio server) to the daemon
 * over the Unix socket connection.
 *
 * Protocol: newline-delimited JSON (one JSON object per line).
 * Each request has a unique id; responses carry the same id for correlation.
 */
export interface IPCRequest {
    /** UUID used to correlate this request with its response */
    id: string;
    /** Method name from the IPCMethod union type */
    method: IPCMethod;
    /** Method-specific parameters */
    params: Record<string, unknown>;
}
/**
 * A response sent from the daemon to the adapter over the Unix socket.
 */
export interface IPCResponse {
    /** Matches the id of the corresponding IPCRequest */
    id: string;
    /** Successful result payload (method-specific shape) */
    result?: unknown;
    /** Error payload (present when the method call failed) */
    error?: {
        message: string;
        /** Optional machine-readable error code */
        code?: string;
    };
}
/**
 * All supported IPC method names.
 *
 * register_session     — adapter calls on startup to join the daemon's session registry
 * unregister_session   — adapter calls on shutdown to leave the session registry
 * update_session_status — adapter calls to push idle/busy/waiting status to daemon
 * ask_blocking_question — adapter calls when Claude invokes the ask tool
 * check_question_answers — adapter calls to long-poll for user answers
 * mark_question_answered — adapter calls to explicitly close a question
 * send_message         — adapter calls to push a plain Telegram message
 * send_status_update   — adapter calls to push a formatted status notification
 */
export type IPCMethod = 'register_session' | 'unregister_session' | 'update_session_status' | 'ask_blocking_question' | 'check_question_answers' | 'mark_question_answered' | 'send_message' | 'send_status_update';
