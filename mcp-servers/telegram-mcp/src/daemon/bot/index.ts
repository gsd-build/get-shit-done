/**
 * Telegram Bot initialization for the Telegram MCP daemon.
 *
 * Supports webhook mode (when TELEGRAM_WEBHOOK_URL is set) and
 * long polling mode (default). Forum topic creation, thread messaging,
 * and session connect/disconnect notifications are handled here.
 *
 * Pattern: Lazy initialization — bot is NOT created at import time.
 * Call initializeBot() first, then startBot(sessionService, getQuestions)
 * to wire handlers and start receiving updates.
 */

import http from 'http';
import { Telegraf, session } from 'telegraf';
import type { Context } from 'telegraf';
import { createLogger } from '../../shared/logger.js';
import type { SessionService } from '../session-service.js';
import type { Question } from '../../shared/types.js';
import { setupHandlers } from './handlers.js';

const log = createLogger('bot');

// ─── Session data ──────────────────────────────────────────────────────────────

interface SessionData {
  /** No per-session data needed for daemon bot — placeholder for middleware */
  _placeholder?: true;
}

interface BotContext extends Context {
  session: SessionData;
}

// ─── Module state ──────────────────────────────────────────────────────────────

/** Singleton bot instance — created once in initializeBot() */
let bot: Telegraf<BotContext> | null = null;

/** HTTP server used in webhook mode (null in polling mode) */
let webhookServer: http.Server | null = null;

// ─── Bot lifecycle ─────────────────────────────────────────────────────────────

/**
 * Create the Telegraf instance with session middleware.
 *
 * Does NOT register handlers — handlers depend on sessionService
 * and getQuestions which are only available in startBot().
 *
 * @returns The configured bot instance (not yet launched)
 */
export function initializeBot(): Telegraf<BotContext> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  }

  const instance = new Telegraf<BotContext>(token);

  instance.use(
    session({
      defaultSession: (): SessionData => ({ _placeholder: true }),
    })
  );

  bot = instance;
  log.info('Bot instance created (handlers not yet registered)');
  return instance;
}

/**
 * Wire handlers and start the bot in webhook or long polling mode.
 *
 * @param sessionService In-memory session registry (provides getAllSessions and events)
 * @param getQuestions   Callback returning current pending questions (from Plan 04)
 */
export async function startBot(
  sessionService: SessionService,
  getQuestions: () => Question[]
): Promise<void> {
  if (!bot) {
    initializeBot();
  }

  const botInstance = bot as Telegraf<BotContext>;

  // Wire handlers — this must happen AFTER sessionService is available
  // Cast to Context to satisfy setupHandlers' generic signature
  setupHandlers(botInstance as unknown as Telegraf<Context>, sessionService, getQuestions);

  // ─── Session event notifications ─────────────────────────────────────────

  sessionService.on('session:connected', async (session) => {
    log.info({ sessionId: session.id, label: session.label }, 'Session connected — sending notification');
    try {
      await sendToGroup(`Claude connected \u2014 ${session.label}`);
    } catch (err: any) {
      log.error({ err: err.message }, 'Failed to send session:connected notification');
    }
  });

  sessionService.on('session:disconnected', async (session) => {
    log.info({ sessionId: session.id, label: session.label }, 'Session disconnected — sending notification');
    try {
      await sendToGroup(`Claude disconnected \u2014 ${session.label}`);
    } catch (err: any) {
      log.error({ err: err.message }, 'Failed to send session:disconnected notification');
    }
  });

  // ─── Forum setup validation ───────────────────────────────────────────────

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (groupChatId) {
    try {
      const chat = await botInstance.telegram.getChat(groupChatId);
      // @ts-ignore — is_forum is not in all Telegraf chat type definitions
      if ((chat as any).type !== 'supergroup' || !(chat as any).is_forum) {
        log.error(
          { chatId: groupChatId },
          'TELEGRAM_GROUP_CHAT_ID is not a forum supergroup. ' +
          'To enable forum threads: open group → Edit → Enable Topics. ' +
          'Bot will continue but thread features will not work.'
        );
      } else {
        log.info({ chatId: groupChatId }, 'Forum supergroup validated — thread features enabled');
      }
    } catch (err: any) {
      log.error(
        { chatId: groupChatId, err: err.message },
        'Failed to validate forum group. Check TELEGRAM_GROUP_CHAT_ID and bot admin permissions.'
      );
    }
  } else {
    log.warn(
      'TELEGRAM_GROUP_CHAT_ID not set — forum thread features disabled. ' +
      'Falling back to TELEGRAM_OWNER_ID DM mode.'
    );
  }

  // ─── Webhook vs polling ───────────────────────────────────────────────────

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (webhookUrl) {
    await startWebhookMode(botInstance, webhookUrl);
  } else {
    await startPollingMode(botInstance);
  }
}

