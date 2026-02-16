#!/usr/bin/env node

/**
 * Telegram Bot Server
 *
 * Telegraf bot for sending blocking questions to users and receiving responses
 * during autonomous execution.
 */

// Note: .env is loaded by gsd-tools.js before this module is imported
const path = require('path');
const fs = require('fs');

// Check for Telegram bot token
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('[ERROR] TELEGRAM_BOT_TOKEN not set. Set it in .env file.');
  console.error('To create a bot: Message @BotFather on Telegram -> /newbot');
  process.exit(1);
}

const { Telegraf } = require('telegraf');
const conversation = require('./telegram-conversation.js');
const { transcribeAudio, checkWhisperModel } = require('./whisper-transcribe.js');

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_ID = process.env.TELEGRAM_OWNER_ID;

// Store owner chat ID if provided via /start
let ownerChatId = OWNER_ID ? parseInt(OWNER_ID, 10) : null;
let botStarted = false;

/**
 * Command: /start
 * Welcome message with Haiku-powered menu
 */
bot.command('start', async (ctx) => {
  const chatId = ctx.from.id;
  const username = ctx.from.username;

  // Store chat ID for owner verification
  if (!process.env.TELEGRAM_OWNER_ID || chatId.toString() === process.env.TELEGRAM_OWNER_ID) {
    ownerChatId = chatId;
    const { MAIN_MENU } = require('./telegram-haiku-monitor.js');
    await ctx.reply(
      `👋 Welcome ${username}!\n\n` +
      `I'm your GSD assistant powered by Haiku.\n\n` +
      `Use the menu below to:\n` +
      `• Check execution status\n` +
      `• Respond to pending questions\n` +
      `• Add new requirements\n\n` +
      `Voice messages are supported! 🎤`,
      MAIN_MENU
    );
  } else {
    await ctx.reply('Unauthorized. This bot is private.');
  }
});

/**
 * Command: /status
 * Show pending questions count
 */
bot.command('status', (ctx) => {
  const pending = conversation.getPendingQuestions();
  ctx.reply(
    `📊 Status:\n` +
    `Pending questions: ${pending.length}\n` +
    `Bot running: ✓\n\n` +
    `Use /pending to see details.`
  );
});

/**
 * Command: /pending
 * List all pending questions with IDs
 */
bot.command('pending', (ctx) => {
  const pending = conversation.getPendingQuestions();

  if (pending.length === 0) {
    ctx.reply('No pending questions. All clear! ✓');
    return;
  }

  let message = `📋 Pending Questions (${pending.length}):\n\n`;

  pending.forEach((q, index) => {
    const age = Math.round((Date.now() - new Date(q.askedAt).getTime()) / 1000 / 60);
    message += `${index + 1}. ${q.questionId}\n`;
    message += `   ${q.question}\n`;
    message += `   Asked: ${age}m ago\n`;
    if (q.choices) {
      message += `   Choices: ${q.choices.join(', ')}\n`;
    }
    message += '\n';
  });

  message += 'To respond, send: <questionId> <your answer>';

  ctx.reply(message);
});

/**
 * Command: /cancel <questionId>
 * Cancel a pending question
 */
bot.command('cancel', (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    ctx.reply('Usage: /cancel <questionId>');
    return;
  }

  const questionId = args[0];
  const cancelled = conversation.cancelQuestion(questionId, 'Cancelled by user via /cancel');

  if (cancelled) {
    ctx.reply(`✓ Cancelled question: ${questionId}`);
  } else {
    ctx.reply(`Question not found: ${questionId}\n\nUse /pending to see active questions.`);
  }
});

/**
 * Message handler: Handle text messages as responses to questions
 */
