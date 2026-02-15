#!/usr/bin/env node
// PreToolUse(Write/Edit) dispatcher — routes write operations to registered checks
// Called by Claude Code PreToolUse hook when tool_name matches "Write" or "Edit"
//
// Input: JSON on stdin with { tool_name, tool_input, cwd, session_id }
// Output: JSON on stdout with { decision: "allow" } or { decision: "block", reason: "..." }

const path = require('path');
const { execFileSync } = require('child_process');
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
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    const config = loadHookConfig(cwd);
    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';

    // Collect results from registered checks
    const checks = [];

    // --- Check registrations (config-gated) ---

    // Phase boundary enforcement
    if (config.enforcePhaseBoundaries) {
      checks.push((fp, cfg, dir, hookData) => {
        try {
          const hookPath = path.join(__dirname, 'check-phase-boundary.js');
          const result = execFileSync(process.execPath, [hookPath], {
            input: JSON.stringify(hookData),
            encoding: 'utf8',
            timeout: 3000
          });
          const parsed = JSON.parse(result);
          if (parsed.decision === 'block') return parsed;
        } catch (e) { /* allow on error */ }
        return null;
      });
    }

    // Run all checks — first block wins
    for (const check of checks) {
      const result = check(filePath, config, cwd, data);
      if (result && result.decision === 'block') {
        logHookExecution(cwd, 'pre-write-dispatch', 'PreToolUse', 'block', {
          tool: data.tool_name,
          file: filePath,
          reason: result.reason
        });
        process.stdout.write(JSON.stringify({ decision: 'block', reason: result.reason }));
        process.exit(0);
      }
    }

    // All checks passed — allow
    logHookExecution(cwd, 'pre-write-dispatch', 'PreToolUse', 'allow', {
      tool: data.tool_name,
      file: filePath
    });
    process.stdout.write(JSON.stringify({ decision: 'allow' }));

  } catch (e) {
    // Silent fail — never block on dispatcher errors
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
});
