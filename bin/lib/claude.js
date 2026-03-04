'use strict';

// Claude Code is the "base case" runtime — no content conversion needed.
// Claude-specific install behavior (commands/gsd/ structure, settings.json hooks,
// statusline support) is handled by the orchestrator in install.js since it is
// the default code path shared with Gemini.
//
// This module exists as the architectural boundary for the Claude runtime,
// ready for Claude-specific logic if needed in the future.

module.exports = {};
