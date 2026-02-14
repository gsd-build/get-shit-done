#!/usr/bin/env node
// PostToolUse(Task) hook — validates expected artifacts exist after agent completion
// Activates when tool_name === 'Task'
//
// Checks for expected artifacts based on agent type indicators in the result:
//   - gsd-executor / execute → SUMMARY*.md must exist
//   - gsd-planner / plan → PLAN*.md must exist
//   - gsd-verifier / verify → VERIFICATION.md must exist
//
// Input: JSON on stdin with { tool_name, tool_input, tool_result, cwd }
// Output: Informational only (PostToolUse hooks cannot block)

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();

    // Only handle Task tool
    if (data.tool_name !== 'Task') {
      process.exit(0);
    }

    // Check config toggle
    const config = loadHookConfig(cwd);
    if (config.checkSubagentOutput === false) {
      process.exit(0);
    }

    // Get the task result (may be string or object)
    const result = typeof data.tool_result === 'string'
      ? data.tool_result
      : JSON.stringify(data.tool_result || '');

    // Also check tool_input for agent type hints
    const taskInput = typeof data.tool_input === 'string'
      ? data.tool_input
      : JSON.stringify(data.tool_input || '');

    const combinedText = (result + ' ' + taskInput).toLowerCase();

    const warnings = [];

    // Detect agent type and check for expected artifacts
    const phasesDir = path.join(cwd, '.planning', 'phases');

    if (combinedText.includes('gsd-executor') || combinedText.includes('execute-plan')) {
      // Executor should produce SUMMARY*.md
      if (!hasArtifact(phasesDir, /SUMMARY.*\.md$/i)) {
        warnings.push(
          'gsd-executor completed but no SUMMARY.md found in .planning/phases/'
        );
      }
    }

    if (combinedText.includes('gsd-planner') || combinedText.includes('plan-phase')) {
      // Planner should produce PLAN*.md
      if (!hasArtifact(phasesDir, /PLAN.*\.md$/i)) {
        warnings.push(
          'gsd-planner completed but no PLAN.md found in .planning/phases/'
        );
      }
    }

    if (combinedText.includes('gsd-verifier') || combinedText.includes('verify-phase')) {
      // Verifier should produce VERIFICATION.md
      if (!hasArtifact(phasesDir, /VERIFICATION.*\.md$/i)) {
        warnings.push(
          'gsd-verifier completed but no VERIFICATION.md found in .planning/phases/'
        );
      }
    }

    // Output warnings to stderr
    if (warnings.length > 0) {
      process.stderr.write(`[check-subagent-output]:\n`);
      for (const w of warnings) {
        process.stderr.write(`  - ${w}\n`);
      }
    }

    // Log event
    logEvent(cwd, warnings);

  } catch (e) {
    // Silent fail — never block on hook bugs
  }
  process.exit(0);
});

/**
 * Check if any file matching pattern exists recursively in phases directory
 */
function hasArtifact(phasesDir, pattern) {
  try {
    if (!fs.existsSync(phasesDir)) return false;

    const dirs = fs.readdirSync(phasesDir);
    for (const dir of dirs) {
      const fullDir = path.join(phasesDir, dir);
      if (!fs.statSync(fullDir).isDirectory()) continue;

      const files = fs.readdirSync(fullDir);
      if (files.some(f => pattern.test(f))) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

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

function logEvent(cwd, warnings) {
  try {
    const logsDir = path.join(cwd, '.planning', 'logs');
    const logFile = path.join(logsDir, 'hooks.jsonl');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      hook: 'check-subagent-output',
      event: 'PostToolUse',
      decision: warnings.length > 0 ? 'warn' : 'allow',
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (e) { /* ignore logging errors */ }
}
