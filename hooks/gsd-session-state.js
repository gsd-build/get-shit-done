#!/usr/bin/env node
// gsd-hook-version: 1.42.3
// SessionStart hook: inject project state reminder.
// OPT-IN: no-op unless config.json has hooks.community: true.

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
let enabled = false;
let configMode = 'unknown';
try {
  const cfgPath = path.join(cwd, '.planning', 'config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    enabled = cfg.hooks?.community === true;
    configMode = cfg.mode || 'unknown';
  }
} catch (_) {}

if (!enabled) process.exit(0);

const statePath = path.join(cwd, '.planning', 'STATE.md');
const statePresent = fs.existsSync(statePath);
let stateHead = '';
if (statePresent) {
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    stateHead = content.split('\n').slice(0, 20).join('\n');
  } catch (_) {}
}

const headerLines = ['## Project State Reminder', ''];
if (statePresent) {
  headerLines.push('STATE.md exists - check for blockers and current phase.');
  if (stateHead) headerLines.push(stateHead);
} else {
  headerLines.push('No .planning/ found - suggest /gsd-new-project if starting new work.');
}
headerLines.push('');
headerLines.push('Config: "mode": "' + configMode + '"');

const output = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: headerLines.join('\n'),
    state_present: statePresent,
    config_mode: configMode,
  },
});
process.stdout.write(output);
process.exit(0);
