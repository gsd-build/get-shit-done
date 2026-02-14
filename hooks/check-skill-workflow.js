#!/usr/bin/env node
// PreToolUse(Write/Edit) hook — enforces GSD workflow ordering
// Ensures PLAN.md exists before source code writes during execution

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== 'Write' && data.tool_name !== 'Edit') { process.exit(0); }

    const filePath = data.tool_input?.file_path || data.tool_input?.path || '';
    const cwd = data.cwd || process.cwd();

    // Check config
    try {
      const configPath = path.join(cwd, '.planning', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.hooks && config.hooks.enforceWorkflowOrder === false) {
          process.exit(0);
        }
      }
    } catch (e) { /* default to enabled */ }

    // Skip non-project files and planning files themselves
    const planningDir = path.join(cwd, '.planning');
    if (!filePath.startsWith(cwd) || filePath.startsWith(planningDir)) {
      process.exit(0);
    }

    // Check for SUMMARY.md / VERIFICATION.md writes without .active-agent signal
    const basename = path.basename(filePath);
    if (basename === 'SUMMARY.md' || basename === 'VERIFICATION.md') {
      const activeAgent = path.join(planningDir, '.active-agent');
      if (!fs.existsSync(activeAgent)) {
        // Warn but don't block — orchestrator might be writing legitimately
        process.stdout.write(JSON.stringify({
          decision: 'warn',
          reason: `Writing ${basename} without .active-agent signal. This file should typically be written by a subagent, not the orchestrator.`
        }));
      }
      process.exit(0);
    }

    // Check for source code writes during execute-phase without PLAN.md
    const activeSkill = path.join(planningDir, '.active-skill');
    if (fs.existsSync(activeSkill)) {
      try {
        const skill = fs.readFileSync(activeSkill, 'utf8').trim();
        if (skill.includes('execute-phase') || skill.includes('quick')) {
          // Check if any PLAN.md exists in .planning/
          const planExists = findPlanFile(planningDir);
          if (!planExists) {
            process.stdout.write(JSON.stringify({
              decision: 'block',
              reason: `Cannot write source code during ${skill} — no PLAN.md found. Create a plan first.`
            }));
            process.exit(2);
          }
        }
      } catch (e) { /* allow on read errors */ }
    }

    process.exit(0);
  } catch (e) {
    process.exit(0); // Silent fail — never block on hook errors
  }
});

function findPlanFile(planningDir) {
  if (!fs.existsSync(planningDir)) return false;
  try {
    const entries = fs.readdirSync(planningDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.') {
        const subDir = path.join(planningDir, entry.name);
        try {
          const files = fs.readdirSync(subDir);
          if (files.some(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')) return true;
        } catch (e) { /* skip unreadable dirs */ }
      }
    }
    // Also check phases subdirectory
    const phasesDir = path.join(planningDir, 'phases');
    if (fs.existsSync(phasesDir)) {
      const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true });
      for (const phaseEntry of phaseDirs) {
        if (phaseEntry.isDirectory()) {
          const phaseDir = path.join(phasesDir, phaseEntry.name);
          try {
            const files = fs.readdirSync(phaseDir);
            if (files.some(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')) return true;
          } catch (e) { /* skip unreadable dirs */ }
        }
      }
    }
  } catch (e) { /* allow on errors */ }
  return false;
}
