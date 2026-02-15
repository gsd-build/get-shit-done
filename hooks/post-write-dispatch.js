#!/usr/bin/env node
// PostToolUse(Write/Edit) dispatcher — routes post-write events to registered handlers
// Called by Claude Code PostToolUse hook when tool_name matches "Write" or "Edit"
//
// Input: JSON on stdin with { tool_name, tool_input, tool_result, cwd, session_id }
// Output: Informational only (PostToolUse hooks cannot block)

const path = require('path');
const { logHookExecution, loadHookConfig } = require('./hook-logger');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();

    // Only handle Write and Edit tools
    if (data.tool_name !== 'Write' && data.tool_name !== 'Edit') {
      process.exit(0);
    }

    const config = loadHookConfig(cwd);
    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';

    // Collect handlers for post-write events
    const handlers = [];

    // --- Handler registrations ---
    // Branch 9 will add: roadmap sync tracking (config.checkRoadmapSync)
    // Branch 15 will add: context budget tracking (config.trackContextBudget)
    // Future hooks register here by pushing handler functions to the array

    // Run all handlers (informational — no blocking)
    for (const handler of handlers) {
      try {
        handler(filePath, config, cwd, data);
      } catch (e) {
        // Individual handler errors should not affect others
      }
    }

    // Log the event
    logHookExecution(cwd, 'post-write-dispatch', 'PostToolUse', 'allow', {
      tool: data.tool_name,
      file: filePath
    });

  } catch (e) {
    // Silent fail — PostToolUse hooks are informational only
  }
});
