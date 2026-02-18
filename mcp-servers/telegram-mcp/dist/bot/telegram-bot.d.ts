/**
 * Telegram Bot with Middleware-Based Menu Handlers
 *
 * CRITICAL FIX: Uses session middleware instead of .once() listeners
 * to avoid the Phase 8 bug where menu buttons only work once.
 */
import { Telegraf, Markup } from 'telegraf';
import type { Context } from 'telegraf';
interface SessionData {
    awaitingQuestionResponse: string | null;
    awaitingSessionId: string | null;
}
interface BotContext extends Context {
    session: SessionData;
}
/**
 * Main menu keyboard (New Requirements DISABLED per user decision)
 */
export declare const MAIN_MENU: Markup.Markup<import("@telegraf/types").InlineKeyboardMarkup>;
/**
 * Send message to owner
 */
export declare function sendMessage(text: string, extra?: any): Promise<void>;
/**
 * Send blocking question to owner
 * NOTE: This function is deprecated in favor of MCP tools (ask-question).
 * Kept for backward compatibility but should not be used in new code.
 */
export declare function sendBlockingQuestion(question: string, options?: {
    context?: string;
    timeout?: number;
    sessionId?: string;
}): Promise<string>;
/**
 * Start bot in polling mode
 */
export declare function startBot(): Promise<void>;
/**
 * Stop bot gracefully
 */
export declare function stopBot(): void;
/**
 * Get bot instance (for advanced use)
 */
export declare function getBot(): Telegraf<BotContext> | null;
export {};
