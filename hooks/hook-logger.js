#!/usr/bin/env node
// Utility for consistent hook execution logging
// Writes structured JSON lines to .planning/logs/hooks.jsonl
// Used by dispatcher hooks to log decisions and execution details

const fs = require('fs');
const path = require('path');

/**
 * Log a hook execution event to .planning/logs/hooks.jsonl
 * @param {string} cwd - Project working directory
 * @param {string} hookName - Name of the hook (e.g., 'pre-bash-dispatch')
 * @param {string} eventType - Event type (e.g., 'PreToolUse', 'PostToolUse')
 * @param {string} decision - 'allow', 'block', 'warn', 'skip'
 * @param {object} details - Additional details to include in the log entry
 */
function logHookExecution(cwd, hookName, eventType, decision, details = {}) {
  const logsDir = path.join(cwd, '.planning', 'logs');
  const logFile = path.join(logsDir, 'hooks.jsonl');

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    hook: hookName,
    event: eventType,
    decision,
    ...details
  };

  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');

  // Rotate: keep last 200 entries
  try {
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    if (lines.length > 200) {
      fs.writeFileSync(logFile, lines.slice(-200).join('\n') + '\n');
    }
  } catch (e) { /* ignore rotation errors */ }
}

/**
 * Load hook configuration from .planning/config.json
 * @param {string} cwd - Project working directory
 * @returns {object} Hook configuration object (empty object if not found)
 */
function loadHookConfig(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.hooks || {};
    }
  } catch (e) { /* ignore parse errors */ }
  return {};
}

module.exports = { logHookExecution, loadHookConfig };
