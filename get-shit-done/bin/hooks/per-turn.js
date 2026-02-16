const { loadHookConfig } = require('./config.js');
const { extractKnowledge } = require('../knowledge-extraction.js');

// Track processed responses to avoid re-extraction
const processedResponses = new Set();

function hashResponse(content) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

async function perTurnHook(response, options = {}) {
  const config = loadHookConfig(options);

  if (!config.enabled || config.timing !== 'per-turn') {
    return { skipped: true, reason: 'disabled_or_wrong_timing' };
  }

  if (!response || typeof response !== 'string') {
    return { skipped: true, reason: 'invalid_response' };
  }

  // Skip if already processed
  const hash = hashResponse(response);
  if (processedResponses.has(hash)) {
    return { skipped: true, reason: 'already_processed' };
  }
  processedResponses.add(hash);

  // Extract from this response
  const extraction = extractKnowledge(response, {
    debug: process.env.GSD_DEBUG
  });

  if (extraction.extractions.length === 0) {
    return {
      skipped: true,
      reason: 'no_extractions',
      stats: {
        raw_matches: extraction.total_raw,
        filtered: extraction.total_filtered
      }
    };
  }

  // Process immediately (async, non-blocking intent)
  let processResult = { created: 0, evolved: 0, skipped: 0 };

  try {
    const { processExtractionBatch } = require('../knowledge-evolution.js');
    const { knowledge } = require('../knowledge.js');

    if (knowledge.isReady(config.scope)) {
      const conn = await knowledge._getConnection(config.scope);
      processResult = await processExtractionBatch(conn, extraction.extractions, {
        scope: config.scope,
        source: 'per_turn_hook'
      });
    }
  } catch (err) {
    // Non-blocking: log and continue
    if (process.env.GSD_DEBUG) {
      console.warn('[per-turn] Processing failed:', err.message);
    }
    processResult.error = err.message;
  }

  return {
    success: true,
    stats: {
      raw_matches: extraction.total_raw,
      filtered: extraction.total_filtered,
      deduplicated: extraction.total_deduplicated,
      ...processResult
    }
  };
}

function createPerTurnMiddleware(options = {}) {
  return async function perTurnMiddleware(context, next) {
    // Call next handler first
    const result = await next(context);

    // Extract from Claude's response (non-blocking)
    if (context.response) {
      perTurnHook(context.response, options).catch(err => {
        console.warn('[per-turn] Hook error:', err.message);
      });
    }

    return result;
  };
}

// Simple async wrapper for direct use
async function extractFromResponse(response, options = {}) {
  return perTurnHook(response, options);
}

function clearProcessedResponses() {
  processedResponses.clear();
}

module.exports = {
  perTurnHook,
  createPerTurnMiddleware,
  extractFromResponse,
  clearProcessedResponses
};