bot.on('text', (ctx) => {
  const text = ctx.message.text;

  // Skip commands
  if (text.startsWith('/')) {
    return;
  }

  // Try to extract question ID from message
  // Format: "q_1234567890_abc123 my answer here"
  const questionIdMatch = text.match(/^(q_\d+_[a-z0-9]+)\s+(.+)$/i);

  if (!questionIdMatch) {
    // Check if there's exactly one pending question (implicit response)
    const pending = conversation.getPendingQuestions();
    if (pending.length === 1) {
      const questionId = pending[0].questionId;
      const response = { type: 'text', content: text };
      const handled = conversation.handleResponse(questionId, response);

      if (handled) {
        ctx.reply('✓ Got it! Resuming execution...');
        return;
      }
    }

    ctx.reply(
      'No pending question found.\n\n' +
      'To respond to a question, send:\n' +
      '<questionId> <your answer>\n\n' +
      'Use /pending to see active questions.'
    );
    return;
  }

  const questionId = questionIdMatch[1];
  const answer = questionIdMatch[2];

  const response = { type: 'text', content: answer };
  const handled = conversation.handleResponse(questionId, response);

  if (handled) {
    ctx.reply('✓ Got it! Resuming execution...');
  } else {
    ctx.reply(
      `Question not found: ${questionId}\n\n` +
      'It may have timed out or been cancelled.\n' +
      'Use /pending to see active questions.'
    );
  }
});

/**
 * Callback query handler: Handle inline keyboard button presses for questions
 * Note: Menu buttons (menu:*) are handled by specific action handlers in telegram-haiku-monitor.js
 */
bot.on('callback_query', (ctx) => {
  const data = ctx.callbackQuery.data;

  // Format: "questionId:choice"
  const [questionId, choice] = data.split(':');

  // Only handle question responses (questionId starts with "q_")
  // Let other callbacks (like "menu:action") pass through to specific handlers
  if (!questionId.startsWith('q_')) {
    return; // Don't call ctx.answerCbQuery() - let specific handlers do it
  }

  const response = { type: 'button', content: choice };
  const handled = conversation.handleResponse(questionId, response);

  if (handled) {
    ctx.answerCbQuery('Got it! Resuming execution...');
    ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    ctx.reply(`✓ Selected: ${choice}`);
  } else {
    ctx.answerCbQuery('Question not found or already answered');
  }
});

/**
 * Voice message handler: Transcribe voice and respond to pending questions
 */
bot.on('voice', async (ctx) => {
  const pending = conversation.getPendingQuestions();

  if (pending.length === 0) {
    await ctx.reply('No pending question. Voice message ignored.');
    return;
  }

  // Get most recent pending question
  const latestQuestion = pending[pending.length - 1];

  try {
    // Check model availability
    const modelStatus = await checkWhisperModel();
    if (!modelStatus.available) {
      await ctx.reply(`Cannot process voice: ${modelStatus.message}`);
      return;
    }

    // Notify user we're processing
    await ctx.reply('Processing voice message...');

    // Get file download URL
    const fileId = ctx.message.voice.file_id;
    const fileSize = ctx.message.voice.file_size;

    // Check file size limit (20MB)
    if (fileSize > 20 * 1024 * 1024) {
      await ctx.reply('Voice message too large (>20MB). Please send a shorter clip.');
      return;
    }

    const fileLink = await ctx.telegram.getFileLink(fileId);

    // Transcribe
    const transcription = await transcribeAudio(fileLink.href);

    // Confirm transcription to user
    await ctx.reply(`Transcribed: "${transcription}"\n\nResuming execution...`);

    // Resolve the pending question
    conversation.handleResponse(latestQuestion.questionId, {
      type: 'voice',
      content: transcription,
      original_duration: ctx.message.voice.duration
    });
  } catch (error) {
    await ctx.reply(`Transcription error: ${error.message}`);
  }
});

/**
 * Audio message handler: Transcribe audio and respond to pending questions
 */
