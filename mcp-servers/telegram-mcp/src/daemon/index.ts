/**
 * Telegram MCP Daemon entry point.
 *
 * The daemon is the central coordination hub. It:
 *   1. Starts an IPC server on a project-scoped Unix socket
 *   2. Accepts connections from MCP adapter instances (one per Claude Code terminal)
 *   3. Maintains an in-memory registry of active sessions via SessionService
 *   4. Routes IPC method calls to the appropriate service handlers
 *
 * Lifecycle:
 *   - Started by the adapter (Plan 05) with child_process.spawn + detached + unref()
 *   - Can also be started directly: node dist/daemon/index.js
 *   - Handles SIGINT / SIGTERM for graceful shutdown
 *
 * Stubs: ask_blocking_question, check_question_answers, mark_question_answered,
 *        send_message, send_status_update are implemented in Plan 04.
 */

import { IPCServer, type MethodHandler } from './ipc-server.js';
import { SessionService } from './session-service.js';
import { getSocketPath } from '../shared/socket-path.js';
import { createLogger } from '../shared/logger.js';
import type { IPCMethod } from '../shared/types.js';

const log = createLogger('daemon/index');

async function main(): Promise<void> {
  const socketPath = getSocketPath();
  const sessionService = new SessionService();

  // ─── Session service event logging ────────────────────────────────────────
  // Bot notification will be wired here in Plan 03.

  sessionService.on('session:connected', (session) => {
    log.info({ sessionId: session.id, label: session.label }, 'Session connected (bot notification pending Plan 03)');
  });

  sessionService.on('session:disconnected', (session) => {
    log.info({ sessionId: session.id, label: session.label }, 'Session disconnected (bot notification pending Plan 03)');
  });

  // ─── IPC method handler map ────────────────────────────────────────────────

  const handlers = new Map<IPCMethod, MethodHandler>();

  // Session lifecycle
  handlers.set('register_session', async (params, clientId) => {
    const projectRoot =
      typeof params['projectRoot'] === 'string' ? params['projectRoot'] : undefined;
    const session = sessionService.register(clientId, projectRoot);
    return { sessionId: session.id, label: session.label };
  });

  handlers.set('unregister_session', async (params) => {
    const sessionId = params['sessionId'] as string;
    const removed = sessionService.unregister(sessionId);
    return { removed: removed !== undefined };
  });

  handlers.set('update_session_status', async (params) => {
    const sessionId = params['sessionId'] as string;
    const status = params['status'] as 'idle' | 'busy' | 'waiting';
    const questionTitle =
      typeof params['questionTitle'] === 'string'
        ? params['questionTitle']
        : undefined;
    const updated = sessionService.updateStatus(sessionId, status, questionTitle);
    return { sessionId: updated.id, status: updated.status };
  });

  // ─── Plan 04 stubs ────────────────────────────────────────────────────────
  // These will be replaced with full implementations in Plan 04.

  handlers.set('ask_blocking_question', async (_params, _clientId) => {
    return { status: 'not_implemented' };
  });

  handlers.set('check_question_answers', async (_params, _clientId) => {
    return { status: 'not_implemented' };
  });

  handlers.set('mark_question_answered', async (_params, _clientId) => {
    return { status: 'not_implemented' };
  });

  handlers.set('send_message', async (_params, _clientId) => {
    return { status: 'not_implemented' };
  });

  handlers.set('send_status_update', async (_params, _clientId) => {
    return { status: 'not_implemented' };
  });

  // ─── IPC server ────────────────────────────────────────────────────────────

  const ipcServer = new IPCServer(socketPath, handlers);

  // Auto-unregister session when the IPC client drops the connection
  ipcServer.on('client_disconnected', (clientId: string) => {
    const session = sessionService.getSessionByClientId(clientId);
    if (session) {
      log.info({ clientId, sessionId: session.id }, 'Auto-unregistering session on client disconnect');
      sessionService.unregister(session.id);
    }
  });

  await ipcServer.listen();
  log.info({ socketPath }, 'Daemon started, listening on Unix socket');

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  const shutdown = (signal: string): void => {
    log.info({ signal }, 'Shutdown signal received — closing daemon');
    ipcServer.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // Use console.error as a last resort if pino logger itself fails
  console.error('Daemon startup failed:', err);
  process.exit(1);
});
