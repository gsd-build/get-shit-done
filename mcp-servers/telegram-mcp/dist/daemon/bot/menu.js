/**
 * Inline keyboard menu module for the Telegram MCP daemon bot.
 *
 * Provides the main menu, Status panel, and Questions panel.
 * All panels return formatted text + keyboard markup that callers
 * can pass directly to ctx.reply() or ctx.editMessageText().
 */
import { Markup } from 'telegraf';
import { createLogger } from '../../shared/logger.js';
const log = createLogger('bot/menu');
// ─── Keyboard builders ─────────────────────────────────────────────────────────
/**
 * Return the main menu inline keyboard.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  [Status] [Questions] [Refresh] │
 *   └─────────────────────────────────┘
 */
export function getMainMenuKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('Status', 'panel:status'),
            Markup.button.callback('Questions', 'panel:questions'),
            Markup.button.callback('Refresh', 'panel:refresh'),
        ],
    ]);
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
export function formatStatusPanel(sessions) {
    let text;
    if (sessions.length === 0) {
        text = 'No active Claude sessions';
    }
    else {
        const lines = sessions.map((s) => {
            const statusLabel = s.status === 'waiting' && s.questionTitle
                ? `${s.status} [${s.questionTitle}]`
                : s.status;
            return `${s.label} \u2014 ${statusLabel}`;
        });
        text = `Sessions (${sessions.length} active)\n${lines.join('\n')}`;
    }
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('Questions', 'panel:questions'),
            Markup.button.callback('Refresh', 'panel:refresh'),
        ],
    ]);
    return { text, keyboard };
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
export function formatQuestionsPanel(questions, sessions) {
    // Build a lookup map for session labels
    const sessionLabels = new Map(sessions.map((s) => [s.id, s.label]));
    let text;
    // Use any[] rows to allow mixing url and callback buttons in the same keyboard
    const rows = [];
    if (questions.length === 0) {
        text = 'No pending questions';
    }
    else {
        const lines = questions.map((q) => {
            const label = sessionLabels.get(q.sessionId) ?? q.sessionId.slice(0, 8);
            return `${label}: ${q.title}`;
        });
        text = `Pending Questions (${questions.length})\n${lines.join('\n')}`;
        // Add a button per question that links to the forum thread
        for (const q of questions) {
            const label = sessionLabels.get(q.sessionId) ?? q.sessionId.slice(0, 8);
            const buttonLabel = `${label}: ${q.title.slice(0, 24)}`;
            if (q.threadId !== undefined) {
                // Deep link to specific forum thread
                // Telegram URL format: https://t.me/c/{channelId}/{messageThreadId}
                const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID ?? '';
                // Strip leading -100 prefix from supergroup IDs for URL format
                const channelId = groupChatId.replace(/^-100/, '');
                rows.push([
                    Markup.button.url(`\u2192 ${buttonLabel}`, `https://t.me/c/${channelId}/${q.threadId}`),
                ]);
            }
            else {
                // No thread yet — show a no-op button with the question info
                rows.push([
                    Markup.button.callback(`${buttonLabel} (no thread)`, `noop:${q.id}`),
                ]);
            }
        }
    }
    rows.push([
        Markup.button.callback('Status', 'panel:status'),
        Markup.button.callback('Refresh', 'panel:refresh'),
    ]);
    const keyboard = Markup.inlineKeyboard(rows);
    return { text, keyboard };
}
// ─── Menu handler registration ─────────────────────────────────────────────────
/**
 * Register all menu callback_query handlers on the bot.
 *
 * Handles: panel:status, panel:questions, panel:refresh, and noop:* (no-op).
 *
 * @param bot            Telegraf bot instance
 * @param sessionService In-memory session registry
 * @param getQuestions   Callback returning current pending questions
 */
export function registerMenuHandlers(bot, sessionService, getQuestions) {
    // ─── Status panel ──────────────────────────────────────────────────────
    bot.action('panel:status', async (ctx) => {
        await ctx.answerCbQuery();
        const sessions = sessionService.getAllSessions();
        const { text, keyboard } = formatStatusPanel(sessions);
        try {
            await ctx.editMessageText(text, keyboard);
        }
        catch {
            // Message may not have changed — ignore Telegram "message is not modified" error
            await ctx.reply(text, keyboard);
        }
        log.info({ sessionCount: sessions.length }, 'Status panel rendered');
    });
    // ─── Questions panel ───────────────────────────────────────────────────
    bot.action('panel:questions', async (ctx) => {
        await ctx.answerCbQuery();
        const questions = getQuestions();
        const sessions = sessionService.getAllSessions();
        const { text, keyboard } = formatQuestionsPanel(questions, sessions);
        try {
            await ctx.editMessageText(text, keyboard);
        }
        catch {
            await ctx.reply(text, keyboard);
        }
        log.info({ questionCount: questions.length }, 'Questions panel rendered');
    });
    // ─── Refresh ───────────────────────────────────────────────────────────
    bot.action('panel:refresh', async (ctx) => {
        await ctx.answerCbQuery('Refreshed');
        const sessions = sessionService.getAllSessions();
        const { text, keyboard } = formatStatusPanel(sessions);
        try {
            await ctx.editMessageText(text, keyboard);
        }
        catch {
            await ctx.reply(text, keyboard);
        }
        log.info('Refresh action triggered');
    });
    // ─── No-op (for questions without a thread) ────────────────────────────
    bot.action(/^noop:/, async (ctx) => {
        await ctx.answerCbQuery('Thread not created yet');
    });
    log.info('Menu handlers registered');
}
