#!/usr/bin/env node
// PostToolUse(Write/Edit) hook — validates STATE.md stays in sync with ROADMAP.md
// Activates when written file is STATE.md in .planning/ directory
//
// Checks:
//   - Reads current phase from STATE.md
//   - Reads ROADMAP.md and finds matching phase entry
//   - Warns if STATE.md says phase is "executing"/"in progress" but ROADMAP shows "planned"
//   - Warns if phase referenced in STATE.md doesn't exist in ROADMAP.md
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

    // Only handle Write and Edit tools
    if (data.tool_name !== 'Write' && data.tool_name !== 'Edit') {
      process.exit(0);
    }

    // Check config toggle
    const config = loadHookConfig(cwd);
    if (config.checkRoadmapSync === false) {
      process.exit(0);
    }

    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
    if (!filePath) {
      process.exit(0);
    }

    // Normalize and check if this is STATE.md in .planning/
    const normalizedPath = filePath.replace(/\\/g, '/');
    const basename = path.basename(filePath);

    if (basename !== 'STATE.md' || !normalizedPath.includes('.planning/')) {
      process.exit(0);
    }

    // Read STATE.md
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    let stateContent = '';
    try {
      stateContent = fs.readFileSync(statePath, 'utf8');
    } catch (e) {
      process.exit(0);
    }

    // Read ROADMAP.md
    const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
    let roadmapContent = '';
    try {
      roadmapContent = fs.readFileSync(roadmapPath, 'utf8');
    } catch (e) {
      // No ROADMAP.md — nothing to sync against
      process.exit(0);
    }

    const warnings = [];

    // Extract current phase from STATE.md
    const phaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(\S+)/);
    const statusMatch = stateContent.match(/\*\*Status:\*\*\s*(.+)/);

    if (!phaseMatch) {
      // No phase info — skip
      process.exit(0);
    }

    const currentPhase = phaseMatch[1].replace(/^0+/, '') || '0';
    const stateStatus = statusMatch ? statusMatch[1].trim().toLowerCase() : '';

    // Find this phase in ROADMAP.md
    const phasePattern = new RegExp(
      `###\\s+Phase\\s+${escapeRegex(currentPhase)}[.:]\\s*(.+)`,
      'i'
    );
    const roadmapMatch = roadmapContent.match(phasePattern);

    if (!roadmapMatch) {
      warnings.push(
        `Phase ${currentPhase} referenced in STATE.md not found in ROADMAP.md`
      );
    } else {
      // Check if ROADMAP has a checkbox status for this phase
      const checkboxPattern = new RegExp(
        `-\\s+\\[([ x])\\]\\s+Phase\\s+${escapeRegex(currentPhase)}`,
        'i'
      );
      const checkboxMatch = roadmapContent.match(checkboxPattern);

      if (checkboxMatch) {
        const isChecked = checkboxMatch[1] === 'x';
        const isActive = stateStatus.includes('progress') || stateStatus.includes('executing');

        if (isActive && isChecked) {
          warnings.push(
            `Phase ${currentPhase} is marked complete in ROADMAP.md but STATE.md says "${statusMatch[1].trim()}"`
          );
        }
      }

      // Check if state says executing but no phase directory exists on disk
      if (stateStatus.includes('progress') || stateStatus.includes('executing')) {
        const phasesDir = path.join(cwd, '.planning', 'phases');
        if (fs.existsSync(phasesDir)) {
          const padded = currentPhase.padStart(2, '0');
          const dirs = fs.readdirSync(phasesDir);
          const hasDir = dirs.some(d => d.startsWith(padded + '-') || d.startsWith(padded + '.'));
          if (!hasDir) {
            warnings.push(
              `Phase ${currentPhase} is "in progress" but no phase directory exists on disk`
            );
          }
        }
      }
    }

    // Output warnings to stderr
    if (warnings.length > 0) {
      process.stderr.write(`[check-roadmap-sync] STATE.md:\n`);
      for (const w of warnings) {
        process.stderr.write(`  - ${w}\n`);
      }
    }

    // Log event
    logHookExecution(cwd, 'check-roadmap-sync', 'PostToolUse',
      warnings.length > 0 ? 'warn' : 'allow',
      warnings.length > 0 ? { warnings } : {});

  } catch (e) {
    // Silent fail — never block on hook bugs
  }
  process.exit(0);
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// loadHookConfig and logEvent replaced by shared imports from hook-logger.js
