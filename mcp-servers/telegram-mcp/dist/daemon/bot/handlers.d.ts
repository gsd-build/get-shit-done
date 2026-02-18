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
import type { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import type { SessionService } from '../session-service.js';
import type { Question } from '../../shared/types.js';
/**
 * Named EventEmitter for cross-module handler event wiring.
 *
 * Events:
 *   'thread:text_reply'  — { threadId: number, text: string }
 *   'thread:voice_reply' — { threadId: number, text: string }
 *
 * Plan 04 imports this from './bot/handlers' and subscribes to route answers.
 */
export declare const handlerEvents: EventEmitter<[never]>;
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
export declare function setupHandlers(bot: Telegraf<Context>, sessionService: SessionService, getQuestions: () => Question[]): void;
