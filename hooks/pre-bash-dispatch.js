#!/usr/bin/env node
// PreToolUse(Bash) dispatcher — routes Bash commands to registered checks
// Called by Claude Code PreToolUse hook when tool_name matches "Bash"
//
// Input: JSON on stdin with { tool_name, tool_input, cwd, session_id }
// Output: JSON on stdout with { decision: "allow" } or { decision: "block", reason: "..." }

const path = require('path');
const { logHookExecution, loadHookConfig } = require('./hook-logger');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();

    // Only handle Bash tool
    if (data.tool_name !== 'Bash') {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    const config = loadHookConfig(cwd);
    const command = (data.tool_input && data.tool_input.command) || '';

    // Collect results from registered checks
    // Each check returns { decision, reason } or null (allow)
    const checks = [];

    // --- Check registrations ---
    // Branch 3 will add: dangerous command blocking (config.blockDangerousCommands)
    // Branch 5 will add: workflow enforcement (config.enforceWorkflowOrder)
    // Future hooks register here by pushing check functions to the array

    // Run all checks — first block wins
    for (const check of checks) {
      const result = check(command, config, cwd, data);
      if (result && result.decision === 'block') {
        logHookExecution(cwd, 'pre-bash-dispatch', 'PreToolUse', 'block', {
          tool: 'Bash',
          command: command.substring(0, 200),
          reason: result.reason
        });
        process.stdout.write(JSON.stringify({ decision: 'block', reason: result.reason }));
        process.exit(0);
      }
    }

    // All checks passed — allow
    logHookExecution(cwd, 'pre-bash-dispatch', 'PreToolUse', 'allow', {
      tool: 'Bash',
      command: command.substring(0, 200)
    });
    process.stdout.write(JSON.stringify({ decision: 'allow' }));

  } catch (e) {
    // Silent fail — never block on dispatcher errors
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
});
