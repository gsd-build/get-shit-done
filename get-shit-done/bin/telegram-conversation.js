#!/usr/bin/env node

/**
 * Telegram Conversation State Management Module
 *
 * Manages blocking question/response flow for human-in-the-loop interaction
 * during autonomous execution.
 */

// In-memory storage for pending questions (single user)
const pendingQuestions = new Map();

/**
 * Generate unique question ID
 * @returns {string} Question ID in format: q_timestamp_random
 */
function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ask user a blocking question via Telegram
 * @param {string} question - The question text to send to user
 * @param {object} options - Optional parameters
 * @param {Array<string>} options.choices - Array of inline keyboard button choices
 * @param {number} options.timeout - Custom timeout in ms (default: 3600000 = 1 hour)
 * @param {object} options.context - Additional context to store with question
 * @returns {Promise<object>} Resolves with response object { type, content }
 */
function askUser(question, options = {}) {
  const questionId = generateQuestionId();
  const timeout = options.timeout || 3600000; // 1 hour default

  const promise = new Promise((resolve, reject) => {
    // Store question data
    pendingQuestions.set(questionId, {
      questionId,
      question,
      choices: options.choices || null,
      context: options.context || {},
      askedAt: new Date().toISOString(),
      resolve,
      reject,
      timeoutId: null
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (pendingQuestions.has(questionId)) {
        pendingQuestions.delete(questionId);
        const error = new Error(`Question timed out after ${timeout}ms`);
        error.name = 'TimeoutError';
        error.questionId = questionId;
        reject(error);
      }
    }, timeout);

    // Store timeout ID for cleanup
    const questionData = pendingQuestions.get(questionId);
    questionData.timeoutId = timeoutId;
  });

  // Return both the promise and questionId for the bot to use
  promise.questionId = questionId;
  return promise;
}

/**
 * Handle user response to a pending question
 * @param {string} questionId - The question ID to respond to
 * @param {object} response - Response object { type: 'text'|'button', content: string }
 * @returns {boolean} True if question was found and resolved, false otherwise
 */
function handleResponse(questionId, response) {
  if (!pendingQuestions.has(questionId)) {
    return false;
  }

  const questionData = pendingQuestions.get(questionId);

  // Clear timeout
  if (questionData.timeoutId) {
    clearTimeout(questionData.timeoutId);
  }

  // Resolve promise with response
  questionData.resolve(response);

  // Clean up from map
  pendingQuestions.delete(questionId);

  return true;
}

/**
 * Get all pending questions
 * @returns {Array<object>} Array of pending question objects
 */
function getPendingQuestions() {
  return Array.from(pendingQuestions.values()).map(q => ({
    questionId: q.questionId,
    question: q.question,
    choices: q.choices,
    context: q.context,
    askedAt: q.askedAt
  }));
}

/**
 * Cancel a pending question
 * @param {string} questionId - The question ID to cancel
 * @param {string} reason - Cancellation reason
 * @returns {boolean} True if question was found and cancelled, false otherwise
 */
function cancelQuestion(questionId, reason = 'Question cancelled') {
  if (!pendingQuestions.has(questionId)) {
    return false;
  }

  const questionData = pendingQuestions.get(questionId);

  // Clear timeout
  if (questionData.timeoutId) {
    clearTimeout(questionData.timeoutId);
  }

  // Reject promise with cancellation error
  const error = new Error(reason);
  error.name = 'CancellationError';
  error.questionId = questionId;
  questionData.reject(error);

  // Clean up from map
  pendingQuestions.delete(questionId);

  return true;
}

module.exports = {
  askUser,
  handleResponse,
  getPendingQuestions,
  cancelQuestion,
  generateQuestionId
};
