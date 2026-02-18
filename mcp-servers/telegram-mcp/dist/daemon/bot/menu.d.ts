/**
 * Inline keyboard menu module for the Telegram MCP daemon bot.
 *
 * Provides the main menu, Status panel, and Questions panel.
 * All panels return formatted text + keyboard markup that callers
 * can pass directly to ctx.reply() or ctx.editMessageText().
 */
import { Markup } from 'telegraf';
import type { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import type { Session, Question } from '../../shared/types.js';
import type { SessionService } from '../session-service.js';
/**
 * Return the main menu inline keyboard.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  [Status] [Questions] [Refresh] │
 *   └─────────────────────────────────┘
 */
export declare function getMainMenuKeyboard(): Markup.Markup<import("@telegraf/types").InlineKeyboardMarkup>;
/** Return value from formatStatusPanel */
export interface StatusPanelResult {
    text: string;
    keyboard: ReturnType<typeof Markup.inlineKeyboard>;
}
/**
 * Format the status panel for the given sessions.
 *
 * Message format:
 *   Sessions ({count} active)
 *   {label} — {status} [{questionTitle if waiting}]
 *   ...
 *
 * @param sessions Array of active sessions from SessionService
 * @returns Formatted text and inline keyboard
 */
export declare function formatStatusPanel(sessions: Session[]): StatusPanelResult;
/** Return value from formatQuestionsPanel */
export interface QuestionsPanelResult {
    text: string;
    keyboard: ReturnType<typeof Markup.inlineKeyboard>;
}
/**
 * Format the questions panel for the given questions.
 *
 * Message format:
 *   Pending Questions ({count})
 *   {session.label}: {question.title}
 *   ...
 *
 * Each question gets an inline button linking to its forum thread.
 * If no questions: "No pending questions".
 *
 * @param questions  Array of pending Question objects
 * @param sessions   Array of sessions (for label lookup by sessionId)
 * @returns Formatted text and inline keyboard
 */
export declare function formatQuestionsPanel(questions: Question[], sessions: Session[]): QuestionsPanelResult;
/**
 * Register all menu callback_query handlers on the bot.
 *
 * Handles: panel:status, panel:questions, panel:refresh, and noop:* (no-op).
 *
 * @param bot            Telegraf bot instance
 * @param sessionService In-memory session registry
 * @param getQuestions   Callback returning current pending questions
 */
export declare function registerMenuHandlers(bot: Telegraf<Context>, sessionService: SessionService, getQuestions: () => Question[]): void;
