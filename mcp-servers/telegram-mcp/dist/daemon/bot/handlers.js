/**
 * Telegram bot message and callback handlers for the daemon.
 *
 * Registers:
 *   /start, /status, /questions commands
 *   bot.on('text')  — routes thread text replies as 'thread:text_reply' events
 *   bot.on('voice') — transcribes voice then emits 'thread:voice_reply' events
 *   Menu callbacks  — via registerMenuHandlers() from menu.ts
 *
 * Cross-module wiring:
 *   Plan 04's daemon/index.ts imports `handlerEvents` and listens to
 *   'thread:text_reply' and 'thread:voice_reply' to route answers to questions.
 */
import { EventEmitter } from 'events';
import { createLogger } from '../../shared/logger.js';
import { registerMenuHandlers, formatStatusPanel, formatQuestionsPanel, getMainMenuKeyboard } from './menu.js';
import { transcribeVoice } from './whisper.js';
const log = createLogger('handlers');
// ─── Named event emitter ───────────────────────────────────────────────────────
/**
 * Named EventEmitter for cross-module handler event wiring.
 *
 * Events:
 *   'thread:text_reply'  — { threadId: number, text: string }
 *   'thread:voice_reply' — { threadId: number, text: string }
 *
 * Plan 04 imports this from './bot/handlers' and subscribes to route answers.
 */
export const handlerEvents = new EventEmitter();
// ─── Handler registration ──────────────────────────────────────────────────────
/**
 * Register all bot command and message handlers.
 *
 * This function is called inside startBot() (bot/index.ts) — NOT inside
 * initializeBot() — because sessionService and getQuestions are only
 * available once the daemon starts the bot with its dependencies.
 *
 * @param bot            Telegraf bot instance
 * @param sessionService In-memory session registry
 * @param getQuestions   Callback returning current pending questions
 */
export function setupHandlers(bot, sessionService, getQuestions) {
    // ─── /start command ────────────────────────────────────────────────────
    bot.command('start', async (ctx) => {
        const keyboard = getMainMenuKeyboard();
        await ctx.reply('GSD Telegram Bot\n\nUse the buttons below to check session status or view pending questions.', keyboard);
        log.info({ fromId: ctx.from?.id }, '/start command received');
    });
    // ─── /status command ───────────────────────────────────────────────────
    bot.command('status', async (ctx) => {
        const sessions = sessionService.getAllSessions();
        const { text, keyboard } = formatStatusPanel(sessions);
        await ctx.reply(text, keyboard);
        log.info({ sessionCount: sessions.length }, '/status command received');
    });
    // ─── /questions command ────────────────────────────────────────────────
    bot.command('questions', async (ctx) => {
        const questions = getQuestions();
        const sessions = sessionService.getAllSessions();
        const { text, keyboard } = formatQuestionsPanel(questions, sessions);
        await ctx.reply(text, keyboard);
        log.info({ questionCount: questions.length }, '/questions command received');
    });
    // ─── Text message handler ──────────────────────────────────────────────
    bot.on('text', async (ctx) => {
        const msg = ctx.message;
        const threadId = msg.message_thread_id;
        if (threadId !== undefined) {
            // Message is inside a forum thread — emit as a potential question answer
            const text = msg.text;
            log.info({ threadId, textLength: text.length }, 'Thread text reply received');
            handlerEvents.emit('thread:text_reply', { threadId, text });
        }
        else {
            // Top-level message — show the main menu
            const keyboard = getMainMenuKeyboard();
            await ctx.reply('Use the menu to check status or answer pending questions.', keyboard);
        }
    });
    // ─── Voice message handler ─────────────────────────────────────────────
    bot.on('voice', async (ctx) => {
        const msg = ctx.message;
        const threadId = msg.message_thread_id;
        if (threadId !== undefined) {
            log.info({ threadId, fileId: msg.voice.file_id }, 'Thread voice reply received — transcribing');
            try {
                const fileLink = await ctx.telegram.getFileLink(msg.voice.file_id);
                const transcript = await transcribeVoice(fileLink.href);
                // transcribeVoice never throws — it returns an error string on failure.
                // Don't deliver a failed transcription as a question answer.
                if (transcript.startsWith('[Transcription failed:')) {
                    log.warn({ threadId }, 'Transcription failed — prompting user to retry with text');
                    await ctx.reply(`Could not transcribe voice message. Please reply with text instead.\n${transcript}`);
                    return;
                }
                // Confirm transcription in the thread
                const preview = transcript.slice(0, 50);
                const suffix = transcript.length > 50 ? '...' : '';
                await ctx.reply(`Transcribed: ${preview}${suffix}`);
                handlerEvents.emit('thread:voice_reply', { threadId, text: transcript });
                log.info({ threadId }, 'Thread voice reply emitted');
            }
            catch (err) {
                log.error({ threadId, err: err.message }, 'Voice handler error');
                await ctx.reply(`[Error processing voice message: ${err.message}]`);
            }
        }
        else {
            // Voice outside a thread — ignore (not a question answer context)
            log.info('Voice message received outside thread — ignoring');
        }
    });
    // ─── Menu callback handlers ────────────────────────────────────────────
    registerMenuHandlers(bot, sessionService, getQuestions);
    log.info('All handlers registered');
}