bot.on('audio', async (ctx) => {
  const pending = conversation.getPendingQuestions();

  if (pending.length === 0) {
    await ctx.reply('No pending question. Audio message ignored.');
    return;
  }

  // Get most recent pending question
  const latestQuestion = pending[pending.length - 1];

  try {
    // Check model availability
    const modelStatus = await checkWhisperModel();
    if (!modelStatus.available) {
      await ctx.reply(`Cannot process audio: ${modelStatus.message}`);
      return;
    }

    // Notify user we're processing
    await ctx.reply('Processing audio message...');

    // Get file download URL
    const fileId = ctx.message.audio.file_id;
    const fileSize = ctx.message.audio.file_size;

    // Check file size limit (20MB)
    if (fileSize > 20 * 1024 * 1024) {
      await ctx.reply('Audio message too large (>20MB). Please send a shorter clip.');
      return;
    }

    const fileLink = await ctx.telegram.getFileLink(fileId);

    // Transcribe
    const transcription = await transcribeAudio(fileLink.href);

    // Confirm transcription to user
    await ctx.reply(`Transcribed: "${transcription}"\n\nResuming execution...`);

    // Resolve the pending question
    conversation.handleResponse(latestQuestion.questionId, {
      type: 'audio',
      content: transcription,
      original_duration: ctx.message.audio.duration
    });
  } catch (error) {
    await ctx.reply(`Transcription error: ${error.message}`);
  }
});

/**
 * Command: /whisper
 * Check Whisper model status
 */
bot.command('whisper', async (ctx) => {
  const status = await checkWhisperModel();
  if (status.available) {
    await ctx.reply(`Whisper model ready: ${status.path}`);
  } else {
    await ctx.reply(`Whisper not available: ${status.message}`);
  }
});

/**
 * Send a blocking question to the user and await response
 * @param {string} question - Question text
 * @param {object} options - Options (choices, timeout, context)
 * @returns {Promise<object>} Resolves with response { type, content }
 */
async function sendBlockingQuestion(question, options = {}) {
  if (!ownerChatId) {
    throw new Error('Owner chat ID not set. User must send /start to bot first.');
  }

  // Create the question and get promise
  const promise = conversation.askUser(question, options);
  const questionId = promise.questionId;

  // Format message
  let message = `❓ ${question}\n\n`;
  message += `ID: ${questionId}\n`;

  if (options.context && Object.keys(options.context).length > 0) {
    message += `Context: ${JSON.stringify(options.context, null, 2)}\n`;
  }

  // Build inline keyboard if choices provided
  const extra = {};
  if (options.choices && options.choices.length > 0) {
    const keyboard = options.choices.map(choice => ([
      { text: choice, callback_data: `${questionId}:${choice}` }
    ]));
    extra.reply_markup = { inline_keyboard: keyboard };
    message += '\nTap a button or send your answer.';
  } else {
    message += '\nReply with: ' + questionId + ' <your answer>';
  }

  // Send message
  await bot.telegram.sendMessage(ownerChatId, message, extra);

  // Wait for response
  return promise;
}

/**
 * Start the bot in polling mode with Haiku monitor
 */
async function startBot() {
  if (botStarted) {
    console.log('Bot already running');
    return;
  }

  const { startSession } = require('./telegram-session-logger.js');
  const { startHaikuMonitor } = require('./telegram-haiku-monitor.js');

  // Start session logging
  const sessionPath = startSession();
  console.log(`Session log: ${sessionPath}`);

  // Start Haiku monitor
  startHaikuMonitor(bot);

  await bot.launch();
  botStarted = true;
  console.log('Telegram bot started with Haiku monitor');
}

/**
 * Stop the bot gracefully
 */
function stopBot() {
  if (!botStarted) return;

  const { stopHaikuMonitor } = require('./telegram-haiku-monitor.js');
  const { endSession } = require('./telegram-session-logger.js');

  stopHaikuMonitor();
  const sessionPath = endSession();
  console.log(`Session ended: ${sessionPath}`);

  bot.stop('SIGTERM');
  botStarted = false;
  console.log('Telegram bot stopped');
}

// Graceful shutdown
process.once('SIGINT', () => stopBot());
process.once('SIGTERM', () => stopBot());

module.exports = {
  sendBlockingQuestion,
  startBot,
  stopBot,
  bot
};
