#!/usr/bin/env node
// gsd-hook-version: 1.42.3
// PostToolUse hook: detect .planning/ file writes.
// OPT-IN: no-op unless config.json has hooks.community: true.

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
let enabled = false;
try {
  const cfgPath = path.join(cwd, '.planning', 'config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    enabled = cfg.hooks?.community === true;
  }
} catch (_) {}

if (!enabled) process.exit(0);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let filePath = '';
  try { filePath = JSON.parse(input).tool_input?.file_path || ''; } catch (_) {}

  const isPlanning = filePath.includes('.planning/') || filePath.startsWith('.planning/');

  if (isPlanning) {
    const output = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: '.planning/ file modified: ' + filePath + '\nCheck: Should STATE.md be updated to reflect this change?',
        planning_modified: true,
        file_path: filePath,
      },
    });
    process.stdout.write(output);
  }

  process.exit(0);
});
