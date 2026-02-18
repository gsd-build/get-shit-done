/**
 * Structured JSON logger for the Telegram MCP daemon architecture.
 *
 * Uses pino for structured logging. ALL output goes to stderr
 * (stdout is reserved for JSON-RPC in the adapter).
 *
 * Usage:
 *   const log = createLogger('daemon/bot-manager');
 *   log.info('Bot started');
 *   log.error('Connection failed', { err });
 *
 *   // Add session context with a child logger:
 *   const sessionLog = log.child({ sessionId: 'abc-123' });
 *   sessionLog.info('Session registered');
 *
 * Log level is controlled by the LOG_LEVEL environment variable.
 * Defaults to 'info' if not set.
 */
import pino from 'pino';
/**
 * Create a structured JSON logger bound to a component name.
 *
 * @param component Dot-separated component path, e.g. 'daemon/ipc-server'
 * @returns A pino logger instance. Call .child({ sessionId }) for session-scoped loggers.
 */
export declare function createLogger(component: string): pino.Logger;