async function startWebhookMode(
  botInstance: Telegraf<BotContext>,
  webhookUrl: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN as string;
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const hookPath = `/bot${token}`;

  // Create a plain Node.js HTTP server — express not needed for a single endpoint
  webhookServer = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === hookPath) {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          await botInstance.handleUpdate(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        } catch (err: any) {
          log.error({ err: err.message }, 'Error processing webhook update');
          res.writeHead(500);
          res.end();
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await botInstance.telegram.setWebhook(`${webhookUrl}/bot${token}`);

  await new Promise<void>((resolve) => {
    webhookServer!.listen(port, () => {
      log.info({ port }, `Bot started in webhook mode on port ${port}`);
      resolve();
    });
  });
}

async function startPollingMode(botInstance: Telegraf<BotContext>): Promise<void> {
  await botInstance.telegram.deleteWebhook();
  await botInstance.launch({ dropPendingUpdates: true });
  log.info('Bot started in long polling mode');
}

/**
 * Stop the bot gracefully (polling or webhook mode).
 */
export function stopBot(): void {
  if (!bot) {
    log.warn('stopBot() called but bot not initialized');
    return;
  }

  bot.stop('SIGTERM');

  if (webhookServer) {
    webhookServer.close();
    webhookServer = null;
  }

  log.info('Bot stopped');
}

/**
 * Return the current bot instance, or null if not yet initialized.
 */
export function getBot(): Telegraf<BotContext> | null {
  return bot;
}

// ─── Messaging helpers ─────────────────────────────────────────────────────────

/**
 * Send a plain message to the Telegram group chat.
 *
 * Falls back to TELEGRAM_OWNER_ID if TELEGRAM_GROUP_CHAT_ID is not set.
 *
 * @param text    Message text
 * @param options Optional Telegraf sendMessage options
 */
export async function sendToGroup(
  text: string,
  options?: Parameters<Telegraf['telegram']['sendMessage']>[2]
): Promise<void> {
  if (!bot) {
    throw new Error('Bot not initialized. Call startBot() first.');
  }

  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID ?? process.env.TELEGRAM_OWNER_ID;
  if (!chatId) {
    throw new Error(
      'Neither TELEGRAM_GROUP_CHAT_ID nor TELEGRAM_OWNER_ID is set'
    );
  }

  await bot.telegram.sendMessage(chatId, text, options);
}

/**
 * Create a new forum topic (thread) in the group chat.
 *
 * @param title Topic title shown as the thread name in Telegram
 * @returns The message_thread_id of the created topic
 */
export async function createForumTopic(title: string): Promise<number> {
  if (!bot) {
    throw new Error('Bot not initialized. Call startBot() first.');
  }

  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) {
    throw new Error('TELEGRAM_GROUP_CHAT_ID is not set — cannot create forum topics');
  }

  const topic = await bot.telegram.createForumTopic(chatId, title);
  log.info({ chatId, title, threadId: topic.message_thread_id }, 'Forum topic created');
  return topic.message_thread_id;
}

/**
 * Send a message to a specific forum thread.
 *
 * @param threadId     The message_thread_id of the target thread
 * @param text         Message text
 * @param options      Optional Telegraf sendMessage options
 */
export async function sendToThread(
  threadId: number,
  text: string,
  options?: Parameters<Telegraf['telegram']['sendMessage']>[2]
): Promise<void> {
  if (!bot) {
    throw new Error('Bot not initialized. Call startBot() first.');
  }

  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) {
    throw new Error('TELEGRAM_GROUP_CHAT_ID is not set — cannot send to forum threads');
  }

  await bot.telegram.sendMessage(chatId, text, {
    ...options,
    message_thread_id: threadId,
  });
}
