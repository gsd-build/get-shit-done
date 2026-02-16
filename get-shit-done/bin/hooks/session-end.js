const { loadHookConfig, isHooksEnabled } = require('./config.js');
const { extractKnowledge } = require('../knowledge-extraction.js');

// Conversation history accumulator
let conversationHistory = [];

function addToHistory(message) {
  conversationHistory.push({
    role: message.role,
    content: message.content,
    timestamp: Date.now()
  });
}

function getConversationHistory() {
  return [...conversationHistory];
}

function clearConversationHistory() {
  conversationHistory = [];
}

// Get all Claude responses from history
function getAssistantResponses() {
  return conversationHistory
    .filter(msg => msg.role === 'assistant')
    .map(msg => msg.content);
}

async function sessionEndHook(options = {}) {
  const config = loadHookConfig(options);

  if (!config.enabled || config.timing !== 'session-end') {
    return { skipped: true, reason: 'disabled_or_wrong_timing' };
  }

  const responses = getAssistantResponses();
  if (responses.length === 0) {
    return { skipped: true, reason: 'no_responses' };
  }

  // Combine all responses and extract
  const combinedText = responses.join('\n\n---\n\n');
  const extraction = extractKnowledge(combinedText, {
    debug: process.env.GSD_DEBUG
  });

  if (extraction.extractions.length === 0) {
    return {
      skipped: true,
      reason: 'no_extractions',
      stats: {
        responses_analyzed: responses.length,
        raw_matches: extraction.total_raw,
        filtered: extraction.total_filtered
      }
    };
  }

  // Process extractions (defer to evolution module if available)
  let processResult = { created: 0, evolved: 0, skipped: 0 };

  try {
    const { processExtractionBatch } = require('../knowledge-evolution.js');
    const { knowledge } = require('../knowledge.js');

    if (knowledge.isReady(config.scope)) {
      // Get connection and process
      const conn = await knowledge._getConnection(config.scope);
      processResult = await processExtractionBatch(conn, extraction.extractions, {
        scope: config.scope,
        source: 'session_end_hook'
      });
    }
  } catch (err) {
    console.warn('[session-end] Processing failed:', err.message);
    processResult.error = err.message;
  }

  // Clear history after processing
  clearConversationHistory();

  return {
    success: true,
    stats: {
      responses_analyzed: responses.length,
      raw_matches: extraction.total_raw,
      filtered: extraction.total_filtered,
      deduplicated: extraction.total_deduplicated,
      ...processResult
    }
  };
}

let registered = false;

function registerSessionEndHook() {
  if (registered) return;

  // Handle graceful shutdown
  const signals = ['beforeExit', 'SIGTERM', 'SIGINT'];
  const handler = async (signal) => {
    console.log(`[session-end] Processing on ${signal}...`);
    try {
      const result = await sessionEndHook();
      if (!result.skipped) {
        console.log(`[session-end] Extracted: ${result.stats.deduplicated} items`);
        console.log(`[session-end] Created: ${result.stats.created}, Evolved: ${result.stats.evolved}, Skipped: ${result.stats.skipped}`);
      }
    } catch (err) {
      console.warn('[session-end] Error:', err.message);
    }
  };

  for (const sig of signals) {
    if (sig === 'beforeExit') {
      process.on(sig, handler);
    } else {
      process.on(sig, () => handler(sig));
    }
  }

  registered = true;
  return { registered: true };
}

module.exports = {
  addToHistory,
  getConversationHistory,
  clearConversationHistory,
  sessionEndHook,
  registerSessionEndHook
};
