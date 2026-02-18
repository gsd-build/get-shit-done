#!/usr/bin/env node

/**
 * Telegram Session Logger
 *
 * Logs all bot activity (messages, questions, decisions) to JSONL files.
 * One file per bot session in .planning/telegram-sessions/
 */

const fs = require('fs');
const path = require('path');

// Resolve project root relative to this module's location (__dirname is stable,
// process.cwd() can change if the caller switches directories before requiring this module)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let currentSessionPath = null;
let sessionStartTime = null;

/**
 * Start new session log
 */
function startSession() {
  // Use local time instead of UTC for easier identification
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const sessionsDir = path.join(PROJECT_ROOT, '.planning', 'telegram-sessions');

  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  currentSessionPath = path.join(sessionsDir, `${timestamp}.jsonl`);
  sessionStartTime = Date.now();

  logEvent({
    type: 'session_start',
    timestamp: new Date().toISOString()
  });

  return currentSessionPath;
}

/**
 * Log any event to current session
 */
function logEvent(event) {
  if (!currentSessionPath) {
    startSession();
  }

  const entry = {
    ...event,
    session_time_ms: Date.now() - sessionStartTime,
    timestamp: event.timestamp || new Date().toISOString()
  };

  fs.appendFileSync(currentSessionPath, JSON.stringify(entry) + '\n');
}

/**
 * Log user message
 */
function logMessage(userId, username, messageType, content) {
  logEvent({
    type: 'user_message',
    user_id: userId,
    username,
    message_type: messageType, // 'text', 'voice', 'button'
    content: messageType === 'voice' ? `[voice:${content.duration}s]` : content
  });
}

/**
 * Log bot response
 */
function logBotResponse(content, messageType = 'text') {
  logEvent({
    type: 'bot_response',
    message_type: messageType,
    content
  });
}

/**
 * Log Haiku decision
 */
function logDecision(decisionType, reasoning, action) {
  logEvent({
    type: 'haiku_decision',
    decision_type: decisionType, // 'add_phase', 'insert_phase', 'add_todo', 'add_future'
    reasoning,
    action
  });
}

/**
 * Log blocking question
 */
function logBlockingQuestion(questionId, question, source) {
  logEvent({
    type: 'blocking_question',
    question_id: questionId,
    question,
    source // 'coordinator', 'executor', etc.
  });
}

/**
 * Log blocking question response
 */
function logBlockingResponse(questionId, response) {
  logEvent({
    type: 'blocking_response',
    question_id: questionId,
    response
  });
}

/**
 * End current session
 */
function endSession() {
  if (currentSessionPath) {
    logEvent({
      type: 'session_end',
      duration_ms: Date.now() - sessionStartTime
    });
  }

  const path = currentSessionPath;
  currentSessionPath = null;
  sessionStartTime = null;
  return path;
}

/**
 * Get current session path
 */
function getSessionPath() {
  return currentSessionPath;
}

/**
 * Get all session files
 */
function getAllSessions() {
  const sessionsDir = path.join(PROJECT_ROOT, '.planning', 'telegram-sessions');
  if (!fs.existsSync(sessionsDir)) return [];

  return fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => path.join(sessionsDir, f))
    .sort()
    .reverse(); // Most recent first
}

/**
 * Read session log
 */
function readSession(sessionPath) {
  const content = fs.readFileSync(sessionPath, 'utf8');
  return content.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

module.exports = {
  startSession,
  endSession,
  logEvent,
  logMessage,
  logBotResponse,
  logDecision,
  logBlockingQuestion,
  logBlockingResponse,
  getSessionPath,
  getAllSessions,
  readSession
};
