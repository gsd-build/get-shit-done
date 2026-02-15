#!/usr/bin/env node
// PostToolUse — counts tool calls per session, suggests /compact at threshold
// Layer 2 of 3-layer context budget management system

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const planningDir = path.join(cwd, '.planning');
    if (!fs.existsSync(planningDir)) {
      process.exit(0);
    }

    // Check config — allow disabling and threshold customization
    let threshold = 50;
    let reRemindEvery = 25;
    try {
      const configPath = path.join(planningDir, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.hooks && config.hooks.suggestCompact === false) {
          process.exit(0);
        }
        if (config.hooks && config.hooks.compactThreshold) {
          threshold = config.hooks.compactThreshold;
        } else if (config.thresholds && config.thresholds.compact_threshold) {
          threshold = config.thresholds.compact_threshold;
        }
        if (config.hooks && config.hooks.compactReRemindEvery) {
          reRemindEvery = config.hooks.compactReRemindEvery;
        }
      }
    } catch (e) { /* ignore config errors */ }

    const counterPath = path.join(planningDir, '.compact-counter');
    let counter = { calls: 0, lastSuggested: 0 };

    if (fs.existsSync(counterPath)) {
      try {
        counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
      } catch (e) {
        counter = { calls: 0, lastSuggested: 0 };
      }
    }

    counter.calls++;

    // Check if should suggest
    if (counter.calls >= threshold && (counter.calls - counter.lastSuggested) >= reRemindEvery) {
      counter.lastSuggested = counter.calls;
      process.stderr.write(`Tool call count: ${counter.calls}. Consider running /compact to free context space.`);
    }

    fs.writeFileSync(counterPath, JSON.stringify(counter));
  } catch (e) {
    // Silent fail — never block tool execution
  }
  process.exit(0);
});
