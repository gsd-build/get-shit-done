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
import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import type { SessionService } from '../session-service.js';
import type { Question } from '../../shared/types.js';
interface SessionData {
    /** No per-session data needed for daemon bot — placeholder for middleware */
    _placeholder?: true;
}
interface BotContext extends Context {
    session: SessionData;
}
/**
 * Create the Telegraf instance with session middleware.
 *
 * Does NOT register handlers — handlers depend on sessionService
 * and getQuestions which are only available in startBot().
 *
 * @returns The configured bot instance (not yet launched)
 */
export declare function initializeBot(): Telegraf<BotContext>;
/**
 * Wire handlers and start the bot in webhook or long polling mode.
 *
 * @param sessionService In-memory session registry (provides getAllSessions and events)
 * @param getQuestions   Callback returning current pending questions (from Plan 04)
 */
export declare function startBot(sessionService: SessionService, getQuestions: () => Question[]): Promise<void>;
/**
 * Stop the bot gracefully (polling or webhook mode).
 */
export declare function stopBot(): void;
/**
 * Return the current bot instance, or null if not yet initialized.
 */
export declare function getBot(): Telegraf<BotContext> | null;
/**
 * Send a plain message to the Telegram group chat.
 *
 * Falls back to TELEGRAM_OWNER_ID if TELEGRAM_GROUP_CHAT_ID is not set.
 *
 * @param text    Message text
 * @param options Optional Telegraf sendMessage options
 */
export declare function sendToGroup(text: string, options?: Parameters<Telegraf['telegram']['sendMessage']>[2]): Promise<void>;
/**
 * Create a new forum topic (thread) in the group chat.
 *
 * @param title Topic title shown as the thread name in Telegram
 * @returns The message_thread_id of the created topic
 */
export declare function createForumTopic(title: string): Promise<number>;
/**
 * Send a message to a specific forum thread.
 *
 * @param threadId     The message_thread_id of the target thread
 * @param text         Message text
 * @param options      Optional Telegraf sendMessage options
 */
export declare function sendToThread(threadId: number, text: string, options?: Parameters<Telegraf['telegram']['sendMessage']>[2]): Promise<void>;
export {};
