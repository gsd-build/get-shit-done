#!/usr/bin/env node
// PostToolUse(Read) — tracks context budget consumption
// Warns when file reads exceed thresholds per skill invocation
// Layer 1 of 3-layer context budget management system

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only track Read tool calls
    if (data.tool_name !== 'Read') {
      process.exit(0);
    }

    const cwd = data.cwd || process.cwd();
    const planningDir = path.join(cwd, '.planning');
    if (!fs.existsSync(planningDir)) {
      process.exit(0);
    }

    // Check config — allow disabling via config.json
    try {
      const configPath = path.join(planningDir, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.hooks && config.hooks.trackContextBudget === false) {
          process.exit(0);
        }
      }
    } catch (e) { /* ignore config errors */ }

    const trackerPath = path.join(planningDir, '.context-tracker');
    let tracker = { reads: 0, chars: 0, files: [], skill: '' };

    // Load existing tracker
    if (fs.existsSync(trackerPath)) {
      try {
        tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
      } catch (e) {
        tracker = { reads: 0, chars: 0, files: [], skill: '' };
      }
    }

    // Check for skill change — reset on new skill
    const skillPath = path.join(planningDir, '.active-skill');
    let currentSkill = '';
    if (fs.existsSync(skillPath)) {
      try {
        currentSkill = fs.readFileSync(skillPath, 'utf8').trim();
      } catch (e) { /* ignore */ }
    }
    if (currentSkill && tracker.skill && currentSkill !== tracker.skill) {
      tracker = { reads: 0, chars: 0, files: [], skill: currentSkill };
    }
    tracker.skill = currentSkill;

    // Update tracker
    const filePath = data.tool_input && data.tool_input.file_path ? data.tool_input.file_path : '';
    const resultLength = (data.tool_result || '').length;
    tracker.reads++;
    tracker.chars += resultLength;
    if (filePath && !tracker.files.includes(filePath)) {
      tracker.files.push(filePath);
    }

    // Save tracker
    fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));

    // Check thresholds (configurable via config.thresholds)
    let READ_LIMIT = 15;
    let CHAR_LIMIT = 30000;
    try {
      const configPath = path.join(cwd, '.planning', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.thresholds) {
          if (config.thresholds.read_limit) READ_LIMIT = config.thresholds.read_limit;
          if (config.thresholds.char_limit) CHAR_LIMIT = config.thresholds.char_limit;
        }
      }
    } catch (e) { /* use defaults */ }
    if (tracker.reads >= READ_LIMIT || tracker.chars >= CHAR_LIMIT) {
      const warning = `Context budget warning: ${tracker.reads} reads, ${Math.round(tracker.chars / 1000)}k chars, ${tracker.files.length} unique files. Consider delegating to Task() subagent to protect orchestrator context.`;
      process.stderr.write(warning);
    }
  } catch (e) {
    // Silent fail — never block tool execution
  }
  process.exit(0);
});
