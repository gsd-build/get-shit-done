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
const { logHookExecution, loadHookConfig } = require('./hook-logger');

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

    // Extract structured agent type from tool_input (preferred) or fall back to text matching
    const toolInput = data.tool_input || {};
    const subagentType = (typeof toolInput === 'object' && toolInput.subagent_type) || '';
    const prompt = (typeof toolInput === 'object' && toolInput.prompt) || (typeof toolInput === 'string' ? toolInput : '');
    const result = typeof data.tool_result === 'string'
      ? data.tool_result
      : JSON.stringify(data.tool_result || '');

    // Use structured subagent_type for reliable detection, fall back to text search
    const isExecutor = subagentType === 'gsd-executor' || prompt.toLowerCase().includes('execute-plan');
    const isPlanner = subagentType === 'gsd-planner' || prompt.toLowerCase().includes('plan-phase');
    const isVerifier = subagentType === 'gsd-verifier' || prompt.toLowerCase().includes('verify-phase');

    const warnings = [];

    // Detect agent type and check for expected artifacts
    const phasesDir = path.join(cwd, '.planning', 'phases');

    if (isExecutor) {
      // Executor should produce SUMMARY*.md
      if (!hasArtifact(phasesDir, /SUMMARY.*\.md$/i)) {
        warnings.push(
          'gsd-executor completed but no SUMMARY.md found in .planning/phases/'
        );
      }
    }

    if (isPlanner) {
      // Planner should produce PLAN*.md
      if (!hasArtifact(phasesDir, /PLAN.*\.md$/i)) {
        warnings.push(
          'gsd-planner completed but no PLAN.md found in .planning/phases/'
        );
      }
    }

    if (isVerifier) {
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
    logHookExecution(cwd, 'check-subagent-output', 'PostToolUse',
      warnings.length > 0 ? 'warn' : 'allow',
      warnings.length > 0 ? { warnings } : {});

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

// loadHookConfig and logEvent replaced by shared imports from hook-logger.js
