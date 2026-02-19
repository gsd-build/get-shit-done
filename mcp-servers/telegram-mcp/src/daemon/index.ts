/**
 * Telegram MCP Daemon entry point.
 *
 * The daemon is the central coordination hub. It:
 *   1. Starts an IPC server on a project-scoped Unix socket
 *   2. Accepts connections from MCP adapter instances (one per Claude Code terminal)
 *   3. Maintains an in-memory registry of active sessions via SessionService
 *   4. Manages the full question lifecycle via QuestionService
 *   5. Routes IPC method calls to the appropriate service handlers
 *
 * Lifecycle:
 *   - Started by the adapter (Plan 05) with child_process.spawn + detached + unref()
 *   - Can also be started directly: node dist/daemon/index.js
 *   - Handles SIGINT / SIGTERM for graceful shutdown
 */

import { IPCServer, type MethodHandler } from './ipc-server.js';
import { SessionService } from './session-service.js';
import { QuestionService } from './question-service.js';
import { getSocketPath } from '../shared/socket-path.js';
import { createLogger } from '../shared/logger.js';
import type { IPCMethod } from '../shared/types.js';
import {
  initializeBot,
  startBot,
  stopBot,
  createForumTopic,
  sendToThread,
  sendToGroup,
} from './bot/index.js';
import { handlerEvents } from './bot/handlers.js';

const log = createLogger('daemon/index');

async function main(): Promise<void> {
  const socketPath = getSocketPath();
  const sessionService = new SessionService();

  // ─── Bot startup ───────────────────────────────────────────────────────────
  // initializeBot() creates the Telegraf instance lazily.
  // QuestionService is constructed after bot, so we define getQuestions first.
  // startBot() receives the real getQuestions callback from QuestionService.

  let questionService: QuestionService | null = null;

  if (process.env.TELEGRAM_BOT_TOKEN) {
    initializeBot();

    // Create QuestionService with bot functions and session service
    questionService = new QuestionService(
      createForumTopic,
      sendToThread,
      sendToGroup,
      sessionService
    );

    // Start bot — pass real getQuestions callback from question service
    await startBot(sessionService, () => questionService!.getPendingQuestions());

    // ─── Wire bot events to question service ─────────────────────────────

    handlerEvents.on('thread:text_reply', ({ threadId, text }: { threadId: number; text: string }) => {
      const delivered = questionService!.deliverAnswer(threadId, text);
      if (delivered) {
        log.info({ threadId }, 'Text reply delivered to pending question');
      } else {
        log.debug({ threadId }, 'Text reply in thread with no pending question — ignored');
      }
    });

    handlerEvents.on('thread:voice_reply', ({ threadId, text }: { threadId: number; text: string }) => {
      const delivered = questionService!.deliverAnswer(threadId, text);
      if (delivered) {
        log.info({ threadId }, 'Voice reply delivered to pending question');
      } else {
        log.debug({ threadId }, 'Voice reply in thread with no pending question — ignored');
      }
    });
  } else {
    log.warn('TELEGRAM_BOT_TOKEN not set — bot and question service will not start');
  }

  // ─── IPC method handler map ────────────────────────────────────────────────

  const handlers = new Map<IPCMethod, MethodHandler>();

  // ─── Session lifecycle ────────────────────────────────────────────────────

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

  // ─── Question service handlers ────────────────────────────────────────────

  handlers.set('ask_blocking_question', async (params, _clientId) => {
    if (!questionService) {
      throw new Error('Question service not available — TELEGRAM_BOT_TOKEN not set');
    }

    const sessionId = params['sessionId'] as string;
    const question = params['question'] as string;
    const context =
      typeof params['context'] === 'string' ? params['context'] : undefined;
    const timeoutMinutes =
      typeof params['timeout_minutes'] === 'number'
        ? params['timeout_minutes']
        : undefined;

    // This call blocks until the user replies or the timeout expires
    const answer = await questionService.ask(sessionId, question, context, timeoutMinutes);
    return { answer };
  });

  handlers.set('check_question_answers', async (params, _clientId) => {
    if (!questionService) {
      throw new Error('Question service not available — TELEGRAM_BOT_TOKEN not set');
    }

    const questionIds =
      Array.isArray(params['question_ids']) ? (params['question_ids'] as string[]) : undefined;

    const waitSeconds =
      typeof params['wait_seconds'] === 'number' ? params['wait_seconds'] : 0;

    // If wait_seconds is requested, wait up to that duration for any answer event
    if (waitSeconds > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, waitSeconds * 1000);
        // Listen for any answer event once, then resolve early
        const onAny = (): void => {
          clearTimeout(timer);
          resolve();
        };
        questionService!.once('answer:*', onAny);
        // EventEmitter doesn't support glob listeners, so use a one-shot cleanup
        setTimeout(() => {
          questionService!.removeListener('answer:*', onAny);
        }, waitSeconds * 1000 + 100);
      });
    }

    let pending = questionService.getPendingQuestions();

    // Filter by specific question IDs if requested
    if (questionIds && questionIds.length > 0) {
      const idSet = new Set(questionIds);
      pending = pending.filter((q) => idSet.has(q.id));
    }

    return { questions: pending };
  });

  handlers.set('mark_question_answered', async (params, _clientId) => {
    if (!questionService) {
      throw new Error('Question service not available — TELEGRAM_BOT_TOKEN not set');
    }

    const questionId = params['question_id'] as string;
    const answerText =
      typeof params['answer'] === 'string' ? params['answer'] : '[Manually marked as answered]';

    // Look up question by thread — try direct ID lookup via getPendingQuestions
    const pending = questionService.getPendingQuestions();
    const question = pending.find((q) => q.id === questionId);

    if (!question) {
      return { error: `Question ${questionId} not found or already answered` };
    }

    if (question.threadId !== undefined) {
      // Deliver via normal channel — triggers the waiting ask() promise
      const delivered = questionService.deliverAnswer(question.threadId, answerText);
      return { delivered };
    } else {
      // No thread — emit answer event directly
      questionService.emit(`answer:${questionId}`, answerText);
      return { delivered: true };
    }
  });

  handlers.set('send_message', async (params, _clientId) => {
    if (!questionService) {
      throw new Error('Bot not available — TELEGRAM_BOT_TOKEN not set');
    }
    const text = params['text'] as string;
    const threadId =
      typeof params['threadId'] === 'number' ? params['threadId'] : undefined;

    if (threadId !== undefined) {
      await sendToThread(threadId, text);
      return { sent: true, mode: 'thread', threadId };
    } else {
      await sendToGroup(text);
      return { sent: true, mode: 'group' };
    }
  });

  handlers.set('send_status_update', async (params, _clientId) => {
    if (!questionService) {
      throw new Error('Bot not available — TELEGRAM_BOT_TOKEN not set');
    }
    const message =
      typeof params['message'] === 'string'
        ? params['message']
        : '';
    const sessionId =
      typeof params['sessionId'] === 'string'
        ? params['sessionId']
        : undefined;
    const status =
      typeof params['status'] === 'string'
        ? params['status']
        : '';

    // Format a structured status update
    let formatted = 'Status Update';
    if (sessionId) {
      const session = sessionService.getSession(sessionId);
      const label = session?.label ?? sessionId;
      formatted = `[${label}] ${status ? `${status}: ` : ''}${message}`.trim();
    } else if (message) {
      formatted = status ? `${status}: ${message}` : message;
    }

    await sendToGroup(formatted);
    return { sent: true };
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
    stopBot();
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
