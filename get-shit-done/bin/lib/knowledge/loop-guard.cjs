/**
 * Knowledge Layer — Loop guard
 * Detects and prevents infinite tool-call loops in agent sessions.
 * SHA-256 dedup + ping-pong pattern detection + global circuit breaker.
 */
'use strict';

const crypto = require('crypto');

const WARN_THRESHOLD = 3;
const BLOCK_THRESHOLD = 5;
const CIRCUIT_BREAK_TOTAL = 200;
const HISTORY_SIZE = 30;
const POLL_MULTIPLIER = 3;

function hashCall(toolName, params) {
  return crypto.createHash('sha256').update(toolName + JSON.stringify(params)).digest('hex');
}

function detectPingPong(history) {
  const MIN_REPEATS = 3;
  for (const patternLength of [2, 3]) {
    const required = patternLength * MIN_REPEATS;
    if (history.length < required) continue;
    const tail = history.slice(-required);
    const pattern = tail.slice(0, patternLength);
    if (new Set(pattern).size < 2) continue;
    let match = true;
    for (let repeat = 1; repeat < MIN_REPEATS; repeat++) {
      for (let i = 0; i < patternLength; i++) {
        if (tail[repeat * patternLength + i] !== pattern[i]) { match = false; break; }
      }
      if (!match) break;
    }
    if (match) return { detected: true, patternLength };
  }
  return { detected: false, patternLength: 0 };
}

function createLoopGuard(opts) {
  const pollTools = new Set((opts && opts.pollTools) ? opts.pollTools : []);
  const circuitBreakTotal = (opts && typeof opts.circuitBreakTotal === 'number')
    ? opts.circuitBreakTotal
    : CIRCUIT_BREAK_TOTAL;
  const counters = new Map();
  let history = [];
  let totalCalls = 0;

  function check(toolName, params) {
    totalCalls += 1;
    if (totalCalls >= circuitBreakTotal) {
      return { action: 'circuit_break', message: `Circuit breaker tripped: ${totalCalls} total calls.` };
    }
    const hash = hashCall(toolName, params);
    const count = (counters.get(hash) || 0) + 1;
    counters.set(hash, count);
    history.push(hash);
    if (history.length > HISTORY_SIZE) history.shift();

    const pingPong = detectPingPong(history);
    if (pingPong.detected) {
      return { action: 'block', message: `Ping-pong loop detected: pattern length ${pingPong.patternLength}.` };
    }

    const multiplier = pollTools.has(toolName) ? POLL_MULTIPLIER : 1;
    if (count >= BLOCK_THRESHOLD * multiplier) {
      return { action: 'block', message: `"${toolName}" repeated ${count} times (limit ${BLOCK_THRESHOLD * multiplier}).` };
    }
    if (count >= WARN_THRESHOLD * multiplier) {
      return { action: 'warn', message: `"${toolName}" repeated ${count} times (warn at ${WARN_THRESHOLD * multiplier}).` };
    }
    return { action: 'allow', message: null };
  }

  function getStats() { return { totalCalls, uniqueCalls: counters.size, history: [...history] }; }
  function reset() { counters.clear(); history = []; totalCalls = 0; }

  return { check, getStats, reset };
}

module.exports = {
  WARN_THRESHOLD, BLOCK_THRESHOLD, CIRCUIT_BREAK_TOTAL,
  hashCall, detectPingPong, createLoopGuard,
};
