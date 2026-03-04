'use strict';

const {
  green, reset,
} = require('./core.js');

// ─── Hook Registration ──────────────────────────────

/**
 * Register GSD hooks in settings.json (SessionStart, PostToolUse/AfterTool).
 * Claude and Gemini use settings.json hooks; OpenCode and Codex do not.
 *
 * @param {object} settings - The parsed settings.json object
 * @param {string} runtime - Target runtime ('claude', 'gemini', etc.)
 * @param {string} updateCheckCommand - Command string for gsd-check-update hook
 * @param {string} contextMonitorCommand - Command string for gsd-context-monitor hook
 * @returns {object} The modified settings object
 */
function registerHooks(settings, runtime, updateCheckCommand, contextMonitorCommand) {
  const isOpencode = runtime === 'opencode';
  if (isOpencode) return settings;

  const postToolEvent = runtime === 'gemini' ? 'AfterTool' : 'PostToolUse';

  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }

  const hasGsdUpdateHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-check-update'))
  );

  if (!hasGsdUpdateHook) {
    settings.hooks.SessionStart.push({
      hooks: [
        {
          type: 'command',
          command: updateCheckCommand
        }
      ]
    });
    console.log(`  ${green}✓${reset} Configured update check hook`);
  }

  if (!settings.hooks[postToolEvent]) {
    settings.hooks[postToolEvent] = [];
  }

  const hasContextMonitorHook = settings.hooks[postToolEvent].some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-context-monitor'))
  );

  if (!hasContextMonitorHook) {
    settings.hooks[postToolEvent].push({
      hooks: [
        {
          type: 'command',
          command: contextMonitorCommand
        }
      ]
    });
    console.log(`  ${green}✓${reset} Configured context window monitor hook`);
  }

  return settings;
}

// ─── Statusline Configuration ────────────────────────

/**
 * Configure the statusline in settings.json.
 *
 * @param {object} settings - The parsed settings.json object
 * @param {string} statuslineCommand - Command string for the statusline
 * @returns {object} The modified settings object
 */
function configureStatusline(settings, statuslineCommand) {
  settings.statusLine = {
    type: 'command',
    command: statuslineCommand
  };
  return settings;
}

module.exports = {
  registerHooks,
  configureStatusline,
};
