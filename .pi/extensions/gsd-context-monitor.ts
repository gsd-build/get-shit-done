/**
 * GSD Context Monitor Extension for Pi
 *
 * Monitors context window usage and warns when running low.
 * GSD's signature feature to prevent context rot.
 *
 * Thresholds:
 * - Warning at 65% used (35% remaining)
 * - Critical at 75% used (25% remaining)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Context warning thresholds (percentage of context used)
const WARNING_THRESHOLD = 65;  // 35% remaining
const CRITICAL_THRESHOLD = 75; // 25% remaining

// Debounce: minimum tool calls between warnings
const DEBOUNCE_COUNT = 5;

// Track tool call count for debouncing
let toolCallCount = 0;
let lastWarningLevel: 'none' | 'warning' | 'critical' = 'none';

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    toolCallCount++;

    // Get context usage from session if available
    // Pi provides this via ctx.session or we estimate from message history
    let contextPercentUsed = 0;

    try {
      // Check if session has context info
      if (ctx.session?.contextUsage?.percentUsed !== undefined) {
        contextPercentUsed = ctx.session.contextUsage.percentUsed;
      } else if (ctx.session?.messages?.length) {
        // Rough estimate: ~4k tokens per message on average, 200k context
        // This is a fallback if exact usage isn't available
        const messageCount = ctx.session.messages.length;
        contextPercentUsed = Math.min(100, (messageCount * 4) / 200 * 100);
      }
    } catch {
      // Context info not available, skip warning
      return;
    }

    // Determine warning level
    const currentLevel = contextPercentUsed >= CRITICAL_THRESHOLD
      ? 'critical'
      : contextPercentUsed >= WARNING_THRESHOLD
        ? 'warning'
        : 'none';

    // Skip if no warning needed
    if (currentLevel === 'none') {
      lastWarningLevel = 'none';
      return;
    }

    // Debounce: skip if same level as last warning and not enough calls
    if (currentLevel === lastWarningLevel && toolCallCount % DEBOUNCE_COUNT !== 0) {
      return;
    }

    // Escalation bypass: always warn on level increase
    if (currentLevel !== lastWarningLevel) {
      lastWarningLevel = currentLevel;
      toolCallCount = 0; // Reset debounce on level change
    }

    // Build warning message
    const remaining = Math.round(100 - contextPercentUsed);
    const message = currentLevel === 'critical'
      ? `🚨 GSD: Context nearly exhausted (${remaining}% remaining). Consider starting a fresh context or wrapping up current work.`
      : `⚠️ GSD: Context at ${remaining}% remaining. Avoid starting new complex work.`;

    // Notify user
    ctx.ui.notify(message, currentLevel === 'critical' ? 'error' : 'warning');
  });
}